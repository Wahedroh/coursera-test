/** การ์ด "เรียนต่อ": คลิปที่ดูค้างล่าสุด หรือคลิปแรกที่ยังไม่จบ (started = เคยเปิดดูแล้ว) */
export type HomeResume = {
  videoId: number;
  title: string;
  chapterNo: number;
  indexInChapter: number;
  chapterCount: number;
  lastPositionSec: number;
  percent: number;
  started: boolean;
};
export type HomeVideo = { id: number; title: string; chapterNo: number; durationSec: number | null };
export type HomeData = {
  resume: HomeResume | null;
  stats: { done: number; total: number; weekSeconds: number };
  alerts: { newAnswers: number; inProgress: number };
  newVideos: HomeVideo[];
};
