// ตรวจข้อมูลฟอร์ม ใช้ร่วมกันทั้งหน้าเว็บและ Worker

export const COURSES = { m12: "คอร์ส ม.1&2", m4: "คอร์ส ม.4" } as const;
export type Course = keyof typeof COURSES;

export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 128;

export type RegisterInput = {
  firstName: string;
  lastName: string;
  school: string;
  studentPhone: string;
  parentPhone: string;
  course: string;
  password: string;
  consent: boolean;
};

export type FieldErrors = Partial<Record<keyof RegisterInput, string>>;

/** ตัดขีดและช่องว่างออกจากเบอร์โทร */
export function normalizePhone(v: string): string {
  return v.replace(/[\s-]/g, "");
}

export function isPhone(v: string): boolean {
  return /^0\d{9}$/.test(v);
}

export function isCourse(v: string): v is Course {
  return Object.prototype.hasOwnProperty.call(COURSES, v);
}

function text(v: unknown): string {
  return typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
}

/**
 * คืนข้อมูลที่ทำความสะอาดแล้ว และข้อผิดพลาดรายช่อง
 * password: false = สมัครด้วย Facebook (ไม่ต้องตั้งรหัสผ่าน)
 */
export function validateRegister(
  raw: Record<string, unknown>,
  opts: { password: boolean } = { password: true },
): { data: RegisterInput; errors: FieldErrors } {
  const data: RegisterInput = {
    firstName: text(raw.firstName),
    lastName: text(raw.lastName),
    school: text(raw.school),
    studentPhone: normalizePhone(text(raw.studentPhone)),
    parentPhone: normalizePhone(text(raw.parentPhone)),
    course: text(raw.course),
    password: typeof raw.password === "string" ? raw.password : "",
    consent: raw.consent === true,
  };
  const e: FieldErrors = {};
  if (!data.firstName) e.firstName = "กรุณากรอกชื่อ";
  else if (data.firstName.length > 100) e.firstName = "ชื่อยาวเกินไป";
  if (!data.lastName) e.lastName = "กรุณากรอกนามสกุล";
  else if (data.lastName.length > 100) e.lastName = "นามสกุลยาวเกินไป";
  if (!data.school) e.school = "กรุณากรอกชื่อโรงเรียน";
  else if (data.school.length > 150) e.school = "ชื่อโรงเรียนยาวเกินไป";
  if (!isPhone(data.studentPhone)) e.studentPhone = "เบอร์ต้องเป็นตัวเลข 10 หลัก ขึ้นต้นด้วย 0";
  if (!isPhone(data.parentPhone)) e.parentPhone = "เบอร์ต้องเป็นตัวเลข 10 หลัก ขึ้นต้นด้วย 0";
  if (!isCourse(data.course)) e.course = "กรุณาเลือกคอร์ส";
  if (opts.password) {
    if (data.password.length < PASSWORD_MIN) e.password = `รหัสผ่านต้องมีอย่างน้อย ${PASSWORD_MIN} ตัว`;
    else if (data.password.length > PASSWORD_MAX) e.password = "รหัสผ่านยาวเกินไป";
  }
  if (!data.consent) e.consent = "กรุณาติ๊กยินยอมก่อนสมัคร";
  return { data, errors: e };
}

export type StudentStatus = "pending" | "approved" | "rejected" | "suspended";

/** ข้อมูลนักเรียนที่ส่งให้หน้าเว็บ (GET /api/me) */
export type Me = {
  id: number;
  firstName: string;
  lastName: string;
  school: string;
  studentPhone: string;
  parentPhone: string;
  course: Course;
  status: StudentStatus;
};
