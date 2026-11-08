// ค่าลับ (ตั้งด้วย `wrangler secret put` หรือ .dev.vars ตอนพัฒนา) — ไม่อยู่ใน wrangler.jsonc จึงประกาศ type เอง
interface Env {
  FACEBOOK_APP_ID?: string;
  FACEBOOK_APP_SECRET?: string;
  /** Facebook user ID ของครูที่เข้าหลังบ้านได้ คั่นด้วยจุลภาค */
  ADMIN_FACEBOOK_IDS?: string;
  /** รหัสผ่านครู (เข้าหลังบ้านด้วยรหัสผ่าน) */
  ADMIN_PASSWORD?: string;
}
