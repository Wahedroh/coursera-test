import { useEffect, useState } from "react";
import type { MyQuestion, MyQuestions } from "../../shared/questions";
import { fmtDateTime } from "../components/AnnouncementList";
import { StickerTitle } from "../components/StickerTitle";
import { StudentShell } from "../components/StudentShell";
import { api, ApiError } from "../lib/api";
import { fmtPos } from "../lib/format";
import { navigate } from "../lib/router";

type Props = { onAuthError: (status: number) => void };
type Tab = "answered" | "pending";

// API บันทึกว่า "เห็นคำตอบแล้ว" ทุกครั้งที่โหลด ถ้าโหลดซ้ำทันที (React StrictMode) ป้าย "ใหม่" จะหาย
let recent: { at: number; req: Promise<MyQuestions> } | null = null;
function loadOnce() {
  if (!recent || Date.now() - recent.at > 5000) recent = { at: Date.now(), req: api<MyQuestions>("/my-questions") };
  return recent.req;
}

/** คำถามของฉันจากทุกคลิป: ครูตอบแล้ว / รอครูตอบ */
export function MyQuestionsPage({ onAuthError }: Props) {
  const [items, setItems] = useState<MyQuestion[] | null>(null);
  const [tab, setTab] = useState<Tab>("answered");

  useEffect(() => {
    loadOnce()
      .then((r) => {
        setItems(r.questions);
        if (!r.questions.some((q) => q.answer !== null) && r.questions.length) setTab("pending");
      })
      .catch((err) => {
        recent = null;
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) onAuthError(err.status);
        else setItems([]);
      });
  }, [onAuthError]);

  const answered = items?.filter((q) => q.answer !== null) ?? [];
  const pending = items?.filter((q) => q.answer === null) ?? [];
  const list = tab === "answered" ? answered : pending;
  const open = (q: MyQuestion) => {
    navigate(`/watch/${q.videoId}${q.positionSec !== null ? `?t=${q.positionSec}` : ""}`);
    window.scrollTo(0, 0);
  };

  return (
    <StudentShell active="questions">
      <StickerTitle top="เรียนย้อนหลัง" bottom="ฟิสิกส์" subtitle="คำถามของฉัน" />
      <div className="ph-stack">
        <div className="ph-tabs" role="tablist" aria-label="สถานะคำถาม">
          {(
            [
              ["answered", "ครูตอบแล้ว", answered.length],
              ["pending", "รอครูตอบ", pending.length],
            ] as const
          ).map(([k, label, n]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              className={`ph-tab${tab === k ? " is-active" : ""}`}
              onClick={() => setTab(k)}
            >
              {label} {items ? <span className="ph-count">{n}</span> : null}
            </button>
          ))}
        </div>
        {items ? (
          <section className="ph-card ph-qa">
            {list.length === 0 ? (
              <p className="ph-note ph-m0">
                {items.length === 0 ? "ยังไม่มีคำถาม ถามครูได้ใต้คลิปที่ดูอยู่" : "ไม่มีคำถามในหมวดนี้"}
              </p>
            ) : (
              <ul className="ph-qa__list">
                {list.map((q) => (
                  <li key={q.id} className="ph-q">
                    <div className="ph-q__meta">
                      {q.isNew ? <span className="ph-new ph-m0">ใหม่</span> : null}
                      <button type="button" className="ph-q__clip" onClick={() => open(q)}>
                        {q.positionSec !== null ? <span className="ph-q__t">⏱ {fmtPos(q.positionSec)}</span> : null}▶{" "}
                        {q.videoTitle}
                      </button>
                      <span>{fmtDateTime(q.createdAt)}</span>
                      {q.hidden ? <span className="ph-q__hidden">ครูซ่อนจากเพื่อนในห้อง</span> : null}
                    </div>
                    <p className="ph-q__body">{q.body}</p>
                    {q.answer !== null ? (
                      <p className="ph-q__a">
                        <b>ครูตอบ:</b> {q.answer}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {list.length ? <p className="ph-small ph-m0">กดชื่อคลิปเพื่อเปิดคลิปตรงนาทีที่ถาม</p> : null}
          </section>
        ) : null}
      </div>
    </StudentShell>
  );
}
