-- 1) เอกสารเปลี่ยนจากไฟล์ PDF ใน R2 เป็นลิงก์ OneDrive
--    (ตอนเปลี่ยนยังไม่มีเอกสารในระบบจริง แถวเดิมที่เป็นไฟล์ R2 ไม่ย้ายมา)
CREATE TABLE documents_new (
  id          INTEGER PRIMARY KEY,
  video_id    INTEGER NOT NULL REFERENCES videos (id) ON DELETE CASCADE,
  kind        TEXT    NOT NULL CHECK (kind IN ('handout', 'class_notes')),
  title       TEXT    NOT NULL,
  url         TEXT    NOT NULL CHECK (url LIKE 'https://%'),
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
DROP TABLE documents;
ALTER TABLE documents_new RENAME TO documents;
CREATE INDEX idx_documents_video ON documents (video_id);

-- 2) จำกัดการเดารหัสผ่านครู: นับครั้งที่ใส่ผิดต่อ IP
CREATE TABLE admin_login_attempts (
  ip            TEXT    PRIMARY KEY,
  failures      INTEGER NOT NULL DEFAULT 0,
  window_start  INTEGER NOT NULL
) WITHOUT ROWID;
