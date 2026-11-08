import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { randomToken, sha256Hex } from "./session";

// session ครู เข้าได้ 2 ทาง:
// - Facebook: Facebook user ID ต้องอยู่ใน ADMIN_FACEBOOK_IDS (ลบ ID ออก = หมดสิทธิ์ทันที)
// - รหัสผ่าน: ตรงกับ ADMIN_PASSWORD (เปลี่ยนรหัส = session เดิมที่เข้าด้วยรหัสหมดสิทธิ์ทันที)
// ตัวตนเก็บในคอลัมน์ facebook_user_id: เลข Facebook ID หรือ "password:<แฮชของรหัสปัจจุบัน>"

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

/** ตัวตนของ session ที่เข้าด้วยรหัสผ่าน ผูกกับรหัสปัจจุบัน */
export async function passwordIdentity(env: Env): Promise<string | null> {
  if (!env.ADMIN_PASSWORD) return null;
  return `password:${(await sha256Hex(`physicshead-admin:${env.ADMIN_PASSWORD}`)).slice(0, 32)}`;
}

/** ตรวจรหัสผ่านครูแบบเวลาคงที่ */
export async function checkAdminPassword(env: Env, password: string): Promise<boolean> {
  if (!env.ADMIN_PASSWORD) return false;
  const enc = new TextEncoder();
  const a = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(password)));
  const b = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(env.ADMIN_PASSWORD)));
  return crypto.subtle.timingSafeEqual(a, b);
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
  if (!row) return null;
  const id = row.facebook_user_id;
  if (id.startsWith("password:")) return id === (await passwordIdentity(c.env)) ? id : null;
  return adminIds(c.env).includes(id) ? id : null;
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
