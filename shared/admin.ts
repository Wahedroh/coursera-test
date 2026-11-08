import type { Course, StudentStatus } from "./validate";

export const STATUS_LABELS: Record<StudentStatus, string> = {
  pending: "รอยืนยัน",
  approved: "ยืนยันแล้ว",
  rejected: "ปฏิเสธ",
  suspended: "ระงับ",
};

export const STATUSES = Object.keys(STATUS_LABELS) as StudentStatus[];

export function isStatus(v: unknown): v is StudentStatus {
  return typeof v === "string" && (STATUSES as string[]).includes(v);
}

export type AdminStudent = {
  id: number;
  firstName: string;
  lastName: string;
  school: string;
  studentPhone: string;
  parentPhone: string;
  course: Course;
  status: StudentStatus;
  /** unix seconds */
  createdAt: number;
  /** ตั้งรหัสผ่านไว้หรือยัง (นักเรียนที่สมัครด้วย Facebook ยังไม่มี) */
  hasPassword: boolean;
};

export type AdminStudentList = {
  students: AdminStudent[];
  total: number;
  page: number;
  pageSize: number;
  /** จำนวนตามสถานะ (ใช้ตัวกรองคอร์สและคำค้น แต่ไม่ใช้ตัวกรองสถานะ) */
  counts: Record<StudentStatus, number>;
};

export const ADMIN_PAGE_SIZE = 50;
