-- โครงสร้างฐานข้อมูลเริ่มต้น (ดู docs/PLAN.md หัวข้อ 7)
-- เวลาทั้งหมดเก็บเป็น unix seconds

CREATE TABLE students (
  id             INTEGER PRIMARY KEY,
  first_name     TEXT    NOT NULL,
  last_name      TEXT    NOT NULL,
  school         TEXT    NOT NULL,
  student_phone  TEXT    NOT NULL UNIQUE
                 CHECK (student_phone GLOB '0[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),
  parent_phone   TEXT    NOT NULL
                 CHECK (parent_phone GLOB '0[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),
  course         TEXT    NOT NULL CHECK (course IN ('m12', 'm4')),
  status         TEXT    NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  password_hash  TEXT,                       -- NULL เมื่อสมัครด้วย Facebook
  consent_at     INTEGER NOT NULL,           -- เวลาที่ติ๊กยินยอม PDPA
  academic_year  INTEGER NOT NULL,           -- ปีการศึกษา (พ.ศ.) ใช้กับปุ่มปิดปีการศึกษา
  created_at     INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at     INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_students_course_status ON students (course, status);
CREATE INDEX idx_students_year ON students (academic_year);

CREATE TABLE oauth_accounts (
  id                INTEGER PRIMARY KEY,
  student_id        INTEGER NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  provider          TEXT    NOT NULL CHECK (provider IN ('facebook')),
  provider_user_id  TEXT    NOT NULL,
  UNIQUE (provider, provider_user_id)
);
CREATE INDEX idx_oauth_student ON oauth_accounts (student_id);

-- 1 บัญชีเข้าได้ทีละ 1 เครื่อง: student_id เป็น UNIQUE
-- id = SHA-256 ของ token ใน cookie (ไม่เก็บ token ตรง ๆ)
CREATE TABLE sessions (
  id          TEXT    PRIMARY KEY,
  student_id  INTEGER NOT NULL UNIQUE REFERENCES students (id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at  INTEGER NOT NULL
);

-- ครูเข้าด้วย Facebook: เก็บ Facebook user ID ของครู (ต้องอยู่ใน ADMIN_FACEBOOK_IDS)
CREATE TABLE admin_sessions (
  id                TEXT    PRIMARY KEY,
  facebook_user_id  TEXT    NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at  INTEGER NOT NULL
);

-- รายชื่อโรงเรียนที่เคยกรอก ใช้เด้งให้เลือก
CREATE TABLE schools (
  name  TEXT PRIMARY KEY
) WITHOUT ROWID;

CREATE TABLE chapters (
  id          INTEGER PRIMARY KEY,
  course      TEXT    NOT NULL CHECK (course IN ('m12', 'm4')),
  title       TEXT    NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_chapters_course ON chapters (course, sort_order);

CREATE TABLE videos (
  id            INTEGER PRIMARY KEY,
  chapter_id    INTEGER NOT NULL REFERENCES chapters (id) ON DELETE CASCADE,
  title         TEXT    NOT NULL,
  youtube_id    TEXT    NOT NULL CHECK (length(youtube_id) = 11),
  duration_sec  INTEGER,
  sort_order    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_videos_chapter ON videos (chapter_id, sort_order);

CREATE TABLE documents (
  id          INTEGER PRIMARY KEY,
  video_id    INTEGER NOT NULL REFERENCES videos (id) ON DELETE CASCADE,
  kind        TEXT    NOT NULL CHECK (kind IN ('handout', 'class_notes')),
  r2_key      TEXT    NOT NULL UNIQUE,
  filename    TEXT    NOT NULL,
  size_bytes  INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),  -- ≤ 10MB
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_documents_video ON documents (video_id);

-- 1 แถวต่อ นักเรียน × คลิป เขียนทับ (ไม่เก็บประวัติทุกครั้ง)
CREATE TABLE progress (
  student_id         INTEGER NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  video_id           INTEGER NOT NULL REFERENCES videos (id) ON DELETE CASCADE,
  last_position_sec  INTEGER NOT NULL DEFAULT 0,
  max_position_sec   INTEGER NOT NULL DEFAULT 0,
  watch_seconds      INTEGER NOT NULL DEFAULT 0,
  last_watched_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (student_id, video_id)
) WITHOUT ROWID;
CREATE INDEX idx_progress_video ON progress (video_id);

CREATE TABLE announcements (
  id          INTEGER PRIMARY KEY,
  target      TEXT    NOT NULL CHECK (target IN ('all', 'm12', 'm4')),
  title       TEXT    NOT NULL,
  body        TEXT    NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_announcements_created ON announcements (created_at DESC);
