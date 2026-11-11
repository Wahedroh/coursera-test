-- คำถามใต้คลิป: นักเรียนถาม ครูตอบ เพื่อนในคอร์สเห็นด้วย (ไม่แสดงชื่อผู้ถาม)
CREATE TABLE questions (
  id            INTEGER PRIMARY KEY,
  student_id    INTEGER NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  video_id      INTEGER NOT NULL REFERENCES videos (id) ON DELETE CASCADE,
  position_sec  INTEGER,
  body          TEXT NOT NULL,
  answer        TEXT,
  answered_at   INTEGER,
  hidden        INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1)),
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX questions_video ON questions (video_id, created_at);
CREATE INDEX questions_student ON questions (student_id, created_at);
CREATE INDEX questions_pending ON questions (answered_at, hidden);
