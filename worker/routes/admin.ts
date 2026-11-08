import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import {
  ADMIN_PAGE_SIZE,
  isStatus,
  STATUSES,
  type AdminStudent,
  type AdminStudentList,
  type ProgressChapter,
  type StudentProgress,
} from "../../shared/admin";
import { percentOf } from "../../shared/content";
import { isCourse, PASSWORD_MAX, PASSWORD_MIN, type StudentStatus } from "../../shared/validate";
import { adminIds, endAdminSession, requireAdmin, startAdminSession, type AdminVars } from "../lib/adminSession";
import { facebookAuthUrl, facebookConfigured, facebookUserFromCode } from "../lib/facebook";
import { hashPassword } from "../lib/password";
import { randomToken } from "../lib/session";

const STATE_COOKIE = "fb_admin_state";

export const admin = new Hono<{ Bindings: Env; Variables: AdminVars }>();

const callbackUrl = (reqUrl: string) => `${new URL(reqUrl).origin}/api/admin/auth/callback`;

// ---------- เข้าสู่ระบบด้วย Facebook ----------

admin.get("/admin/auth/facebook", (c) => {
  // ADMIN_FACEBOOK_IDS ว่างได้: เข้าครั้งแรกเพื่อดู ID ของตัวเอง
  if (!facebookConfigured(c.env)) return c.redirect("/admin/login?error=config");
  const state = randomToken();
  setCookie(c, STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/api/admin/auth",
    maxAge: 600,
  });
  return c.redirect(facebookAuthUrl(c.env, callbackUrl(c.req.url), state));
});

admin.get("/admin/auth/callback", async (c) => {
  const expected = getCookie(c, STATE_COOKIE);
  deleteCookie(c, STATE_COOKIE, { path: "/api/admin/auth", secure: true });
  if (c.req.query("error")) return c.redirect("/admin/login?error=cancelled");

  const code = c.req.query("code");
  const state = c.req.query("state");
  if (!code || !state || !expected || state !== expected) return c.redirect("/admin/login?error=failed");
  if (!facebookConfigured(c.env)) return c.redirect("/admin/login?error=config");

  let fbId: string;
  try {
    fbId = (await facebookUserFromCode(c.env, code, callbackUrl(c.req.url))).id;
  } catch (err) {
    console.error(err);
    return c.redirect("/admin/login?error=failed");
  }

  // ยังไม่อยู่ในรายชื่อครู: แสดง ID ให้นำไปใส่ใน ADMIN_FACEBOOK_IDS
  if (!adminIds(c.env).includes(fbId)) {
    return c.redirect(`/admin/login?error=denied&id=${encodeURIComponent(fbId)}`);
  }
  await startAdminSession(c, fbId);
  return c.redirect("/admin");
});

admin.post("/admin/logout", async (c) => {
  await endAdminSession(c);
  return c.json({ ok: true });
});

// ---------- ส่วนที่ต้องเป็นครู ----------

admin.use("/admin/me", requireAdmin);
admin.use("/admin/students", requireAdmin);
admin.use("/admin/students/*", requireAdmin);

admin.get("/admin/me", (c) => c.json({ facebookUserId: c.get("adminId") }));

type Row = {
  id: number;
  first_name: string;
  last_name: string;
  school: string;
  student_phone: string;
  parent_phone: string;
  course: AdminStudent["course"];
  status: StudentStatus;
  created_at: number;
  has_password: number;
};

const toStudent = (r: Row): AdminStudent => ({
  id: r.id,
  firstName: r.first_name,
  lastName: r.last_name,
  school: r.school,
  studentPhone: r.student_phone,
  parentPhone: r.parent_phone,
  course: r.course,
  status: r.status,
  createdAt: r.created_at,
  hasPassword: r.has_password === 1,
});

const COLUMNS = `id, first_name, last_name, school, student_phone, parent_phone, course, status, created_at,
  (password_hash IS NOT NULL) AS has_password`;

// รายชื่อนักเรียน: กรองสถานะ / คอร์ส / คำค้น (ชื่อ นามสกุล โรงเรียน เบอร์)
admin.get("/admin/students", async (c) => {
  const status = c.req.query("status");
  const course = c.req.query("course");
  const q = (c.req.query("q") ?? "").trim().slice(0, 100);
  const page = Math.max(1, Number.parseInt(c.req.query("page") ?? "1", 10) || 1);

  const where: string[] = [];
  const args: unknown[] = [];
  if (course && isCourse(course)) {
    args.push(course);
    where.push(`course = ?${args.length}`);
  }
  if (q) {
    args.push(`%${q.replace(/[\\%_]/g, (m) => "\\" + m)}%`);
    const p = `?${args.length}`;
    where.push(
      `(first_name LIKE ${p} ESCAPE '\\' OR last_name LIKE ${p} ESCAPE '\\' OR (first_name || ' ' || last_name) LIKE ${p} ESCAPE '\\'
        OR school LIKE ${p} ESCAPE '\\' OR student_phone LIKE ${p} ESCAPE '\\' OR parent_phone LIKE ${p} ESCAPE '\\')`,
    );
  }
  const baseWhere = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const countsSql = `SELECT status, COUNT(*) AS n FROM students ${baseWhere} GROUP BY status`;

  const listArgs = [...args];
  const listWhere = [...where];
  if (isStatus(status)) {
    listArgs.push(status);
    listWhere.push(`status = ?${listArgs.length}`);
  }
  const lw = listWhere.length ? `WHERE ${listWhere.join(" AND ")}` : "";
  listArgs.push(ADMIN_PAGE_SIZE, (page - 1) * ADMIN_PAGE_SIZE);
  const listSql = `SELECT ${COLUMNS} FROM students ${lw}
    ORDER BY created_at DESC, id DESC LIMIT ?${listArgs.length - 1} OFFSET ?${listArgs.length}`;

  const [countRes, listRes] = await c.env.DB.batch([
    c.env.DB.prepare(countsSql).bind(...args),
    c.env.DB.prepare(listSql).bind(...listArgs),
  ]);
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as AdminStudentList["counts"];
  for (const r of countRes.results as { status: StudentStatus; n: number }[]) counts[r.status] = r.n;
  const total = isStatus(status) ? counts[status] : STATUSES.reduce((sum, s) => sum + counts[s], 0);

  const body: AdminStudentList = {
    students: (listRes.results as Row[]).map(toStudent),
    total,
    page,
    pageSize: ADMIN_PAGE_SIZE,
    counts,
  };
  return c.json(body);
});

async function readJson(req: Request): Promise<Record<string, unknown>> {
  const v = await req.json().catch(() => null);
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function studentId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// ยืนยัน / ปฏิเสธ / ระงับ / กลับเป็นรอยืนยัน
admin.post("/admin/students/:id/status", async (c) => {
  const id = studentId(c.req.param("id"));
  const { status } = await readJson(c.req.raw);
  if (!id || !isStatus(status)) return c.json({ error: "validation" }, 400);
  const row = await c.env.DB.prepare(
    `UPDATE students SET status = ?1, updated_at = unixepoch() WHERE id = ?2 RETURNING ${COLUMNS}`,
  )
    .bind(status, id)
    .first<Row>();
  return row ? c.json(toStudent(row)) : c.json({ error: "not_found" }, 404);
});

// เปลี่ยนคอร์ส
admin.post("/admin/students/:id/course", async (c) => {
  const id = studentId(c.req.param("id"));
  const { course } = await readJson(c.req.raw);
  if (!id || typeof course !== "string" || !isCourse(course)) return c.json({ error: "validation" }, 400);
  const row = await c.env.DB.prepare(
    `UPDATE students SET course = ?1, updated_at = unixepoch() WHERE id = ?2 RETURNING ${COLUMNS}`,
  )
    .bind(course, id)
    .first<Row>();
  return row ? c.json(toStudent(row)) : c.json({ error: "not_found" }, 404);
});

// ตั้งรหัสผ่านใหม่ให้นักเรียน (เครื่องที่เข้าอยู่จะหลุด ต้องเข้าด้วยรหัสใหม่)
admin.post("/admin/students/:id/password", async (c) => {
  const id = studentId(c.req.param("id"));
  const { password } = await readJson(c.req.raw);
  if (!id) return c.json({ error: "validation" }, 400);
  if (typeof password !== "string" || password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    return c.json({ error: "validation", message: `รหัสผ่านต้องมี ${PASSWORD_MIN}–${PASSWORD_MAX} ตัว` }, 400);
  }
  const hash = await hashPassword(password);
  const [updated] = await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE students SET password_hash = ?1, updated_at = unixepoch() WHERE id = ?2 RETURNING ${COLUMNS}`,
    ).bind(hash, id),
    c.env.DB.prepare("DELETE FROM sessions WHERE student_id = ?1").bind(id),
  ]);
  const row = (updated.results as Row[])[0];
  return row ? c.json(toStudent(row)) : c.json({ error: "not_found" }, 404);
});

// ประวัติการเรียนรายคน: ทุกคลิปในคอร์สของนักเรียน + ความคืบหน้า
admin.get("/admin/students/:id/progress", async (c) => {
  const id = studentId(c.req.param("id"));
  if (!id) return c.json({ error: "not_found" }, 404);
  const row = await c.env.DB.prepare(`SELECT ${COLUMNS} FROM students WHERE id = ?1`).bind(id).first<Row>();
  if (!row) return c.json({ error: "not_found" }, 404);

  const [ch, vi] = await c.env.DB.batch([
    c.env.DB.prepare("SELECT id, title FROM chapters WHERE course = ?1 ORDER BY sort_order, id").bind(row.course),
    c.env.DB.prepare(
      `SELECT v.id, v.chapter_id, v.title, v.duration_sec,
              p.last_position_sec, p.max_position_sec, p.watch_seconds, p.last_watched_at
       FROM videos v JOIN chapters c ON c.id = v.chapter_id
       LEFT JOIN progress p ON p.video_id = v.id AND p.student_id = ?2
       WHERE c.course = ?1 ORDER BY v.sort_order, v.id`,
    ).bind(row.course, id),
  ]);
  const chapters: ProgressChapter[] = (ch.results as { id: number; title: string }[]).map((x) => ({ ...x, videos: [] }));
  const byId = new Map(chapters.map((x) => [x.id, x]));
  const summary: StudentProgress["summary"] = {
    videosTotal: 0,
    videosStarted: 0,
    videosCompleted: 0,
    watchSecondsTotal: 0,
    lastWatchedAt: null,
  };
  type VRow = {
    id: number;
    chapter_id: number;
    title: string;
    duration_sec: number | null;
    last_position_sec: number | null;
    max_position_sec: number | null;
    watch_seconds: number | null;
    last_watched_at: number | null;
  };
  for (const v of vi.results as VRow[]) {
    const percent = percentOf(v.max_position_sec ?? 0, v.duration_sec);
    const watch = v.watch_seconds ?? 0;
    byId.get(v.chapter_id)?.videos.push({
      id: v.id,
      title: v.title,
      durationSec: v.duration_sec,
      percent,
      lastPositionSec: v.last_position_sec,
      lastWatchedAt: v.last_watched_at,
      watchSeconds: watch,
    });
    summary.videosTotal++;
    if (v.last_watched_at) summary.videosStarted++;
    if (percent >= 100) summary.videosCompleted++;
    summary.watchSecondsTotal += watch;
    if (v.last_watched_at && (!summary.lastWatchedAt || v.last_watched_at > summary.lastWatchedAt)) {
      summary.lastWatchedAt = v.last_watched_at;
    }
  }
  const body: StudentProgress = { student: toStudent(row), chapters, summary };
  return c.json(body);
});
