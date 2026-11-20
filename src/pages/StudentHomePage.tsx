import { useEffect, useState } from "react";
import type { HomeData } from "../../shared/home";
import { COURSES, type Me } from "../../shared/validate";
import { AnnouncementList } from "../components/AnnouncementList";
import { StickerTitle } from "../components/StickerTitle";
import { StudentShell } from "../components/StudentShell";
import { api, ApiError } from "../lib/api";
import { fmtMin, fmtPos, fmtStudyTime } from "../lib/format";
import { navigate } from "../lib/router";

type Props = { me: Me; onAuthError: (status: number) => void };

const go = (to: string) => {
  navigate(to);
  window.scrollTo(0, 0);
};

/** หน้าแรกของนักเรียนที่ครูยืนยันแล้ว: เรียนต่อ + ตัวเลข + แจ้งเตือน + ประกาศ + คลิปใหม่ */
export function StudentHomePage({ me, onAuthError }: Props) {
  const [data, setData] = useState<HomeData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<HomeData>("/home")
      .then(setData)
      .catch((err) => {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) onAuthError(err.status);
        else setError("โหลดข้อมูลไม่ได้ กรุณาลองใหม่");
      });
  }, [onAuthError]);

  const r = data?.resume;
  const t = fmtStudyTime(data?.stats.weekSeconds ?? 0);
  const a = data?.alerts;

  return (
    <StudentShell active="home" newAnswers={data?.alerts.newAnswers ?? 0}>
      <StickerTitle top="เรียนย้อนหลัง" bottom="ฟิสิกส์" subtitle={COURSES[me.course]} />
      <div className="ph-stack">
        {error ? (
          <p className="ph-error" role="alert">
            {error}
          </p>
        ) : null}

        {r ? (
          <button type="button" className="ph-hero" onClick={() => go(`/watch/${r.videoId}`)}>
            <span className="ph-hero__tile" aria-hidden="true">
              <b>บทที่</b>
              <strong>{r.chapterNo}</strong>
              <small>
                คลิป {r.indexInChapter}/{r.chapterCount}
              </small>
              <span className="ph-hero__play">▶</span>
            </span>
            <span className="ph-hero__body">
              <span className="ph-hero__k">
                {r.started ? `▶ เรียนต่อ · ดูค้างไว้ที่ ${fmtPos(r.lastPositionSec)}` : "▶ เริ่มเรียน"}
              </span>
              <span className="ph-hero__title">{r.title}</span>
              <span className="ph-hero__pct">
                {r.percent}%<small>ดูแล้ว</small>
              </span>
              <span className="ph-bar" aria-hidden="true">
                <span style={{ width: `${r.percent}%` }} />
              </span>
            </span>
          </button>
        ) : null}

        {data && data.stats.total > 0 ? (
          <div className="ph-stats">
            <button type="button" className="ph-stat" onClick={() => go("/clips")}>
              <span className="ph-stat__k">
                ดูจบแล้ว <span aria-hidden="true">›</span>
              </span>
              <span className="ph-stat__v">
                {data.stats.done}
                <small>/{data.stats.total} คลิป</small>
              </span>
              <span className="ph-stat__s">ทั้งคอร์ส {Math.round((data.stats.done / data.stats.total) * 100)}%</span>
            </button>
            <div className="ph-stat">
              <span className="ph-stat__k">เวลาเรียน</span>
              <span className="ph-stat__v">
                {t.h ? (
                  <>
                    {t.h}
                    <small> ชม. </small>
                  </>
                ) : null}
                {t.m}
                <small> นาที</small>
              </span>
              <span className="ph-stat__s">7 วันล่าสุด</span>
            </div>
          </div>
        ) : null}

        {a && (a.newAnswers > 0 || a.inProgress > 0) ? (
          <div className="ph-alerts">
            {a.newAnswers > 0 ? (
              <button type="button" className="ph-alert-row" onClick={() => go("/questions")}>
                <span className="ph-alert-row__i" aria-hidden="true">
                  💬
                </span>
                <span className="ph-alert-row__t">ครูตอบคำถามแล้ว</span>
                <span className="ph-alert-row__v">{a.newAnswers} ข้อ</span>
                <span className="ph-alert-row__go" aria-hidden="true">
                  ›
                </span>
              </button>
            ) : null}
            {a.inProgress > 0 ? (
              <button type="button" className="ph-alert-row" onClick={() => go("/clips?open=inprogress")}>
                <span className="ph-alert-row__i" aria-hidden="true">
                  ⏸
                </span>
                <span className="ph-alert-row__t">ดูค้างไว้</span>
                <span className="ph-alert-row__v">{a.inProgress} คลิป</span>
                <span className="ph-alert-row__go" aria-hidden="true">
                  ›
                </span>
              </button>
            ) : null}
          </div>
        ) : null}

        <AnnouncementList limit={2} />

        {data && data.newVideos.length > 0 ? (
          <>
            <div className="ph-group-h">
              <h2>คลิปใหม่</h2>
              <p>{data.newVideos.length} คลิป · เพิ่มใน 7 วันล่าสุด</p>
            </div>
            <ul className="ph-vlist">
              {data.newVideos.map((v) => (
                <li key={v.id}>
                  <button type="button" className="ph-vrow" onClick={() => go(`/watch/${v.id}`)}>
                    <span className="ph-vrow__i" aria-hidden="true">
                      ▶
                    </span>
                    <span className="ph-vrow__b">
                      <span className="ph-vrow__t">{v.title}</span>
                      <span className="ph-vrow__m">
                        บทที่ {v.chapterNo}
                        {v.durationSec ? ` · ${fmtMin(v.durationSec)}` : ""}
                      </span>
                    </span>
                    <span className="ph-vrow__s">
                      <span className="is-new-t">ใหม่</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {data && data.stats.total === 0 ? <p className="ph-empty">ยังไม่มีคลิปในคอร์สนี้</p> : null}
      </div>
    </StudentShell>
  );
}
