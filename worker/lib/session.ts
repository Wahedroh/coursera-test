import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

// session นักเรียน: 1 บัญชี = 1 เครื่อง (sessions.student_id เป็น UNIQUE)
// cookie เก็บ token สุ่ม ส่วนฐานข้อมูลเก็บแค่ SHA-256 ของ token

export const SESSION_COOKIE = "sid";
export const SESSION_TTL_SEC = 60 * 60 * 24 * 30; // 30 วัน

type Ctx = Context<{ Bindings: Env }>;

export function randomToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** สร้าง session ใหม่แทน session เดิมของนักเรียนคนนี้ (เครื่องเก่าหลุดทันที) */
export async function startSession(c: Ctx, studentId: number): Promise<void> {
  const token = randomToken();
  const id = await sha256Hex(token);
  await c.env.DB.prepare(
    `INSERT INTO sessions (id, student_id, expires_at) VALUES (?1, ?2, unixepoch() + ?3)
     ON CONFLICT (student_id) DO UPDATE
     SET id = excluded.id, created_at = unixepoch(), expires_at = excluded.expires_at`,
  )
    .bind(id, studentId, SESSION_TTL_SEC)
    .run();
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_TTL_SEC,
  });
}

/** student id ของ session ปัจจุบัน หรือ null ถ้าไม่มี หมดอายุ หรือถูกเครื่องอื่นแทนที่แล้ว */
export async function currentStudentId(c: Ctx): Promise<number | null> {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return null;
  const row = await c.env.DB.prepare("SELECT student_id FROM sessions WHERE id = ?1 AND expires_at > unixepoch()")
    .bind(await sha256Hex(token))
    .first<{ student_id: number }>();
  return row?.student_id ?? null;
}

export async function endSession(c: Ctx): Promise<void> {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    await c.env.DB.prepare("DELETE FROM sessions WHERE id = ?1").bind(await sha256Hex(token)).run();
  }
  deleteCookie(c, SESSION_COOKIE, { path: "/", secure: true });
}
