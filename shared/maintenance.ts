import type { Course } from "./validate";

// โควตาฟรีของ Cloudflare (ตรวจตัวเลขล่าสุดที่หน้า pricing ของ Cloudflare)
export const D1_FREE_BYTES = 500 * 1024 * 1024; // 500MB ต่อฐานข้อมูล
export const USAGE_WARN_PERCENT = 80;

export type Usage = {
  d1: { bytes: number; limit: number; percent: number };
  counts: { students: number; videos: number; documents: number; progress: number; announcements: number };
};

/** กลุ่มนักเรียนตามปีการศึกษาที่สมัคร × คอร์ส */
export type YearGroup = { year: number; course: Course; students: number };

export type CloseYearScope = "m12" | "m4" | "all";
export type CloseYearDocs = "none" | "class_notes" | "all";
export type CloseYearInput = {
  year: number;
  course: CloseYearScope;
  docs: CloseYearDocs;
  announcements: boolean;
};
export type CloseYearCounts = { students: number; progress: number; documents: number; announcements: number };

export const BACKUP_VERSION = 4; // 2 = เอกสารเป็นลิงก์ OneDrive, 3 = เพิ่มข้อมูลป้าย "ใหม่", 4 = เพิ่มคำถามใต้คลิป
/** เวอร์ชันไฟล์สำรองที่กู้คืนได้ (ไฟล์เวอร์ชัน 2 ไม่มีคอลัมน์ใหม่ จะใช้ค่าเริ่มต้นแทน) */
export const RESTORABLE_VERSIONS = [2, 3, 4];
/** ตารางที่ไฟล์สำรองเวอร์ชันเก่าไม่มี (กู้คืนเป็นตารางว่าง) */
export const BACKUP_TABLES_ADDED: Record<string, number> = { questions: 4 };
/** ค่าเริ่มต้นของคอลัมน์ที่ไฟล์สำรองเวอร์ชันเก่าไม่มี (เป็นนิพจน์ SQL) */
export const BACKUP_COLUMN_DEFAULTS: Record<string, string> = { announcements_seen_at: "0", created_at: "unixepoch()" };

/** ตารางและคอลัมน์ที่อยู่ในไฟล์สำรอง JSON (เรียงตามลำดับที่ต้องใส่กลับตอนกู้คืน) */
export const BACKUP_TABLES = {
  schools: ["name"],
  students: [
    "id",
    "first_name",
    "last_name",
    "school",
    "student_phone",
    "parent_phone",
    "course",
    "status",
    "password_hash",
    "consent_at",
    "academic_year",
    "created_at",
    "updated_at",
    "announcements_seen_at",
  ],
  oauth_accounts: ["id", "student_id", "provider", "provider_user_id"],
  chapters: ["id", "course", "title", "sort_order"],
  videos: ["id", "chapter_id", "title", "youtube_id", "duration_sec", "sort_order", "created_at"],
  documents: ["id", "video_id", "kind", "title", "url", "created_at"],
  progress: ["student_id", "video_id", "last_position_sec", "max_position_sec", "watch_seconds", "last_watched_at"],
  announcements: ["id", "target", "title", "body", "created_at", "updated_at"],
  questions: ["id", "student_id", "video_id", "position_sec", "body", "answer", "answered_at", "hidden", "created_at"],
} as const;
export type BackupTable = keyof typeof BACKUP_TABLES;

export type Backup = {
  version: number;
  exportedAt: string;
  tables: Record<BackupTable, Record<string, unknown>[]>;
};
