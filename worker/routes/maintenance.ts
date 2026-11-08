import { Hono } from "hono";
import {
  BACKUP_TABLES,
  BACKUP_VERSION,
  D1_FREE_BYTES,
  type Backup,
  type BackupTable,
  type CloseYearCounts,
  type CloseYearDocs,
  type CloseYearScope,
  type Usage,
  type YearGroup,
} from "../../shared/maintenance";
import { percentOf } from "../../shared/content";
import { COURSES, type Course } from "../../shared/validate";
import { requireAdmin, type AdminVars } from "../lib/adminSession";

// หลังบ้าน: สำรอง / กู้คืน / การใช้พื้นที่ / ปิดปีการศึกษา
export const maintenance = new Hono<{ Bindings: Env; Variables: AdminVars }>();

maintenance.use("/admin/backup/*", requireAdmin);
maintenance.use("/admin/restore", requireAdmin);
maintenance.use("/admin/usage", requireAdmin);
maintenance.use("/admin/close-year", requireAdmin);
maintenance.use("/admin/close-year/*", requireAdmin);

// ---------- ตัวช่วย ----------

const TZ = "Asia/Bangkok";
/** เวลา (unix seconds) → "2026-11-08 08:43" เวลาไทย ให้ Excel อ่านเป็นวันที่ได้ */
const fmtTime = (sec: number | null) =>
  sec ? new Date(sec * 1000).toLocaleString("sv-SE", { timeZone: TZ, hour12: false }).slice(0, 16) : "";
const fmtPos = (s: number | null) =>
  s === null ? "" : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: TZ });

const STATUS_TH: Record<string, string> = { pending: "รอยืนยัน", approved: "ยืนยันแล้ว", rejected: "ปฏิเสธ", suspended: "ระงับ" };

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  // เบอร์โทรขึ้นต้นด้วย 0: ใส่ ="..." ไม่ให้ Excel ตัดเลข 0 ทิ้ง
  const t = /^0\d+$/.test(s) ? `="${s}"` : s;
  return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

function csvResponse(name: string, header: string[], rows: unknown[][]): Response {
  const body = "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="backup.csv"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "cache-control": "no-store",
    },
  });
}

// ---------- สำรองข้อมูล ----------

maintenance.get("/admin/backup/students.csv", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, first_name, last_name, school, student_phone, parent_phone, course, status, academic_year, created_at,
            (SELECT COUNT(*) FROM oauth_accounts o WHERE o.student_id = s.id) AS fb
     FROM students s ORDER BY course, academic_year, first_name`,
  ).all<Record<string, string | number>>();
  return csvResponse(
    `รายชื่อนักเรียน-${today()}.csv`,
    ["รหัส", "ชื่อ", "นามสกุล", "โรงเรียน", "เบอร์นักเรียน", "เบอร์ผู้ปกครอง", "คอร์ส", "สถานะ", "ปีการศึกษา", "สมัครเมื่อ", "เข้าด้วย Facebook"],
    results.map((r) => [
      r.id,
      r.first_name,
      r.last_name,
      r.school,
      r.student_phone,
      r.parent_phone,
      COURSES[r.course as Course],
      STATUS_TH[r.status as string],
      r.academic_year,
      fmtTime(r.created_at as number),
      r.fb ? "ใช่" : "",
    ]),
  );
});

maintenance.get("/admin/backup/progress.csv", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT s.first_name, s.last_name, s.student_phone, s.course, c.title AS chapter, v.title AS video, v.duration_sec,
            p.last_position_sec, p.max_position_sec, p.watch_seconds, p.last_watched_at
     FROM progress p JOIN students s ON s.id = p.student_id JOIN videos v ON v.id = p.video_id
     JOIN chapters c ON c.id = v.chapter_id
     ORDER BY s.course, s.first_name, s.last_name, c.sort_order, v.sort_order`,
  ).all<Record<string, string | number | null>>();
  return csvResponse(
    `ประวัติการเรียน-${today()}.csv`,
    ["ชื่อ", "นามสกุล", "เบอร์นักเรียน", "คอร์ส", "บท", "คลิป", "ดูแล้ว (%)", "หยุดล่าสุดที่", "ความยาวคลิป", "ดูล่าสุด", "เวลาดูรวม (นาที)"],
    results.map((r) => [
      r.first_name,
      r.last_name,
      r.student_phone,
      COURSES[r.course as Course],
      r.chapter,
      r.video,
      percentOf((r.max_position_sec as number) ?? 0, r.duration_sec as number | null),
      fmtPos(r.last_position_sec as number | null),
      fmtPos(r.duration_sec as number | null),
      fmtTime(r.last_watched_at as number | null),
      Math.round(((r.watch_seconds as number) ?? 0) / 60),
    ]),
  );
});

// สำรองทั้งระบบ (ใช้กู้คืน) — มีรหัสผ่านที่เข้ารหัสแล้วด้วย
maintenance.get("/admin/backup/json", async (c) => {
  const names = Object.keys(BACKUP_TABLES) as BackupTable[];
  const res = await c.env.DB.batch(
    names.map((t) => c.env.DB.prepare(`SELECT ${BACKUP_TABLES[t].join(", ")} FROM ${t}`)),
  );
  const backup: Backup = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    tables: Object.fromEntries(names.map((t, i) => [t, res[i].results])) as Backup["tables"],
  };
  return new Response(JSON.stringify(backup), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="backup.json"; filename*=UTF-8''${encodeURIComponent(`สำรองข้อมูล-${today()}.json`)}`,
      "cache-control": "no-store",
    },
  });
});

// ---------- กู้คืน ----------

// ส่ง JSON ทีละก้อนไม่เกิน ~900KB ต่อคำสั่ง (D1 จำกัดขนาดค่าที่ผูกกับคำสั่ง)
function chunkRows(rows: Record<string, unknown>[], maxBytes = 900_000): string[] {
  const out: string[] = [];
  let cur: string[] = [];
  let size = 2;
  for (const r of rows) {
    const s = JSON.stringify(r);
    if (cur.length && size + s.length + 1 > maxBytes) {
      out.push(`[${cur.join(",")}]`);
      cur = [];
      size = 2;
    }
    cur.push(s);
    size += s.length + 1;
  }
  if (cur.length) out.push(`[${cur.join(",")}]`);
  return out;
}

// แทนที่ข้อมูลทั้งหมดด้วยไฟล์สำรอง (ทำใน transaction เดียว: ผิดตรงไหน = ไม่เปลี่ยนอะไรเลย)
maintenance.post("/admin/restore", async (c) => {
  const b = (await c.req.json().catch(() => null)) as Partial<Backup> | null;
  if (!b || b.version !== BACKUP_VERSION || !b.tables || typeof b.tables !== "object") {
    return c.json({ error: "validation", message: "ไม่ใช่ไฟล์สำรองของระบบนี้" }, 400);
  }
  const names = Object.keys(BACKUP_TABLES) as BackupTable[];
  for (const t of names) {
    const rows = b.tables[t];
    if (!Array.isArray(rows) || rows.some((r) => !r || typeof r !== "object" || Array.isArray(r))) {
      return c.json({ error: "validation", message: `ไฟล์สำรองไม่ครบ (ตาราง ${t})` }, 400);
    }
  }
  const db = c.env.DB;
  const stmts: D1PreparedStatement[] = [
    // ลูกก่อนแม่
    ...["sessions", "oauth_pending", "progress", "documents", "videos", "chapters", "oauth_accounts", "students", "schools", "announcements"].map(
      (t) => db.prepare(`DELETE FROM ${t}`),
    ),
  ];
  for (const t of names) {
    const cols = BACKUP_TABLES[t];
    const select = cols.map((col) => `json_extract(value, '$.${col}')`).join(", ");
    for (const chunk of chunkRows(b.tables[t]!)) {
      stmts.push(db.prepare(`INSERT INTO ${t} (${cols.join(", ")}) SELECT ${select} FROM json_each(?1)`).bind(chunk));
    }
  }
  try {
    await db.batch(stmts);
  } catch (err) {
    console.error(err);
    return c.json({ error: "validation", message: "ข้อมูลในไฟล์สำรองไม่ถูกต้อง ไม่ได้เปลี่ยนแปลงข้อมูลใด ๆ" }, 400);
  }
  const counts = Object.fromEntries(names.map((t) => [t, b.tables![t]!.length]));
  return c.json({ ok: true, counts });
});

// ---------- การใช้พื้นที่ ----------

maintenance.get("/admin/usage", async (c) => {
  const r = await c.env.DB.prepare(
    `SELECT (SELECT COUNT(*) FROM students) AS students, (SELECT COUNT(*) FROM videos) AS videos,
            (SELECT COUNT(*) FROM documents) AS documents,
            (SELECT COUNT(*) FROM progress) AS progress, (SELECT COUNT(*) FROM announcements) AS announcements`,
  ).all<{ students: number; videos: number; documents: number; progress: number; announcements: number }>();
  const row = r.results[0];
  const d1Bytes = r.meta.size_after ?? 0;
  const pct = (a: number, b: number) => Math.round((a / b) * 1000) / 10;
  const body: Usage = {
    d1: { bytes: d1Bytes, limit: D1_FREE_BYTES, percent: pct(d1Bytes, D1_FREE_BYTES) },
    counts: {
      students: row.students,
      videos: row.videos,
      documents: row.documents,
      progress: row.progress,
      announcements: row.announcements,
    },
  };
  return c.json(body);
});

// ---------- ปิดปีการศึกษา ----------

maintenance.get("/admin/close-year/groups", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT academic_year AS year, course, COUNT(*) AS students FROM students GROUP BY academic_year, course ORDER BY academic_year, course",
  ).all<YearGroup>();
  return c.json({ groups: results });
});

type CloseInput = { year: number; courses: Course[]; docs: CloseYearDocs; announcements: boolean };

function parseClose(raw: Record<string, string | boolean | number | undefined>): CloseInput | null {
  const year = Number(raw.year);
  const course = raw.course as CloseYearScope;
  const docs = raw.docs as CloseYearDocs;
  if (!Number.isInteger(year) || year < 2500 || year > 2700) return null;
  if (!["m12", "m4", "all"].includes(course)) return null;
  if (!["none", "class_notes", "all"].includes(docs)) return null;
  const announcements = raw.announcements === true || raw.announcements === "1" || raw.announcements === "true";
  return { year, courses: course === "all" ? ["m12", "m4"] : [course as Course], docs, announcements };
}

const inList = (n: number, start: number) => Array.from({ length: n }, (_, i) => `?${start + i}`).join(", ");

function docFilter(input: CloseInput) {
  // เอกสารของคลิปในคอร์สที่เลือก (ตามประเภทที่เลือก)
  const kind = input.docs === "class_notes" ? "AND d.kind = 'class_notes'" : "";
  return {
    sql: `FROM documents d JOIN videos v ON v.id = d.video_id JOIN chapters c ON c.id = v.chapter_id
          WHERE c.course IN (${inList(input.courses.length, 1)}) ${kind}`,
    args: input.courses,
  };
}

async function countClose(db: D1Database, input: CloseInput): Promise<CloseYearCounts> {
  const sIn = inList(input.courses.length, 2);
  const d = docFilter(input);
  const [s, p, docs, a] = await db.batch<{ n: number }>([
    db.prepare(`SELECT COUNT(*) AS n FROM students WHERE academic_year = ?1 AND course IN (${sIn})`).bind(input.year, ...input.courses),
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM progress WHERE student_id IN (SELECT id FROM students WHERE academic_year = ?1 AND course IN (${sIn}))`,
      )
      .bind(input.year, ...input.courses),
    db.prepare(`SELECT COUNT(*) AS n ${d.sql}`).bind(...d.args),
    db.prepare("SELECT COUNT(*) AS n FROM announcements"),
  ]);
  return {
    students: s.results[0].n,
    progress: p.results[0].n,
    documents: input.docs === "none" ? 0 : docs.results[0].n,
    announcements: input.announcements ? a.results[0].n : 0,
  };
}

// ดูจำนวนที่จะถูกลบก่อนกดยืนยัน
maintenance.get("/admin/close-year/preview", async (c) => {
  const input = parseClose(c.req.query());
  if (!input) return c.json({ error: "validation", message: "ข้อมูลไม่ครบ" }, 400);
  return c.json(await countClose(c.env.DB, input));
});

maintenance.post("/admin/close-year", async (c) => {
  const input = parseClose(((await c.req.json().catch(() => null)) ?? {}) as Record<string, string | boolean | number>);
  if (!input) return c.json({ error: "validation", message: "ข้อมูลไม่ครบ" }, 400);
  const db = c.env.DB;
  const counts = await countClose(db, input);
  const d = docFilter(input);

  const stmts: D1PreparedStatement[] = [
    // ลบนักเรียน → ประวัติ, session, บัญชี Facebook ที่ผูกไว้ ถูกลบตาม (ON DELETE CASCADE)
    db
      .prepare(`DELETE FROM students WHERE academic_year = ?1 AND course IN (${inList(input.courses.length, 2)})`)
      .bind(input.year, ...input.courses),
  ];
  if (input.docs !== "none") stmts.push(db.prepare(`DELETE FROM documents WHERE id IN (SELECT d.id ${d.sql})`).bind(...d.args));
  if (input.announcements) stmts.push(db.prepare("DELETE FROM announcements"));
  await db.batch(stmts);
  return c.json({ ok: true, deleted: counts });
});
