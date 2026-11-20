-- หน้าแรกแบบแอป: เวลาดูรายวัน (เก็บ 8 วัน) + นักเรียนเห็นคำตอบแล้วหรือยัง
CREATE TABLE watch_daily (
  student_id  INTEGER NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  day         TEXT NOT NULL, -- 'YYYY-MM-DD' ตามเวลาไทย
  seconds     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (student_id, day)
);
ALTER TABLE questions ADD COLUMN answer_seen_at INTEGER;
-- คำตอบที่มีอยู่แล้ว ถือว่าเห็นแล้ว (ไม่ขึ้นเป็น "ใหม่" ทันทีที่ขึ้นเว็บ)
UPDATE questions SET answer_seen_at = answered_at WHERE answered_at IS NOT NULL;
