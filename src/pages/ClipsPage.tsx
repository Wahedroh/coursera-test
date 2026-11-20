import { useEffect, useState } from "react";
import { isInProgress, type CourseOutline, type CourseVideo } from "../../shared/content";
import { StickerTitle } from "../components/StickerTitle";
import { StudentShell } from "../components/StudentShell";
import { api, ApiError } from "../lib/api";
import { fmtMin, fmtPos } from "../lib/format";
import { navigate } from "../lib/router";

type Props = { onAuthError: (status: number) => void };

const isDone = (v: CourseVideo) => v.percent >= 100;
const isPart = (v: CourseVideo) => isInProgress(v.percent, v.lastPositionSec);

function VideoRow({ v }: { v: CourseVideo }) {
  const done = isDone(v);
  const part = isPart(v);
  return (
    <li>
      <button
        type="button"
        className="ph-crow"
        onClick={() => {
          navigate(`/watch/${v.id}`);
          window.scrollTo(0, 0);
        }}
      >
        <span className={`ph-crow__i${done ? " is-done" : part ? " is-part" : ""}`} aria-hidden="true">
          {done ? "✓" : "▶"}
        </span>
        <span className="ph-crow__b">
          <span className="ph-crow__t">{v.title}</span>
          <span className="ph-crow__m">{fmtMin(v.durationSec)}</span>
        </span>
        <span className="ph-crow__s">
          {done ? (
            <>
              <b className="is-done-t">✓</b>
              <span className="is-done-t">จบแล้ว</span>
            </>
          ) : part ? (
            <>
              <b className="is-part">{v.percent}%</b>
              <span className="is-part">ค้างที่ {fmtPos(v.lastPositionSec)}</span>
            </>
          ) : v.isNew ? (
            <span className="is-new-t">ใหม่</span>
          ) : (
            <span className="is-unseen">ยังไม่ได้ดู</span>
          )}
        </span>
      </button>
    </li>
  );
}

/** คลิปทั้งหมดของคอร์ส จัดกลุ่มตามบท (บทที่ดูจบครบย่อไว้ กดเพื่อกาง) */
export function ClipsPage({ onAuthError }: Props) {
  const [data, setData] = useState<CourseOutline | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<Set<number>>(new Set());

  useEffect(() => {
    api<CourseOutline>("/course")
      .then(setData)
      .catch((err) => {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) onAuthError(err.status);
        else setError("โหลดรายการคลิปไม่ได้ กรุณาลองใหม่");
      });
  }, [onAuthError]);

  // มาจากแถว "ดูค้างไว้" → เลื่อนไปบทแรกที่มีคลิปค้าง
  useEffect(() => {
    if (!data || new URLSearchParams(window.location.search).get("open") !== "inprogress") return;
    const ch = data.chapters.find((c) => c.videos.some(isPart));
    if (ch) document.getElementById(`chap-${ch.id}`)?.scrollIntoView({ block: "start" });
  }, [data]);

  return (
    <StudentShell active="clips">
      <StickerTitle top="เรียนย้อนหลัง" bottom="ฟิสิกส์" subtitle="คลิปทั้งหมด" />
      <div className="ph-stack">
        {error ? (
          <p className="ph-error" role="alert">
            {error}
          </p>
        ) : null}
        {data && data.chapters.length === 0 ? <p className="ph-empty">ยังไม่มีคลิปในคอร์สนี้</p> : null}
        {data?.chapters.map((ch, ci) => {
          const done = ch.videos.filter(isDone).length;
          const allDone = ch.videos.length > 0 && done === ch.videos.length;
          if (allDone && !open.has(ch.id)) {
            return (
              <button
                key={ch.id}
                id={`chap-${ch.id}`}
                type="button"
                className="ph-chap-done"
                aria-expanded="false"
                onClick={() => setOpen((s) => new Set(s).add(ch.id))}
              >
                <b>
                  ✓ บทที่ {ci + 1} {ch.title}
                </b>
                <span>ดูจบครบ {ch.videos.length} คลิป ▾</span>
              </button>
            );
          }
          return (
            <section key={ch.id} id={`chap-${ch.id}`} className="ph-stack">
              <div className="ph-group-h">
                <h2>
                  บทที่ {ci + 1} {ch.title}
                </h2>
                <p>{ch.videos.length ? `${ch.videos.length} คลิป · ดูจบ ${done}` : "ยังไม่มีคลิป"}</p>
              </div>
              {ch.videos.length ? (
                <ul className="ph-clist">
                  {ch.videos.map((v) => (
                    <VideoRow key={v.id} v={v} />
                  ))}
                </ul>
              ) : null}
            </section>
          );
        })}
      </div>
    </StudentShell>
  );
}
