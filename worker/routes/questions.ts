import { Hono } from "hono";
import { ANSWER_MAX, type InboxQuestion, type QuestionInbox, type QuestionTab } from "../../shared/questions";
import { isCourse, type Course } from "../../shared/validate";
import { requireAdmin, type AdminVars } from "../lib/adminSession";

// หลังบ้าน: กล่องคำถามจากนักเรียน (คำถามฝั่งนักเรียนอยู่ใน learn.ts)
export const questions = new Hono<{ Bindings: Env; Variables: AdminVars }>();

questions.use("/admin/questions", requireAdmin);
questions.use("/admin/questions/*", requireAdmin);

const TAB_WHERE: Record<QuestionTab, string> = {
  pending: "q.hidden = 0 AND q.answered_at IS NULL",
  answered: "q.hidden = 0 AND q.answered_at IS NOT NULL",
  hidden: "q.hidden = 1",
};
const isTab = (v: unknown): v is QuestionTab => typeof v === "string" && v in TAB_WHERE;
const LIST_LIMIT = 200;

type Row = {
  id: number;
  student_id: number;
  first_name: string;
  last_name: string;
  course: Course;
  video_id: number;
  video_title: string;
  youtube_id: string;
  position_sec: number | null;
  body: string;
  answer: string | null;
  answered_at: number | null;
  hidden: number;
  created_at: number;
};

const posInt = (v: string) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

// ตัวเลขบนเมนู "คำถาม"
questions.get("/admin/questions/pending-count", async (c) => {
  const r = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM questions q WHERE ${TAB_WHERE.pending}`).first<{ n: number }>();
  return c.json({ pending: r?.n ?? 0 });
});

questions.get("/admin/questions", async (c) => {
  const tab = c.req.query("tab") ?? "pending";
  const course = c.req.query("course") || null;
  if (!isTab(tab) || (course !== null && !isCourse(course))) return c.json({ error: "validation" }, 400);
  const courseWhere = course ? "AND s.course = ?1" : "";
  const from = `FROM questions q JOIN students s ON s.id = q.student_id JOIN videos v ON v.id = q.video_id`;
  const args = course ? [course] : [];
  const db = c.env.DB;
  const [list, counts] = await db.batch([
    db
      .prepare(
        `SELECT q.id, q.student_id, s.first_name, s.last_name, s.course, q.video_id, v.title AS video_title, v.youtube_id,
                q.position_sec, q.body, q.answer, q.answered_at, q.hidden, q.created_at
         ${from} WHERE ${TAB_WHERE[tab]} ${courseWhere}
         ORDER BY ${tab === "pending" ? "q.created_at ASC" : "COALESCE(q.answered_at, q.created_at) DESC"}, q.id
         LIMIT ${LIST_LIMIT}`,
      )
      .bind(...args),
    db
      .prepare(
        `SELECT ${(Object.keys(TAB_WHERE) as QuestionTab[]).map((t) => `SUM(CASE WHEN ${TAB_WHERE[t]} THEN 1 ELSE 0 END) AS ${t}`).join(", ")}
         ${from} WHERE 1 = 1 ${courseWhere}`,
      )
      .bind(...args),
  ]);
  const n = (counts.results[0] ?? {}) as Record<QuestionTab, number | null>;
  const body: QuestionInbox = {
    questions: (list.results as Row[]).map(
      (r): InboxQuestion => ({
        id: r.id,
        studentId: r.student_id,
        studentName: `${r.first_name} ${r.last_name}`,
        course: r.course,
        videoId: r.video_id,
        videoTitle: r.video_title,
        youtubeId: r.youtube_id,
        positionSec: r.position_sec,
        body: r.body,
        answer: r.answer,
        answeredAt: r.answered_at,
        hidden: r.hidden === 1,
        createdAt: r.created_at,
      }),
    ),
    counts: { pending: n.pending ?? 0, answered: n.answered ?? 0, hidden: n.hidden ?? 0 },
  };
  return c.json(body);
});

// ตอบ / แก้คำตอบ (ข้อความว่าง = ลบคำตอบ กลับไปรอตอบ)
questions.post("/admin/questions/:id/answer", async (c) => {
  const id = posInt(c.req.param("id"));
  const b = ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const answer = typeof b.answer === "string" ? b.answer.trim().replace(/\r\n/g, "\n") : null;
  if (!id || answer === null) return c.json({ error: "validation" }, 400);
  if (answer.length > ANSWER_MAX) return c.json({ error: "validation", message: `คำตอบยาวเกิน ${ANSWER_MAX} ตัวอักษร` }, 400);
  const r = await c.env.DB.prepare(
    "UPDATE questions SET answer = ?1, answered_at = CASE WHEN ?1 IS NULL THEN NULL ELSE unixepoch() END WHERE id = ?2",
  )
    .bind(answer || null, id)
    .run();
  if (!r.meta.changes) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});

// ซ่อนจากเพื่อนในห้อง / เลิกซ่อน
questions.post("/admin/questions/:id/hidden", async (c) => {
  const id = posInt(c.req.param("id"));
  const b = ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  if (!id || typeof b.hidden !== "boolean") return c.json({ error: "validation" }, 400);
  const r = await c.env.DB.prepare("UPDATE questions SET hidden = ?1 WHERE id = ?2").bind(b.hidden ? 1 : 0, id).run();
  if (!r.meta.changes) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});
