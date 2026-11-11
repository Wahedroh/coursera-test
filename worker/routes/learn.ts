import { Hono, type MiddlewareHandler } from "hono";
import { percentOf, type CourseChapter, type CourseOutline, type WatchVideo } from "../../shared/content";
import { QUESTION_MAX, QUESTIONS_PER_DAY, type ClipQuestion, type ClipQuestions } from "../../shared/questions";
import type { Course } from "../../shared/validate";
import { DOC_COLUMNS, DOC_ORDER, toDocInfo, type DocRow } from "../lib/documents";
import { currentStudentId } from "../lib/session";

// ฝั่งนักเรียน: รายการบท-คลิป, ข้อมูลคลิป, บันทึกความคืบหน้า (ต้องเป็นนักเรียนที่ครูยืนยันแล้ว)

type Vars = { studentId: number; course: Course };
export const learn = new Hono<{ Bindings: Env; Variables: Vars }>();

const requireApproved: MiddlewareHandler<{ Bindings: Env; Variables: Vars }> = async (c, next) => {
  const id = await currentStudentId(c);
  if (id === null) return c.json({ error: "unauthorized" }, 401);
  const s = await c.env.DB.prepare("SELECT status, course FROM students WHERE id = ?1")
    .bind(id)
    .first<{ status: string; course: Course }>();
  if (!s) return c.json({ error: "unauthorized" }, 401);
  if (s.status !== "approved") return c.json({ error: "not_approved" }, 403);
  c.set("studentId", id);
  c.set("course", s.course);
  await next();
};

learn.use("/course", requireApproved);
learn.use("/videos/*", requireApproved);

type VideoRow = {
  id: number;
  chapter_id: number;
  chapter_title: string;
  title: string;
  duration_sec: number | null;
  last_position_sec: number | null;
  max_position_sec: number | null;
  last_watched_at: number | null;
  is_new: number;
};

/** คลิปที่เพิ่มมาไม่เกินกี่วินาที นับเป็น "ใหม่" (7 วัน) */
const NEW_VIDEO_SEC = 7 * 24 * 60 * 60;

learn.get("/course", async (c) => {
  const course = c.get("course");
  const [ch, vi] = await c.env.DB.batch([
    c.env.DB.prepare("SELECT id, title FROM chapters WHERE course = ?1 ORDER BY sort_order, id").bind(course),
    c.env.DB.prepare(
      `SELECT v.id, v.chapter_id, c.title AS chapter_title, v.title, v.duration_sec,
              p.last_position_sec, p.max_position_sec, p.last_watched_at,
              (p.student_id IS NULL AND v.created_at > unixepoch() - ${NEW_VIDEO_SEC}) AS is_new
       FROM videos v JOIN chapters c ON c.id = v.chapter_id
       LEFT JOIN progress p ON p.video_id = v.id AND p.student_id = ?2
       WHERE c.course = ?1 ORDER BY v.sort_order, v.id`,
    ).bind(course, c.get("studentId")),
  ]);
  const chapters: CourseChapter[] = (ch.results as { id: number; title: string }[]).map((x) => ({ ...x, videos: [] }));
  const byId = new Map(chapters.map((x) => [x.id, x]));
  let resume: CourseOutline["resume"] = null;
  let latest = 0;
  for (const v of vi.results as VideoRow[]) {
    const percent = percentOf(v.max_position_sec ?? 0, v.duration_sec);
    const last = v.last_position_sec ?? 0;
    byId.get(v.chapter_id)?.videos.push({
      id: v.id,
      title: v.title,
      durationSec: v.duration_sec,
      percent,
      lastPositionSec: last,
      isNew: v.is_new === 1,
    });
    if (v.last_watched_at && v.last_watched_at > latest) {
      latest = v.last_watched_at;
      resume = { videoId: v.id, title: v.title, lastPositionSec: last, percent };
    }
  }
  const body: CourseOutline = { course, chapters, resume };
  return c.json(body);
});

const posInt = (v: string) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

learn.get("/videos/:id", async (c) => {
  const id = posInt(c.req.param("id"));
  if (!id) return c.json({ error: "not_found" }, 404);
  const course = c.get("course");
  // ลำดับคลิปทั้งคอร์ส เพื่อหาคลิปก่อน/ถัดไป
  const { results } = await c.env.DB.prepare(
    `SELECT v.id, v.title, v.youtube_id, v.duration_sec, c.title AS chapter_title, p.last_position_sec
     FROM videos v JOIN chapters c ON c.id = v.chapter_id
     LEFT JOIN progress p ON p.video_id = v.id AND p.student_id = ?2
     WHERE c.course = ?1 ORDER BY c.sort_order, c.id, v.sort_order, v.id`,
  )
    .bind(course, c.get("studentId"))
    .all<{ id: number; title: string; youtube_id: string; duration_sec: number | null; chapter_title: string; last_position_sec: number | null }>();
  const i = results.findIndex((v) => v.id === id);
  // คลิปของคอร์สอื่น = ไม่พบ
  if (i < 0) return c.json({ error: "not_found" }, 404);
  const v = results[i];
  const { results: docs } = await c.env.DB.prepare(`SELECT ${DOC_COLUMNS} FROM documents d WHERE d.video_id = ?1 ORDER BY ${DOC_ORDER}`)
    .bind(id)
    .all<DocRow>();
  const body: WatchVideo = {
    id: v.id,
    title: v.title,
    chapterTitle: v.chapter_title,
    youtubeId: v.youtube_id,
    durationSec: v.duration_sec,
    lastPositionSec: v.last_position_sec ?? 0,
    prevId: results[i - 1]?.id ?? null,
    nextId: results[i + 1]?.id ?? null,
    documents: docs.map(toDocInfo),
  };
  return c.json(body);
});

// บันทึกความคืบหน้า: 1 แถวต่อ นักเรียน × คลิป (เขียนทับ)
learn.post("/videos/:id/progress", async (c) => {
  const id = posInt(c.req.param("id"));
  const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
  const position = num(b?.position);
  const delta = num(b?.delta);
  const duration = num(b?.duration);
  if (!id || position === null || delta === null) return c.json({ error: "validation" }, 400);

  const owned = await c.env.DB.prepare(
    "SELECT v.duration_sec FROM videos v JOIN chapters c ON c.id = v.chapter_id WHERE v.id = ?1 AND c.course = ?2",
  )
    .bind(id, c.get("course"))
    .first<{ duration_sec: number | null }>();
  if (!owned) return c.json({ error: "not_found" }, 404);

  const dur = owned.duration_sec ?? (duration && duration > 0 ? Math.round(duration) : null);
  const pos = Math.round(dur ? Math.min(position, dur) : position);
  const add = Math.round(Math.min(delta, 60)); // กันค่าเวลาดูที่ผิดปกติ (บันทึกทุก ~15 วินาที)

  const stmts = [
    c.env.DB.prepare(
      `INSERT INTO progress (student_id, video_id, last_position_sec, max_position_sec, watch_seconds, last_watched_at)
       VALUES (?1, ?2, ?3, ?3, ?4, unixepoch())
       ON CONFLICT (student_id, video_id) DO UPDATE SET
         last_position_sec = excluded.last_position_sec,
         max_position_sec = MAX(max_position_sec, excluded.max_position_sec),
         watch_seconds = watch_seconds + excluded.watch_seconds,
         last_watched_at = unixepoch()`,
    ).bind(c.get("studentId"), id, pos, add),
  ];
  // ความยาวคลิปยังไม่รู้ → ใช้ค่าที่ตัวเล่นรายงานมา
  if (owned.duration_sec === null && dur) {
    stmts.push(c.env.DB.prepare("UPDATE videos SET duration_sec = ?1 WHERE id = ?2 AND duration_sec IS NULL").bind(dur, id));
  }
  await c.env.DB.batch(stmts);
  return c.json({ ok: true });
});

// ---------- ถามครูใต้คลิป ----------

/** เวลาเริ่มวันนี้ตามเวลาไทย (นับโควตาคำถามต่อวัน) */
const TODAY_TH = "unixepoch('now', '+7 hours', 'start of day', '-7 hours')";
const QUESTION_LIMIT = 100;

const ownsVideo = (db: D1Database, id: number, course: Course) =>
  db
    .prepare("SELECT v.id FROM videos v JOIN chapters c ON c.id = v.chapter_id WHERE v.id = ?1 AND c.course = ?2")
    .bind(id, course)
    .first();

const remainingToday = async (db: D1Database, studentId: number) => {
  const r = await db
    .prepare(`SELECT COUNT(*) AS n FROM questions WHERE student_id = ?1 AND created_at >= ${TODAY_TH}`)
    .bind(studentId)
    .first<{ n: number }>();
  return Math.max(0, QUESTIONS_PER_DAY - (r?.n ?? 0));
};

// คำถามของคลิปนี้: ของตัวเอง + ของเพื่อน (ไม่ส่งชื่อผู้ถาม, ที่ครูซ่อนเห็นเฉพาะเจ้าของ)
learn.get("/videos/:id/questions", async (c) => {
  const id = posInt(c.req.param("id"));
  const me = c.get("studentId");
  if (!id || !(await ownsVideo(c.env.DB, id, c.get("course")))) return c.json({ error: "not_found" }, 404);
  const { results } = await c.env.DB.prepare(
    `SELECT id, position_sec, body, answer, answered_at, hidden, created_at, student_id = ?2 AS mine
     FROM questions WHERE video_id = ?1 AND (hidden = 0 OR student_id = ?2)
     ORDER BY created_at DESC, id DESC LIMIT ${QUESTION_LIMIT}`,
  )
    .bind(id, me)
    .all<{ id: number; position_sec: number | null; body: string; answer: string | null; answered_at: number | null; hidden: number; created_at: number; mine: number }>();
  const body: ClipQuestions = {
    questions: results.map(
      (r): ClipQuestion => ({
        id: r.id,
        positionSec: r.position_sec,
        body: r.body,
        answer: r.answer,
        answeredAt: r.answered_at,
        createdAt: r.created_at,
        mine: r.mine === 1,
        hidden: r.hidden === 1,
      }),
    ),
    remainingToday: await remainingToday(c.env.DB, me),
  };
  return c.json(body);
});

learn.post("/videos/:id/questions", async (c) => {
  const id = posInt(c.req.param("id"));
  const me = c.get("studentId");
  const b = ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const text = typeof b.body === "string" ? b.body.trim().replace(/\r\n/g, "\n") : "";
  const pos = b.positionSec === null || b.positionSec === undefined ? null : Number(b.positionSec);
  if (!id) return c.json({ error: "validation" }, 400);
  if (!text) return c.json({ error: "validation", message: "กรุณาพิมพ์คำถาม" }, 400);
  if (text.length > QUESTION_MAX) return c.json({ error: "validation", message: `คำถามยาวเกิน ${QUESTION_MAX} ตัวอักษร` }, 400);
  if (pos !== null && !(Number.isFinite(pos) && pos >= 0 && pos < 24 * 3600)) return c.json({ error: "validation" }, 400);
  if (!(await ownsVideo(c.env.DB, id, c.get("course")))) return c.json({ error: "not_found" }, 404);
  // ใส่แถวใหม่เฉพาะเมื่อยังไม่ครบโควตาวันนี้ (ตรวจในคำสั่งเดียว กันกดส่งพร้อมกันหลายครั้ง)
  const r = await c.env.DB.prepare(
    `INSERT INTO questions (student_id, video_id, position_sec, body)
     SELECT ?1, ?2, ?3, ?4
     WHERE (SELECT COUNT(*) FROM questions WHERE student_id = ?1 AND created_at >= ${TODAY_TH}) < ?5`,
  )
    .bind(me, id, pos === null ? null : Math.floor(pos), text, QUESTIONS_PER_DAY)
    .run();
  if (!r.meta.changes) {
    return c.json({ error: "limit", message: `วันนี้ถามครบ ${QUESTIONS_PER_DAY} ข้อแล้ว พรุ่งนี้ถามได้อีกนะ` }, 429);
  }
  return c.json({ ok: true, remainingToday: await remainingToday(c.env.DB, me) });
});
