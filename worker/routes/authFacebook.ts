import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { validateRegister } from "../../shared/validate";
import { facebookAuthUrl, facebookConfigured, facebookUserFromCode } from "../lib/facebook";
import { randomToken, sha256Hex, startSession } from "../lib/session";
import { insertStudent, PHONE_TAKEN, readJson, toMe } from "./auth";

// นักเรียนเข้าด้วย Facebook
// - เคยผูกบัญชีแล้ว → เข้าระบบทันที
// - ครั้งแรก → พักตัวตน Facebook ไว้ (oauth_pending, 30 นาที) แล้วให้กรอกโปรไฟล์ที่ /register/facebook

export const authFacebook = new Hono<{ Bindings: Env }>();

const STATE_COOKIE = "fb_state";
const PENDING_COOKIE = "fb_pending";
const COOKIE_PATH = "/api/auth/facebook";
const PENDING_TTL_SEC = 30 * 60;

const callbackUrl = (reqUrl: string) => `${new URL(reqUrl).origin}/api/auth/facebook/callback`;
const cookieOpts = (maxAge: number) => ({ httpOnly: true, secure: true, sameSite: "Lax" as const, path: COOKIE_PATH, maxAge });

authFacebook.get("/auth/facebook", (c) => {
  if (!facebookConfigured(c.env)) return c.redirect("/login?fb=config");
  const state = randomToken();
  setCookie(c, STATE_COOKIE, state, cookieOpts(600));
  return c.redirect(facebookAuthUrl(c.env, callbackUrl(c.req.url), state));
});

authFacebook.get("/auth/facebook/callback", async (c) => {
  const expected = getCookie(c, STATE_COOKIE);
  deleteCookie(c, STATE_COOKIE, { path: COOKIE_PATH, secure: true });
  if (c.req.query("error")) return c.redirect("/login?fb=cancelled");
  const code = c.req.query("code");
  const state = c.req.query("state");
  if (!code || !state || !expected || state !== expected) return c.redirect("/login?fb=failed");
  if (!facebookConfigured(c.env)) return c.redirect("/login?fb=config");

  let fb: { id: string; name?: string };
  try {
    fb = await facebookUserFromCode(c.env, code, callbackUrl(c.req.url));
  } catch (err) {
    console.error(err);
    return c.redirect("/login?fb=failed");
  }

  const linked = await c.env.DB.prepare(
    "SELECT student_id FROM oauth_accounts WHERE provider = 'facebook' AND provider_user_id = ?1",
  )
    .bind(fb.id)
    .first<{ student_id: number }>();
  if (linked) {
    await startSession(c, linked.student_id);
    return c.redirect("/");
  }

  // ครั้งแรก: พักไว้ แล้วไปกรอกโปรไฟล์
  const token = randomToken();
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM oauth_pending WHERE expires_at <= unixepoch()"),
    c.env.DB.prepare(
      "INSERT INTO oauth_pending (id, provider, provider_user_id, display_name, expires_at) VALUES (?1, 'facebook', ?2, ?3, unixepoch() + ?4)",
    ).bind(await sha256Hex(token), fb.id, fb.name ?? null, PENDING_TTL_SEC),
  ]);
  setCookie(c, PENDING_COOKIE, token, cookieOpts(PENDING_TTL_SEC));
  return c.redirect("/register/facebook");
});

async function pendingRow(c: Context<{ Bindings: Env }>) {
  const token = getCookie(c, PENDING_COOKIE);
  if (!token) return null;
  const id = await sha256Hex(token);
  const row = await c.env.DB.prepare(
    "SELECT provider_user_id, display_name FROM oauth_pending WHERE id = ?1 AND expires_at > unixepoch()",
  )
    .bind(id)
    .first<{ provider_user_id: string; display_name: string | null }>();
  return row ? { id, ...row } : null;
}

// ชื่อจาก Facebook สำหรับเติมฟอร์มให้ก่อน
authFacebook.get("/auth/facebook/pending", async (c) => {
  const p = await pendingRow(c);
  if (!p) return c.json({ error: "no_pending" }, 401);
  const [firstName = "", ...rest] = (p.display_name ?? "").trim().split(/\s+/);
  return c.json({ firstName, lastName: rest.join(" ") });
});

// กรอกโปรไฟล์ครั้งแรก → สร้างนักเรียน (ไม่มีรหัสผ่าน) + ผูกบัญชี Facebook + เข้าระบบ
authFacebook.post("/auth/facebook/complete", async (c) => {
  const p = await pendingRow(c);
  if (!p) return c.json({ error: "no_pending", message: "หมดเวลา กรุณากดเข้าสู่ระบบด้วย Facebook ใหม่" }, 401);
  const { data, errors } = validateRegister(await readJson(c.req.raw), { password: false });
  if (Object.keys(errors).length) return c.json({ error: "validation", fields: errors }, 400);

  const db = c.env.DB;
  const row = await insertStudent(db, data, null, [
    db
      .prepare(
        `INSERT INTO oauth_accounts (student_id, provider, provider_user_id)
         VALUES ((SELECT id FROM students WHERE student_phone = ?1), 'facebook', ?2)`,
      )
      .bind(data.studentPhone, p.provider_user_id),
    db.prepare("DELETE FROM oauth_pending WHERE id = ?1").bind(p.id),
  ]).catch((err) => {
    // บัญชี Facebook นี้ถูกผูกไปแล้ว (กดส่งซ้ำ / เปิดสองแท็บ)
    if (String(err).includes("UNIQUE constraint failed: oauth_accounts")) return "linked" as const;
    throw err;
  });
  if (row === "linked") return c.json({ error: "already_linked", message: "บัญชี Facebook นี้สมัครแล้ว กรุณาเข้าสู่ระบบด้วย Facebook" }, 409);
  if (!row) return c.json(PHONE_TAKEN, 409);

  deleteCookie(c, PENDING_COOKIE, { path: COOKIE_PATH, secure: true });
  await startSession(c, row.id);
  return c.json(toMe(row), 201);
});
