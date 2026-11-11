// จำกัดการเดารหัสผ่าน: นับครั้งที่ใส่ผิดต่อ key ภายในช่วงเวลา (ตาราง admin_login_attempts ใช้ร่วมกันทุกที่)
// key ตัวอย่าง: "a:<ip>" ครู, "s:<ip>:<เบอร์>" นักเรียน, "p:<student id>" เปลี่ยนรหัสผ่าน

export const MAX_FAILURES = 10;
export const WINDOW_SEC = 15 * 60;
export const LOCKED_MESSAGE = "ใส่รหัสผิดหลายครั้งเกินไป กรุณารอ 15 นาที";

export async function isLocked(db: D1Database, key: string): Promise<boolean> {
  const r = await db
    .prepare("SELECT failures FROM admin_login_attempts WHERE ip = ?1 AND window_start > unixepoch() - ?2")
    .bind(key, WINDOW_SEC)
    .first<{ failures: number }>();
  return !!r && r.failures >= MAX_FAILURES;
}

export async function recordFailure(db: D1Database, key: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO admin_login_attempts (ip, failures, window_start) VALUES (?1, 1, unixepoch())
       ON CONFLICT (ip) DO UPDATE SET
         failures = CASE WHEN window_start > unixepoch() - ?2 THEN failures + 1 ELSE 1 END,
         window_start = CASE WHEN window_start > unixepoch() - ?2 THEN window_start ELSE unixepoch() END`,
    )
    .bind(key, WINDOW_SEC)
    .run();
}

export async function clearFailures(db: D1Database, key: string): Promise<void> {
  await db.prepare("DELETE FROM admin_login_attempts WHERE ip = ?1").bind(key).run();
}

export const clientIp = (req: Request) => req.headers.get("cf-connecting-ip") ?? "local";
