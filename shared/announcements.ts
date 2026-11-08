import type { Course } from "./validate";

export const ANNOUNCE_TARGETS = { all: "ทุกคน", m12: "คอร์ส ม.1&2", m4: "คอร์ส ม.4" } as const;
export type AnnounceTarget = keyof typeof ANNOUNCE_TARGETS;
export const ANNOUNCE_TITLE_MAX = 200;
export const ANNOUNCE_BODY_MAX = 5000;

export function isAnnounceTarget(v: unknown): v is AnnounceTarget {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(ANNOUNCE_TARGETS, v);
}

export type Announcement = {
  id: number;
  target: AnnounceTarget;
  title: string;
  body: string;
  /** unix seconds */
  createdAt: number;
  updatedAt: number;
};

/** ประกาศที่นักเรียนคอร์สนี้ควรเห็น */
export const targetsFor = (course: Course): AnnounceTarget[] => ["all", course];
