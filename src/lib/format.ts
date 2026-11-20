export { fmtPos } from "../../shared/questions";

/** วินาที → "2 ชม. 15 นาที" / "15 นาที" */
export function fmtStudyTime(sec: number): { h: number; m: number } {
  const m = Math.floor(sec / 60);
  return { h: Math.floor(m / 60), m: m % 60 };
}

export const fmtMin = (s: number | null) => (s ? `${Math.max(1, Math.round(s / 60))} นาที` : "");
