import { Hono } from "hono";
import {
  ANNOUNCE_BODY_MAX,
  ANNOUNCE_TITLE_MAX,
  isAnnounceTarget,
  targetsFor,
  type Announcement,
  type AnnounceTarget,
} from "../../shared/announcements";
import type { Course } from "../../shared/validate";
import { requireAdmin, type AdminVars } from "../lib/adminSession";
import { currentStudentId } from "../lib/session";

export const announcements = new Hono<{ Bindings: Env; Variables: AdminVars }>();

type Row = { id: number; target: AnnounceTarget; title: string; body: string; created_at: number; updated_at: number };
const toAnn = (r: Row): Announcement => ({
  id: r.id,
  target: r.target,
  title: r.title,
  body: r.body,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
const COLS = "id, target, title, body, created_at, updated_at";
const STUDENT_LIMIT = 20;

// นักเรียน (ทุกสถานะ รวมรอยืนยัน): ประกาศถึงทุกคน + คอร์สตัวเอง
announcements.get("/announcements", async (c) => {
  const id = await currentStudentId(c);
  if (id === null) return c.json({ error: "unauthorized" }, 401);
  const s = await c.env.DB.prepare("SELECT course FROM students WHERE id = ?1").bind(id).first<{ course: Course }>();
  if (!s) return c.json({ error: "unauthorized" }, 401);
  const [t1, t2] = targetsFor(s.course);
  const { results } = await c.env.DB.prepare(
    `SELECT ${COLS} FROM announcements WHERE target IN (?1, ?2) ORDER BY created_at DESC, id DESC LIMIT ?3`,
  )
    .bind(t1, t2, STUDENT_LIMIT)
    .all<Row>();
  return c.json({ announcements: results.map(toAnn) });
});

// ---------- ครู ----------

announcements.use("/admin/announcements", requireAdmin);
announcements.use("/admin/announcements/*", requireAdmin);

async function readInput(req: Request): Promise<{ data?: { target: AnnounceTarget; title: string; body: string }; error?: string }> {
  const b = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const title = typeof b.title === "string" ? b.title.trim().replace(/\s+/g, " ") : "";
  const body = typeof b.body === "string" ? b.body.trim().replace(/\r\n/g, "\n") : "";
  if (!isAnnounceTarget(b.target)) return { error: "กรุณาเลือกผู้รับประกาศ" };
  if (!title) return { error: "กรุณากรอกหัวข้อ" };
  if (title.length > ANNOUNCE_TITLE_MAX) return { error: "หัวข้อยาวเกินไป" };
  if (!body) return { error: "กรุณากรอกข้อความ" };
  if (body.length > ANNOUNCE_BODY_MAX) return { error: `ข้อความยาวเกิน ${ANNOUNCE_BODY_MAX} ตัวอักษร` };
  return { data: { target: b.target, title, body } };
}

const listAll = async (db: D1Database) => {
  const { results } = await db.prepare(`SELECT ${COLS} FROM announcements ORDER BY created_at DESC, id DESC`).all<Row>();
  return { announcements: results.map(toAnn) };
};

const posInt = (v: string) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

announcements.get("/admin/announcements", async (c) => c.json(await listAll(c.env.DB)));

announcements.post("/admin/announcements", async (c) => {
  const { data, error } = await readInput(c.req.raw);
  if (!data) return c.json({ error: "validation", message: error }, 400);
  await c.env.DB.prepare("INSERT INTO announcements (target, title, body) VALUES (?1, ?2, ?3)")
    .bind(data.target, data.title, data.body)
    .run();
  return c.json(await listAll(c.env.DB), 201);
});

announcements.post("/admin/announcements/:id", async (c) => {
  const id = posInt(c.req.param("id"));
  const { data, error } = await readInput(c.req.raw);
  if (!id) return c.json({ error: "not_found" }, 404);
  if (!data) return c.json({ error: "validation", message: error }, 400);
  const r = await c.env.DB.prepare(
    "UPDATE announcements SET target = ?1, title = ?2, body = ?3, updated_at = unixepoch() WHERE id = ?4",
  )
    .bind(data.target, data.title, data.body, id)
    .run();
  if (!r.meta.changes) return c.json({ error: "not_found" }, 404);
  return c.json(await listAll(c.env.DB));
});

announcements.post("/admin/announcements/:id/delete", async (c) => {
  const id = posInt(c.req.param("id"));
  if (!id) return c.json({ error: "not_found" }, 404);
  await c.env.DB.prepare("DELETE FROM announcements WHERE id = ?1").bind(id).run();
  return c.json(await listAll(c.env.DB));
});
