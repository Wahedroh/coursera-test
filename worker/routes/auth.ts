import { Hono } from "hono";
import { normalizePhone, PASSWORD_MAX, PASSWORD_MIN, validateRegister, type Me, type RegisterInput } from "../../shared/validate";
import { academicYear } from "../lib/academicYear";
import { DUMMY_HASH, hashPassword, verifyPassword } from "../lib/password";
import { currentStudentId, endSession, startSession } from "../lib/session";
import { clearFailures, clientIp, isLocked, LOCKED_MESSAGE, recordFailure } from "../lib/throttle";

export type StudentRow = {
  id: number;
  first_name: string;
  last_name: string;
  school: string;
  student_phone: string;
  parent_phone: string;
  course: Me["course"];
  status: Me["status"];
};

const ME_COLUMNS = "id, first_name, last_name, school, student_phone, parent_phone, course, status";

export function toMe(r: StudentRow): Me {
  return {
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    school: r.school,
    studentPhone: r.student_phone,
    parentPhone: r.parent_phone,
    course: r.course,
    status: r.status,
  };
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const v = await req.json();
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export const auth = new Hono<{ Bindings: Env }>();

// สมัครด้วยเบอร์นักเรียน + รหัสผ่าน แล้วเข้าสู่ระบบทันที (สถานะ "รอยืนยัน")
/**
 * สร้างนักเรียนใหม่ + จำชื่อโรงเรียน (ใช้ทั้งสมัครด้วยรหัสผ่าน และสมัครด้วย Facebook)
 * extra = คำสั่งเพิ่มเติมที่ต้องทำใน transaction เดียวกัน (เช่น ผูกบัญชี Facebook)
 * คืน null ถ้าเบอร์นักเรียนซ้ำ
 */
export async function insertStudent(
  db: D1Database,
  data: RegisterInput,
  passwordHash: string | null,
  extra: D1PreparedStatement[] = [],
): Promise<StudentRow | null> {
  const taken = await db.prepare("SELECT 1 FROM students WHERE student_phone = ?1").bind(data.studentPhone).first();
  if (taken) return null;
  try {
    const [inserted] = await db.batch<StudentRow>([
      db
        .prepare(
          `INSERT INTO students (first_name, last_name, school, student_phone, parent_phone, course, password_hash, consent_at, academic_year)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, unixepoch(), ?8)
           RETURNING ${ME_COLUMNS}`,
        )
        .bind(data.firstName, data.lastName, data.school, data.studentPhone, data.parentPhone, data.course, passwordHash, academicYear()),
      db.prepare("INSERT OR IGNORE INTO schools (name) VALUES (?1)").bind(data.school),
      ...extra,
    ]);
    const row = inserted.results[0];
    if (!row) throw new Error("insert returned no row");
    return row;
  } catch (err) {
    // สมัครพร้อมกันด้วยเบอร์เดียวกัน
    if (String(err).includes("UNIQUE constraint failed: students.student_phone")) return null;
    throw err;
  }
}

export const PHONE_TAKEN = { error: "validation", fields: { studentPhone: "เบอร์นี้สมัครแล้ว" } } as const;

auth.post("/auth/register", async (c) => {
  const { data, errors } = validateRegister(await readJson(c.req.raw));
  if (Object.keys(errors).length) return c.json({ error: "validation", fields: errors }, 400);
  const row = await insertStudent(c.env.DB, data, await hashPassword(data.password));
  if (!row) return c.json(PHONE_TAKEN, 409);
  await startSession(c, row.id);
  return c.json(toMe(row), 201);
});

// เข้าสู่ระบบด้วยเบอร์นักเรียน + รหัสผ่าน (เข้าเครื่องใหม่ เครื่องเก่าหลุด)
auth.post("/auth/login", async (c) => {
  const body = await readJson(c.req.raw);
  const phone = normalizePhone(typeof body.phone === "string" ? body.phone.trim() : "");
  const password = typeof body.password === "string" ? body.password : "";

  // นับรหัสผิดต่อ เบอร์ + IP: เดารหัสของเบอร์หนึ่งได้จำกัด และนักเรียนที่ใช้ Wi-Fi เดียวกันไม่โดนล็อกด้วยกัน
  const key = `s:${clientIp(c.req.raw)}:${phone}`;
  if (await isLocked(c.env.DB, key)) return c.json({ error: "too_many", message: LOCKED_MESSAGE }, 429);

  const row = phone
    ? await c.env.DB.prepare(`SELECT ${ME_COLUMNS}, password_hash FROM students WHERE student_phone = ?1`)
        .bind(phone)
        .first<StudentRow & { password_hash: string | null }>()
    : null;

  const ok = await verifyPassword(password, row?.password_hash ?? DUMMY_HASH);
  if (!row || !row.password_hash || !ok) {
    await recordFailure(c.env.DB, key);
    return c.json({ error: "invalid_credentials", message: "เบอร์หรือรหัสผ่านไม่ถูกต้อง" }, 401);
  }

  await clearFailures(c.env.DB, key);
  await startSession(c, row.id);
  return c.json(toMe(row));
});

auth.post("/auth/logout", async (c) => {
  await endSession(c);
  return c.json({ ok: true });
});

auth.get("/me", async (c) => {
  const id = await currentStudentId(c);
  if (id === null) return c.json({ error: "unauthorized" }, 401);
  const row = await c.env.DB.prepare(`SELECT ${ME_COLUMNS} FROM students WHERE id = ?1`).bind(id).first<StudentRow>();
  if (!row) return c.json({ error: "unauthorized" }, 401);
  return c.json(toMe(row));
});

// นักเรียนเปลี่ยนรหัสผ่านเอง: มีรหัสเดิมต้องใส่รหัสเดิม (สมัครด้วย Facebook ยังไม่มีรหัส → ตั้งใหม่ได้เลย)
auth.get("/auth/password", async (c) => {
  const id = await currentStudentId(c);
  if (id === null) return c.json({ error: "unauthorized" }, 401);
  const r = await c.env.DB.prepare("SELECT password_hash IS NOT NULL AS has FROM students WHERE id = ?1").bind(id).first<{ has: number }>();
  return c.json({ hasPassword: r?.has === 1 });
});

auth.post("/auth/password", async (c) => {
  const id = await currentStudentId(c);
  if (id === null) return c.json({ error: "unauthorized" }, 401);
  const body = await readJson(c.req.raw);
  const current = typeof body.current === "string" ? body.current : "";
  const next = typeof body.next === "string" ? body.next : "";
  if (next.length < PASSWORD_MIN || next.length > PASSWORD_MAX) {
    return c.json({ error: "validation", fields: { next: `รหัสผ่านใหม่ต้องมีอย่างน้อย ${PASSWORD_MIN} ตัว` } }, 400);
  }
  const db = c.env.DB;
  const key = `p:${id}`;
  if (await isLocked(db, key)) return c.json({ error: "too_many", message: LOCKED_MESSAGE }, 429);
  const row = await db.prepare("SELECT password_hash FROM students WHERE id = ?1").bind(id).first<{ password_hash: string | null }>();
  if (!row) return c.json({ error: "unauthorized" }, 401);
  if (row.password_hash && !(await verifyPassword(current, row.password_hash))) {
    await recordFailure(db, key);
    return c.json({ error: "validation", fields: { current: "รหัสผ่านเดิมไม่ถูกต้อง" } }, 400);
  }
  await clearFailures(db, key);
  await db.prepare("UPDATE students SET password_hash = ?1, updated_at = unixepoch() WHERE id = ?2").bind(await hashPassword(next), id).run();
  return c.json({ ok: true });
});
