// ค่าลับ (ตั้งด้วย `wrangler secret put` หรือ .dev.vars ตอนพัฒนา) — ไม่อยู่ใน wrangler.jsonc จึงประกาศ type เอง
interface Env {
  /** รหัสผ่านครู (เข้าหลังบ้านด้วยรหัสผ่าน) */
  ADMIN_PASSWORD?: string;
}
