import type { Course } from "./validate";

export const QUESTION_MAX = 500;
export const ANSWER_MAX = 2000;
/** นักเรียน 1 คนถามได้กี่ข้อต่อวัน (นับตามวันเวลาไทย) */
export const QUESTIONS_PER_DAY = 5;

/** คำถามที่นักเรียนเห็นใต้คลิป (ไม่มีชื่อผู้ถาม) */
export type ClipQuestion = {
  id: number;
  positionSec: number | null;
  body: string;
  answer: string | null;
  answeredAt: number | null;
  createdAt: number;
  mine: boolean;
  /** ครูซ่อนจากเพื่อน (เห็นเฉพาะคำถามของตัวเอง) */
  hidden: boolean;
};
export type ClipQuestions = { questions: ClipQuestion[]; remainingToday: number };

export type QuestionTab = "pending" | "answered" | "hidden";
export const QUESTION_TABS: Record<QuestionTab, string> = { pending: "รอตอบ", answered: "ตอบแล้ว", hidden: "ซ่อนแล้ว" };

/** คำถามในกล่องของครู */
export type InboxQuestion = {
  id: number;
  studentId: number;
  studentName: string;
  course: Course;
  videoId: number;
  videoTitle: string;
  youtubeId: string;
  positionSec: number | null;
  body: string;
  answer: string | null;
  answeredAt: number | null;
  hidden: boolean;
  createdAt: number;
};
export type QuestionInbox = { questions: InboxQuestion[]; counts: Record<QuestionTab, number> };

export const fmtPos = (s: number) => {
  const t = Math.max(0, Math.floor(s));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = String(t % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};
