import { useEffect, useState } from "react";
import { STATUS_LABELS, type StudentProgress } from "../../shared/admin";
import { COURSES } from "../../shared/validate";
import { fmtDateTime } from "../components/AnnouncementList";
import { api, ApiError } from "../lib/api";
import { navigate } from "../lib/router";

const fmtPos = (s: number) => {
  const t = Math.max(0, Math.floor(s));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = String(t % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};

const fmtWatch = (s: number) => {
  if (s <= 0) return "–";
  if (s < 60) return `${s} วินาที`;
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h ? `${h} ชม. ${m} นาที` : `${m} นาที`;
};

type Props = { studentId: number; onUnauthorized: () => void };

/** ประวัติการเรียนของนักเรียน 1 คน: ทุกคลิปในคอร์ส */
export function StudentProgressPage({ studentId, onUnauthorized }: Props) {
  const [data, setData] = useState<StudentProgress | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<StudentProgress>(`/admin/students/${studentId}/progress`)
      .then(setData)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) onUnauthorized();
        else if (err instanceof ApiError && err.status === 404) setError("ไม่พบนักเรียนคนนี้");
        else setError("ระบบขัดข้อง กรุณาลองใหม่");
      });
  }, [studentId, onUnauthorized]);

  const st = data?.student;
  const sum = data?.summary;

  return (
    <section className="ph-admin">
      <div>
        <button type="button" className="ph-btn ph-btn--sm ph-btn--light" onClick={() => navigate("/admin")}>
          ← รายชื่อนักเรียน
        </button>
      </div>

      {error ? <p className="ph-empty">{error}</p> : null}

      {st && sum ? (
        <div className="ph-card ph-prog-head">
          <div className="ph-student__head">
            <strong>
              {st.firstName} {st.lastName}
            </strong>
            <span className={`ph-badge ph-badge--${st.status}`}>{STATUS_LABELS[st.status]}</span>
          </div>
          <p className="ph-m0 ph-small">
            {COURSES[st.course]} · {st.school} · {st.studentPhone}
          </p>
          <dl className="ph-stats">
            <div>
              <dt>เปิดดูแล้ว</dt>
              <dd>
                {sum.videosStarted}/{sum.videosTotal} คลิป
              </dd>
            </div>
            <div>
              <dt>ดูจบ</dt>
              <dd>{sum.videosCompleted} คลิป</dd>
            </div>
            <div>
              <dt>เวลาดูรวม</dt>
              <dd>{fmtWatch(sum.watchSecondsTotal)}</dd>
            </div>
            <div>
              <dt>ดูล่าสุด</dt>
              <dd>{sum.lastWatchedAt ? fmtDateTime(sum.lastWatchedAt) : "ยังไม่เคยดู"}</dd>
            </div>
          </dl>
        </div>
      ) : null}

      {data && data.chapters.length === 0 ? <p className="ph-empty">คอร์สนี้ยังไม่มีคลิป</p> : null}

      {data?.chapters.map((ch, i) => (
        <div key={ch.id} className="ph-card ph-prog-chapter">
          <h2 className="ph-chapter-title">
            <span className="ph-chapter-no">บทที่ {i + 1}</span> {ch.title}
          </h2>
          {ch.videos.length === 0 ? <p className="ph-small ph-m0">ยังไม่มีคลิป</p> : null}
          <table className="ph-prog-table">
            <thead>
              <tr>
                <th scope="col">คลิป</th>
                <th scope="col">ดูแล้ว</th>
                <th scope="col">หยุดล่าสุดที่</th>
                <th scope="col">ดูล่าสุด</th>
                <th scope="col">เวลาดูรวม</th>
              </tr>
            </thead>
            <tbody>
              {ch.videos.map((v) => (
                <tr key={v.id} className={v.lastWatchedAt ? undefined : "is-unwatched"}>
                  <th scope="row">{v.title}</th>
                  <td data-label="ดูแล้ว">
                    <span className="ph-prog-pct">
                      <span className="ph-bar">
                        <span style={{ width: `${v.percent}%` }} />
                      </span>
                      {v.percent}%
                    </span>
                  </td>
                  <td data-label="หยุดล่าสุดที่">
                    {v.lastPositionSec !== null
                      ? `${fmtPos(v.lastPositionSec)}${v.durationSec ? ` / ${fmtPos(v.durationSec)}` : ""}`
                      : "–"}
                  </td>
                  <td data-label="ดูล่าสุด">{v.lastWatchedAt ? fmtDateTime(v.lastWatchedAt) : "ยังไม่เปิดดู"}</td>
                  <td data-label="เวลาดูรวม">{fmtWatch(v.watchSeconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  );
}
