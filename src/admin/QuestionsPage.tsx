import { useCallback, useEffect, useState } from "react";
import { ANSWER_MAX, fmtPos, QUESTION_TABS, type InboxQuestion, type QuestionInbox, type QuestionTab } from "../../shared/questions";
import { COURSES, type Course } from "../../shared/validate";
import { fmtDateTime } from "../components/AnnouncementList";
import { api, ApiError } from "../lib/api";
import { navigate } from "../lib/router";

type Props = { onUnauthorized: () => void; onChanged: () => void };

/** ลิงก์เปิดคลิปตรงนาทีที่นักเรียนถาม (ครูเปิดใน YouTube ได้) */
const clipUrl = (q: InboxQuestion) =>
  `https://www.youtube.com/watch?v=${q.youtubeId}${q.positionSec !== null ? `&t=${q.positionSec}s` : ""}`;

/** กล่องคำถามจากนักเรียน: รอตอบ / ตอบแล้ว / ซ่อนแล้ว */
export function QuestionsPage({ onUnauthorized, onChanged }: Props) {
  const [tab, setTab] = useState<QuestionTab>("pending");
  const [course, setCourse] = useState<Course | "">("");
  const [data, setData] = useState<QuestionInbox | null>(null);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const handle = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) onUnauthorized();
      else setError(err instanceof ApiError && err.body?.message ? err.body.message : "ระบบขัดข้อง กรุณาลองใหม่");
    },
    [onUnauthorized],
  );

  const load = useCallback(() => {
    const q = new URLSearchParams({ tab, ...(course ? { course } : {}) });
    return api<QuestionInbox>(`/admin/questions?${q}`)
      .then((r) => {
        setData(r);
        setDrafts(Object.fromEntries(r.questions.map((x) => [x.id, x.answer ?? ""])));
      })
      .catch(handle);
  }, [tab, course, handle]);

  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  async function act(id: number, path: string, body: Record<string, unknown>) {
    setError("");
    setBusyId(id);
    try {
      await api(`/admin/questions/${id}/${path}`, body);
      await load();
      onChanged();
    } catch (err) {
      handle(err);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="ph-admin">
      <div className="ph-tabs" role="tablist" aria-label="สถานะคำถาม">
        {(Object.keys(QUESTION_TABS) as QuestionTab[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={`ph-tab${tab === t ? " is-active" : ""}`}
            onClick={() => setTab(t)}
          >
            {QUESTION_TABS[t]} {data ? <span className="ph-count">{data.counts[t]}</span> : null}
          </button>
        ))}
      </div>
      <div className="ph-tabs" role="tablist" aria-label="คอร์ส">
        {([["", "ทุกคอร์ส"], ...Object.entries(COURSES)] as [Course | "", string][]).map(([c, label]) => (
          <button
            key={c || "all"}
            type="button"
            role="tab"
            aria-selected={course === c}
            className={`ph-tab${course === c ? " is-active" : ""}`}
            onClick={() => setCourse(c)}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="ph-error" role="alert">
          {error}
        </p>
      ) : null}
      {data && data.questions.length === 0 ? <p className="ph-empty">ไม่มีคำถามในหมวดนี้</p> : null}

      <ul className="ph-inbox">
        {data?.questions.map((q) => {
          const draft = drafts[q.id] ?? "";
          const busy = busyId === q.id;
          return (
            <li key={q.id} className="ph-inbox__item">
              <div className="ph-inbox__top">
                <a
                  className="ph-inbox__who"
                  href={`/admin/students/${q.studentId}`}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(`/admin/students/${q.studentId}`);
                  }}
                >
                  {q.studentName} · {COURSES[q.course]}
                </a>
                <span className="ph-small">{fmtDateTime(q.createdAt)}</span>
              </div>
              <a className="ph-inbox__clip" href={clipUrl(q)} target="_blank" rel="noopener noreferrer">
                ▶ {q.videoTitle}
                {q.positionSec !== null ? ` · ⏱ ${fmtPos(q.positionSec)}` : ""} ↗
              </a>
              <p className="ph-inbox__q">{q.body}</p>
              <label className="ph-sr" htmlFor={`ans-${q.id}`}>
                คำตอบ
              </label>
              <textarea
                id={`ans-${q.id}`}
                className="ph-input ph-inbox__answer"
                placeholder="พิมพ์คำตอบ…"
                maxLength={ANSWER_MAX}
                value={draft}
                onChange={(e) => setDrafts((d) => ({ ...d, [q.id]: e.target.value }))}
              />
              {q.answeredAt ? <p className="ph-small ph-m0">ตอบเมื่อ {fmtDateTime(q.answeredAt)}</p> : null}
              <div className="ph-actions">
                <button
                  type="button"
                  className="ph-btn ph-btn--sm ph-btn--ghost"
                  disabled={busy}
                  onClick={() => act(q.id, "hidden", { hidden: !q.hidden })}
                >
                  {q.hidden ? "เลิกซ่อน" : "ซ่อนจากเพื่อน"}
                </button>
                <button
                  type="button"
                  className="ph-btn ph-btn--sm"
                  disabled={busy || !draft.trim() || draft.trim() === (q.answer ?? "")}
                  onClick={() => act(q.id, "answer", { answer: draft })}
                >
                  {q.answer ? "บันทึกคำตอบ" : "ส่งคำตอบ"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
