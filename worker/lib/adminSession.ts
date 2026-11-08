import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { randomToken, sha256Hex } from "./session";

// session ครู: เข้าด้วย Facebook และ Facebook user ID ต้องอยู่ใน ADMIN_FACEBOOK_IDS
// ตรวจรายชื่อซ้ำทุก request: ลบ ID ออกจาก ADMIN_FACEBOOK_IDS = หมดสิทธิ์ทันที

export const ADMIN_COOKIE = "asid";
export const ADMIN_TTL_SEC = 60 * 60 * 24 * 30; // 30 วัน

export type AdminVars = { adminId: string };
type Ctx = Context<{ Bindings: Env; Variables: AdminVars }>;

export function adminIds(env: Env): string[] {
  return (env.ADMIN_FACEBOOK_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function startAdminSession(c: Ctx, facebookUserId: string): Promise<void> {
  const token = randomToken();
  await c.env.DB.batch([
    // ล้าง session ที่หมดอายุแล้ว
    c.env.DB.prepare("DELETE FROM admin_sessions WHERE expires_at <= unixepoch()"),
    c.env.DB.prepare("INSERT INTO admin_sessions (id, facebook_user_id, expires_at) VALUES (?1, ?2, unixepoch() + ?3)").bind(
      await sha256Hex(token),
      facebookUserId,
      ADMIN_TTL_SEC,
    ),
  ]);
  setCookie(c, ADMIN_COOKIE, token, { httpOnly: true, secure: true, sameSite: "Lax", path: "/", maxAge: ADMIN_TTL_SEC });
}

export async function currentAdminId(c: Ctx): Promise<string | null> {
  const token = getCookie(c, ADMIN_COOKIE);
  if (!token) return null;
  const row = await c.env.DB.prepare(
    "SELECT facebook_user_id FROM admin_sessions WHERE id = ?1 AND expires_at > unixepoch()",
  )
    .bind(await sha256Hex(token))
    .first<{ facebook_user_id: string }>();
  if (!row || !adminIds(c.env).includes(row.facebook_user_id)) return null;
  return row.facebook_user_id;
}

export async function endAdminSession(c: Ctx): Promise<void> {
  const token = getCookie(c, ADMIN_COOKIE);
  if (token) await c.env.DB.prepare("DELETE FROM admin_sessions WHERE id = ?1").bind(await sha256Hex(token)).run();
  deleteCookie(c, ADMIN_COOKIE, { path: "/", secure: true });
}

/** ต้องเป็นครูเท่านั้น */
export const requireAdmin: MiddlewareHandler<{ Bindings: Env; Variables: AdminVars }> = async (c, next) => {
  const id = await currentAdminId(c);
  if (!id) return c.json({ error: "unauthorized" }, 401);
  c.set("adminId", id);
  await next();
};
