-- เอกสารเรียนของคอร์ส (ลิงก์ OneDrive ไม่ผูกกับคลิป): ม.1&2 / ม.4 / ทุกคอร์ส
CREATE TABLE course_docs (
  id          INTEGER PRIMARY KEY,
  target      TEXT NOT NULL CHECK (target IN ('all', 'm12', 'm4')),
  title       TEXT NOT NULL,
  url         TEXT NOT NULL CHECK (url LIKE 'https://%'),
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX course_docs_target ON course_docs (target, id);
