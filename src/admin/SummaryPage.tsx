import { useEffect, useState } from "react";
import type { AdminSummary } from "../../shared/admin";
import { fmtPos } from "../../shared/questions";
import { fmtDateTime } from "../components/AnnouncementList";
import { api, ApiError } from "../lib/api";
import { navigate } from "../lib/router";

type Props = { onUnauthorized: () => void };

const ago = (sec: number) => {
  const m = Math.max(0, Math.floor((Date.now() / 1000 - sec) / 60));
  if (m < 1) return "เมื่อสักครู่";
  if (m < 60) return `${m} นาทีที่แล้ว`;
  if (m < 24 * 60) return `${Math.floor(m / 60)} ชม. ที่แล้ว`;
  return fmtDateTime(sec);
};

const go = (to: string) => {
  navigate(to);
  window.scrollTo(0, 0);
};

/** หน้าแรกหลังบ้าน: งานที่รอครู + ตัวเลขสำคัญ */
export function SummaryPage({ onUnauthorized }: Props) {
  const [s, setS] = useState<AdminSummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<AdminSummary>("/admin/summary")
      .then(setS)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) onUnauthorized();
        else setError("ระบบขัดข้อง กรุณาลองใหม่");
      });
  }, [onUnauthorized]);

  if (error)
    return (
      <p className="ph-error" role="alert">
        {error}
      </p>
    );
  if (!s) return null;

  const q = s.pendingQuestions;
  const total = s.approved.m12 + s.approved.m4;

  // การ์ดใหญ่: คำถามรอตอบ → นักเรียนรอยืนยัน → ไม่มีงานค้าง
  const hero =
    q.count > 0 && q.latest ? (
      <button type="button" className="ph-hero" onClick={() => go("/admin/questions")}>
        <span className="ph-hero__tile" aria-hidden="true">
          <b>รอตอบ</b>
          <strong>{q.count}</strong>
          <small>คำถาม</small>
        </span>
        <span className="ph-hero__body">
          <span className="ph-hero__k">งานที่รอครู · ถามล่าสุด {ago(q.latest.createdAt)}</span>
          <span className="ph-hero__title">“{q.latest.body}”</span>
          <span className="ph-hero__k">
            {q.latest.studentName.split(" ")[0]} · {q.latest.videoTitle}
            {q.latest.positionSec !== null ? ` ⏱ ${fmtPos(q.latest.positionSec)}` : ""}
          </span>
        </span>
      </button>
    ) : s.pendingStudents > 0 ? (
      <button type="button" className="ph-hero" onClick={() => go("/admin/students?status=pending")}>
        <span className="ph-hero__tile" aria-hidden="true">
          <b>รอยืนยัน</b>
          <strong>{s.pendingStudents}</strong>
          <small>คน</small>
        </span>
        <span className="ph-hero__body">
          <span className="ph-hero__k">งานที่รอครู</span>
          <span className="ph-hero__title">นักเรียนรอยืนยัน {s.pendingStudents} คน</span>
          <span className="ph-hero__k">กดเพื่อยืนยันหรือปฏิเสธ</span>
        </span>
      </button>
    ) : (
      <div className="ph-hero">
        <span className="ph-hero__tile" aria-hidden="true">
          <b>งานค้าง</b>
          <strong>0</strong>
          <small>รายการ</small>
        </span>
        <span className="ph-hero__body">
          <span className="ph-hero__title">ไม่มีงานค้าง 🎉</span>
          <span className="ph-hero__k">ไม่มีคำถามรอตอบ และไม่มีนักเรียนรอยืนยัน</span>
        </span>
      </div>
    );

  return (
    <section className="ph-admin ph-stack">
      {hero}
      <div className="ph-stats">
        <button type="button" className="ph-stat" onClick={() => go("/admin/students?status=approved")}>
          <span className="ph-stat__k">
            นักเรียนที่ยืนยันแล้ว <span aria-hidden="true">›</span>
          </span>
          <span className="ph-stat__v">
            {total}
            <small> คน</small>
          </span>
          <span className="ph-stat__s">
            ม.1&amp;2 {s.approved.m12} · ม.4 {s.approved.m4}
          </span>
        </button>
        <button type="button" className="ph-stat" onClick={() => go("/admin/overview?filter=inactive")}>
          <span className="ph-stat__k">
            ไม่เข้าเรียนเกิน 7 วัน <span aria-hidden="true">›</span>
          </span>
          <span className="ph-stat__v" style={s.inactive.count ? { color: "var(--orange)" } : undefined}>
            {s.inactive.count}
            <small> คน</small>
          </span>
          <span className="ph-stat__s">ยังไม่เคยดูเลย {s.inactive.never} คน</span>
        </button>
      </div>
      {s.pendingStudents > 0 || s.unfinishedVideos > 0 ? (
        <div className="ph-alerts">
          {s.pendingStudents > 0 ? (
            <button type="button" className="ph-alert-row" onClick={() => go("/admin/students?status=pending")}>
              <span className="ph-alert-row__i" aria-hidden="true">
                🧑‍🎓
              </span>
              <span className="ph-alert-row__t">นักเรียนรอยืนยัน</span>
              <span className="ph-alert-row__v">{s.pendingStudents} คน</span>
              <span className="ph-alert-row__go" aria-hidden="true">
                ›
              </span>
            </button>
          ) : null}
          {s.unfinishedVideos > 0 ? (
            <button type="button" className="ph-alert-row" onClick={() => go("/admin/overview")}>
              <span className="ph-alert-row__i" aria-hidden="true">
                🎬
              </span>
              <span className="ph-alert-row__t">คลิปที่ยังไม่มีใครดูจบ</span>
              <span className="ph-alert-row__v">{s.unfinishedVideos} คลิป</span>
              <span className="ph-alert-row__go" aria-hidden="true">
                ›
              </span>
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
