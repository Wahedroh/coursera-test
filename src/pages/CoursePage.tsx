import { useEffect, useState } from "react";
import type { CourseOutline } from "../../shared/content";
import { COURSES, type Me } from "../../shared/validate";
import { AnnouncementList } from "../components/AnnouncementList";
import { Card } from "../components/Card";
import { StickerTitle } from "../components/StickerTitle";
import { api, ApiError } from "../lib/api";
import { navigate } from "../lib/router";

const fmtMin = (s: number | null) => (s ? `${Math.max(1, Math.round(s / 60))} นาที` : "");

type Props = { me: Me; onLogout: () => void; onAuthError: (status: number) => void };

/** หน้าแรกของนักเรียนที่ครูยืนยันแล้ว: เรียนต่อ + บทและคลิป */
export function CoursePage({ me, onLogout, onAuthError }: Props) {
  const [data, setData] = useState<CourseOutline | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<CourseOutline>("/course")
      .then(setData)
      .catch((err) => {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) onAuthError(err.status);
        else setError("โหลดรายการคลิปไม่ได้ กรุณาลองใหม่");
      });
  }, [onAuthError]);

  const logout = async () => {
    await api("/auth/logout", {}).catch(() => undefined);
    onLogout();
  };

  return (
    <>
      <StickerTitle top="เรียนย้อนหลัง" bottom="ฟิสิกส์" subtitle={COURSES[me.course]} />
      <div className="ph-stack">
        {data?.resume ? (
          <button type="button" className="ph-resume" onClick={() => navigate(`/watch/${data.resume!.videoId}`)}>
            <span className="ph-resume__label">▶ เรียนต่อ</span>
            <span className="ph-resume__title">{data.resume.title}</span>
            <span className="ph-bar" aria-label={`ดูแล้ว ${data.resume.percent}%`}>
              <span style={{ width: `${data.resume.percent}%` }} />
            </span>
          </button>
        ) : null}

        <AnnouncementList />

        {error ? (
          <p className="ph-error" role="alert">
            {error}
          </p>
        ) : null}

        {data && data.chapters.length === 0 ? (
          <Card>
            <p className="ph-note">ยังไม่มีคลิปในคอร์สนี้</p>
          </Card>
        ) : null}

        {data?.chapters.map((ch, ci) => (
          <Card key={ch.id}>
            <h2 className="ph-chapter-title">
              <span className="ph-chapter-no">บทที่ {ci + 1}</span> {ch.title}
            </h2>
            {ch.videos.length === 0 ? <p className="ph-note">ยังไม่มีคลิป</p> : null}
            <ol className="ph-videos">
              {ch.videos.map((v) => (
                <li key={v.id}>
                  <button type="button" className="ph-video" onClick={() => navigate(`/watch/${v.id}`)}>
                    <span className={`ph-video__icon${v.percent >= 100 ? " is-done" : ""}`} aria-hidden="true">
                      {v.percent >= 100 ? "✓" : "▶"}
                    </span>
                    <span className="ph-video__body">
                      <span className="ph-video__title">
                        {v.isNew ? <span className="ph-new">ใหม่</span> : null}
                        {v.title}
                      </span>
                      <span className="ph-video__meta">
                        {fmtMin(v.durationSec)}
                        {v.percent > 0 ? ` · ดูแล้ว ${v.percent}%` : ""}
                      </span>
                      <span className="ph-bar">
                        <span style={{ width: `${v.percent}%` }} />
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </Card>
        ))}

        <div className="ph-actions ph-actions--center">
          <button type="button" className="ph-btn ph-btn--sm ph-btn--light" onClick={() => navigate("/account")}>
            เปลี่ยนรหัสผ่าน
          </button>
          <button type="button" className="ph-btn ph-btn--sm ph-btn--light" onClick={logout}>
            ออกจากระบบ ({me.firstName})
          </button>
        </div>
      </div>
    </>
  );
}
