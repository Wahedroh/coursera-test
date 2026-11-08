-- เข้าด้วย Facebook ครั้งแรก: พักตัวตน Facebook ไว้ระหว่างนักเรียนกรอกโปรไฟล์ (หมดอายุ 30 นาที)
-- id = SHA-256 ของ token ใน cookie
CREATE TABLE oauth_pending (
  id                TEXT    PRIMARY KEY,
  provider          TEXT    NOT NULL CHECK (provider IN ('facebook')),
  provider_user_id  TEXT    NOT NULL,
  display_name      TEXT,
  expires_at        INTEGER NOT NULL
);
