import { Hono } from "hono";
import { parseYouTubeId, TITLE_MAX, type AdminChapter, type AdminContent } from "../../shared/content";
import { isCourse, type Course } from "../../shared/validate";
import { requireAdmin, type AdminVars } from "../lib/adminSession";

// หลังบ้าน: บทและคลิป
export const adminContent = new Hono<{ Bindings: Env; Variables: AdminVars }>();

adminContent.use("/admin/content", requireAdmin);
adminContent.use("/admin/chapters", requireAdmin);
adminContent.use("/admin/chapters/*", requireAdmin);
adminContent.use("/admin/videos", requireAdmin);
adminContent.use("/admin/videos/*", requireAdmin);

async function readJson(req: Request): Promise<Record<string, unknown>> {
  const v = await req.json().catch(() => null);
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}
const posInt = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const cleanTitle = (v: unknown): string | null => {
  const t = typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
  return t && t.length <= TITLE_MAX ? t : null;
};
const bad = (message: string) => ({ error: "validation", message });

async function loadContent(db: D1Database, course: Course): Promise<AdminContent> {
  const [ch, vi] = await db.batch([
    db.prepare("SELECT id, title FROM chapters WHERE course = ?1 ORDER BY sort_order, id").bind(course),
    db
      .prepare(
        `SELECT v.id, v.chapter_id, v.title, v.youtube_id, v.duration_sec FROM videos v
         JOIN chapters c ON c.id = v.chapter_id WHERE c.course = ?1 ORDER BY v.sort_order, v.id`,
      )
      .bind(course),
  ]);
  const chapters: AdminChapter[] = (ch.results as { id: number; title: string }[]).map((c) => ({ ...c, videos: [] }));
  const byId = new Map(chapters.map((c) => [c.id, c]));
  for (const v of vi.results as { id: number; chapter_id: number; title: string; youtube_id: string; duration_sec: number | null }[]) {
    byId.get(v.chapter_id)?.videos.push({ id: v.id, title: v.title, youtubeId: v.youtube_id, durationSec: v.duration_sec });
  }
  return { course, chapters };
}

async function chapterCourse(db: D1Database, chapterId: number): Promise<Course | null> {
  const r = await db.prepare("SELECT course FROM chapters WHERE id = ?1").bind(chapterId).first<{ course: Course }>();
  return r?.course ?? null;
}

adminContent.get("/admin/content", async (c) => {
  const course = c.req.query("course") ?? "";
  if (!isCourse(course)) return c.json(bad("คอร์สไม่ถูกต้อง"), 400);
  return c.json(await loadContent(c.env.DB, course));
});

// ---------- บท ----------

adminContent.post("/admin/chapters", async (c) => {
  const b = await readJson(c.req.raw);
  const title = cleanTitle(b.title);
  if (typeof b.course !== "string" || !isCourse(b.course)) return c.json(bad("คอร์สไม่ถูกต้อง"), 400);
  if (!title) return c.json(bad("กรุณากรอกชื่อบท"), 400);
  await c.env.DB.prepare(
    `INSERT INTO chapters (course, title, sort_order)
     VALUES (?1, ?2, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM chapters WHERE course = ?1))`,
  )
    .bind(b.course, title)
    .run();
  return c.json(await loadContent(c.env.DB, b.course), 201);
});

// เรียงบทใหม่: ids = ลำดับใหม่ของบททั้งหมดในคอร์ส
adminContent.post("/admin/chapters/reorder", async (c) => {
  const b = await readJson(c.req.raw);
  if (typeof b.course !== "string" || !isCourse(b.course)) return c.json(bad("คอร์สไม่ถูกต้อง"), 400);
  const ids = Array.isArray(b.ids) ? b.ids.map(posInt) : [];
  if (!ids.length || ids.some((x) => x === null)) return c.json(bad("ลำดับไม่ถูกต้อง"), 400);
  await c.env.DB.batch(
    ids.map((id, i) => c.env.DB.prepare("UPDATE chapters SET sort_order = ?1 WHERE id = ?2 AND course = ?3").bind(i, id, b.course)),
  );
  return c.json(await loadContent(c.env.DB, b.course));
});

adminContent.post("/admin/chapters/:id", async (c) => {
  const id = posInt(c.req.param("id"));
  const title = cleanTitle((await readJson(c.req.raw)).title);
  if (!id || !title) return c.json(bad("กรุณากรอกชื่อบท"), 400);
  const course = await chapterCourse(c.env.DB, id);
  if (!course) return c.json({ error: "not_found" }, 404);
  await c.env.DB.prepare("UPDATE chapters SET title = ?1 WHERE id = ?2").bind(title, id).run();
  return c.json(await loadContent(c.env.DB, course));
});

// ลบบท = ลบคลิป เอกสาร และความคืบหน้าในบทนั้นด้วย (ON DELETE CASCADE)
adminContent.post("/admin/chapters/:id/delete", async (c) => {
  const id = posInt(c.req.param("id"));
  if (!id) return c.json(bad("ไม่พบบท"), 400);
  const course = await chapterCourse(c.env.DB, id);
  if (!course) return c.json({ error: "not_found" }, 404);
  await c.env.DB.prepare("DELETE FROM chapters WHERE id = ?1").bind(id).run();
  return c.json(await loadContent(c.env.DB, course));
});

// เรียงคลิปในบทใหม่
adminContent.post("/admin/chapters/:id/videos/reorder", async (c) => {
  const id = posInt(c.req.param("id"));
  const b = await readJson(c.req.raw);
  const ids = Array.isArray(b.ids) ? b.ids.map(posInt) : [];
  if (!id || !ids.length || ids.some((x) => x === null)) return c.json(bad("ลำดับไม่ถูกต้อง"), 400);
  const course = await chapterCourse(c.env.DB, id);
  if (!course) return c.json({ error: "not_found" }, 404);
  await c.env.DB.batch(
    ids.map((vid, i) => c.env.DB.prepare("UPDATE videos SET sort_order = ?1 WHERE id = ?2 AND chapter_id = ?3").bind(i, vid, id)),
  );
  return c.json(await loadContent(c.env.DB, course));
});

// ---------- คลิป ----------

adminContent.post("/admin/videos", async (c) => {
  const b = await readJson(c.req.raw);
  const chapterId = posInt(b.chapterId);
  const title = cleanTitle(b.title);
  const youtubeId = typeof b.youtube === "string" ? parseYouTubeId(b.youtube) : null;
  if (!chapterId) return c.json(bad("ไม่พบบท"), 400);
  if (!title) return c.json(bad("กรุณากรอกชื่อคลิป"), 400);
  if (!youtubeId) return c.json(bad("ลิงก์ YouTube ไม่ถูกต้อง"), 400);
  const course = await chapterCourse(c.env.DB, chapterId);
  if (!course) return c.json({ error: "not_found" }, 404);
  await c.env.DB.prepare(
    `INSERT INTO videos (chapter_id, title, youtube_id, sort_order)
     VALUES (?1, ?2, ?3, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM videos WHERE chapter_id = ?1))`,
  )
    .bind(chapterId, title, youtubeId)
    .run();
  return c.json(await loadContent(c.env.DB, course), 201);
});

adminContent.post("/admin/videos/:id", async (c) => {
  const id = posInt(c.req.param("id"));
  const b = await readJson(c.req.raw);
  const title = cleanTitle(b.title);
  const youtubeId = typeof b.youtube === "string" ? parseYouTubeId(b.youtube) : null;
  if (!id) return c.json(bad("ไม่พบคลิป"), 400);
  if (!title) return c.json(bad("กรุณากรอกชื่อคลิป"), 400);
  if (!youtubeId) return c.json(bad("ลิงก์ YouTube ไม่ถูกต้อง"), 400);
  const row = await c.env.DB.prepare(
    `UPDATE videos SET title = ?1,
       duration_sec = CASE WHEN youtube_id = ?2 THEN duration_sec ELSE NULL END,
       youtube_id = ?2
     WHERE id = ?3 RETURNING chapter_id`,
  )
    .bind(title, youtubeId, id)
    .first<{ chapter_id: number }>();
  if (!row) return c.json({ error: "not_found" }, 404);
  return c.json(await loadContent(c.env.DB, (await chapterCourse(c.env.DB, row.chapter_id))!));
});

adminContent.post("/admin/videos/:id/delete", async (c) => {
  const id = posInt(c.req.param("id"));
  if (!id) return c.json(bad("ไม่พบคลิป"), 400);
  const row = await c.env.DB.prepare("DELETE FROM videos WHERE id = ?1 RETURNING chapter_id").bind(id).first<{ chapter_id: number }>();
  if (!row) return c.json({ error: "not_found" }, 404);
  return c.json(await loadContent(c.env.DB, (await chapterCourse(c.env.DB, row.chapter_id))!));
});
