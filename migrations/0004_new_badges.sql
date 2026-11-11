-- ป้าย "ใหม่"
-- 1) คลิป: เก็บเวลาที่เพิ่มคลิป (คลิปเดิมถือว่าเพิ่มตอนนี้)
--    ALTER TABLE ใส่ค่าเริ่มต้นแบบ unixepoch() ไม่ได้ จึงตั้งค่าตอนเพิ่มคลิปในโค้ด
ALTER TABLE videos ADD COLUMN created_at INTEGER;
UPDATE videos SET created_at = unixepoch();

-- 2) ประกาศ: เวลาที่นักเรียนเห็นประกาศล่าสุด (ประกาศหลังเวลานี้ = ใหม่)
--    นักเรียนเดิมถือว่าเห็นประกาศเดิมแล้ว นักเรียนใหม่ (ค่า 0) เห็นทุกประกาศเป็นของใหม่
ALTER TABLE students ADD COLUMN announcements_seen_at INTEGER NOT NULL DEFAULT 0;
UPDATE students SET announcements_seen_at = unixepoch();
