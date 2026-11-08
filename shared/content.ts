import type { Course } from "./validate";

/** ดึง YouTube video ID (11 ตัว) จากลิงก์แบบต่าง ๆ หรือจาก ID ตรง ๆ */
export function parseYouTubeId(input: string): string | null {
  const s = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  let u: URL;
  try {
    u = new URL(s.startsWith("http") ? s : `https://${s}`);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www\.|m\.|music\.)/, "");
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.split("/")[1] ?? null;
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else {
      const m = u.pathname.match(/^\/(embed|shorts|live|v)\/([^/?#]+)/);
      id = m ? m[2] : null;
    }
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

export const TITLE_MAX = 200;

// ---------- เอกสาร (ลิงก์ OneDrive) ----------

export const DOC_KINDS = { handout: "เอกสารประกอบ", class_notes: "เอกสารที่เขียนในห้อง" } as const;
export type DocKind = keyof typeof DOC_KINDS;

export function isDocKind(v: unknown): v is DocKind {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(DOC_KINDS, v);
}

export type DocumentInfo = { id: number; kind: DocKind; title: string; url: string };

export const DOC_TITLE_MAX = 150;

/** ลิงก์เอกสารต้องเป็น OneDrive / SharePoint แบบ https */
export function isOneDriveUrl(input: string): boolean {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return false;
  }
  const h = u.hostname.toLowerCase();
  return (
    u.protocol === "https:" &&
    (h === "1drv.ms" || h === "onedrive.live.com" || h.endsWith(".onedrive.com") || h === "onedrive.com" || h.endsWith(".sharepoint.com"))
  );
}

// ---------- หลังบ้าน ----------

export type AdminVideo = {
  id: number;
  title: string;
  youtubeId: string;
  durationSec: number | null;
  documents: DocumentInfo[];
};
export type AdminChapter = { id: number; title: string; videos: AdminVideo[] };
export type AdminContent = { course: Course; chapters: AdminChapter[] };

// ---------- ฝั่งนักเรียน ----------

export type CourseVideo = {
  id: number;
  title: string;
  durationSec: number | null;
  /** 0–100 */
  percent: number;
  lastPositionSec: number;
};
export type CourseChapter = { id: number; title: string; videos: CourseVideo[] };
export type CourseOutline = {
  course: Course;
  chapters: CourseChapter[];
  /** คลิปที่ดูล่าสุด (สำหรับปุ่มเรียนต่อ) */
  resume: { videoId: number; title: string; lastPositionSec: number; percent: number } | null;
};

export type WatchVideo = {
  id: number;
  title: string;
  chapterTitle: string;
  youtubeId: string;
  durationSec: number | null;
  lastPositionSec: number;
  prevId: number | null;
  nextId: number | null;
  documents: DocumentInfo[];
};

export function percentOf(maxPos: number, duration: number | null): number {
  if (!duration || duration <= 0) return 0;
  // เหลือไม่ถึง 10 วินาทีถือว่าดูจบ
  if (maxPos >= duration - 10) return 100;
  return Math.max(0, Math.min(100, Math.floor((maxPos / duration) * 100)));
}
