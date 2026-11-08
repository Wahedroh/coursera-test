import { Hono } from "hono";
import { normalizePhone, validateRegister, type Me } from "../../shared/validate";
import { academicYear } from "../lib/academicYear";
import { DUMMY_HASH, hashPassword, verifyPassword } from "../lib/password";
import { currentStudentId, endSession, startSession } from "../lib/session";

type StudentRow = {
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

function toMe(r: StudentRow): Me {
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

async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const v = await req.json();
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export const auth = new Hono<{ Bindings: Env }>();

// สมัครด้วยเบอร์นักเรียน + รหัสผ่าน แล้วเข้าสู่ระบบทันที (สถานะ "รอยืนยัน")
auth.post("/auth/register", async (c) => {
  const { data, errors } = validateRegister(await readJson(c.req.raw));
  if (Object.keys(errors).length) return c.json({ error: "validation", fields: errors }, 400);

  const taken = await c.env.DB.prepare("SELECT 1 FROM students WHERE student_phone = ?1").bind(data.studentPhone).first();
  if (taken) return c.json({ error: "validation", fields: { studentPhone: "เบอร์นี้สมัครแล้ว" } }, 409);

  const passwordHash = await hashPassword(data.password);
  let row: StudentRow | null;
  try {
    const [inserted] = await c.env.DB.batch<StudentRow>([
      c.env.DB.prepare(
        `INSERT INTO students (first_name, last_name, school, student_phone, parent_phone, course, password_hash, consent_at, academic_year)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, unixepoch(), ?8)
         RETURNING ${ME_COLUMNS}`,
      ).bind(
        data.firstName,
        data.lastName,
        data.school,
        data.studentPhone,
        data.parentPhone,
        data.course,
        passwordHash,
        academicYear(),
      ),
      c.env.DB.prepare("INSERT OR IGNORE INTO schools (name) VALUES (?1)").bind(data.school),
    ]);
    row = inserted.results[0] ?? null;
  } catch (err) {
    // สมัครพร้อมกันด้วยเบอร์เดียวกัน
    if (String(err).includes("UNIQUE constraint failed: students.student_phone")) {
      return c.json({ error: "validation", fields: { studentPhone: "เบอร์นี้สมัครแล้ว" } }, 409);
    }
    throw err;
  }
  if (!row) throw new Error("insert returned no row");

  await startSession(c, row.id);
  return c.json(toMe(row), 201);
});

// เข้าสู่ระบบด้วยเบอร์นักเรียน + รหัสผ่าน (เข้าเครื่องใหม่ เครื่องเก่าหลุด)
auth.post("/auth/login", async (c) => {
  const body = await readJson(c.req.raw);
  const phone = normalizePhone(typeof body.phone === "string" ? body.phone.trim() : "");
  const password = typeof body.password === "string" ? body.password : "";

  const row = phone
    ? await c.env.DB.prepare(`SELECT ${ME_COLUMNS}, password_hash FROM students WHERE student_phone = ?1`)
        .bind(phone)
        .first<StudentRow & { password_hash: string | null }>()
    : null;

  const ok = await verifyPassword(password, row?.password_hash ?? DUMMY_HASH);
  if (!row || !row.password_hash || !ok) {
    return c.json({ error: "invalid_credentials", message: "เบอร์หรือรหัสผ่านไม่ถูกต้อง" }, 401);
  }

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
