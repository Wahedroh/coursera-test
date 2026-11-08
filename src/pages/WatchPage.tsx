import { useCallback, useEffect, useState } from "react";
import type { WatchVideo } from "../../shared/content";
import type { Me } from "../../shared/validate";
import { ProtectedPlayer, type ProgressReport } from "../components/ProtectedPlayer";
import { api, ApiError } from "../lib/api";
import { navigate } from "../lib/router";

type Props = { me: Me; videoId: number; onAuthError: (status: number) => void };

export function WatchPage({ me, videoId, onAuthError }: Props) {
  const [video, setVideo] = useState<WatchVideo | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setVideo(null);
    setError("");
    api<WatchVideo>(`/videos/${videoId}`)
      .then(setVideo)
      .catch((err) => {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) onAuthError(err.status);
        else if (err instanceof ApiError && err.status === 404) setError("ไม่พบคลิปนี้");
        else setError("โหลดคลิปไม่ได้ กรุณาลองใหม่");
      });
  }, [videoId, onAuthError]);

  const save = useCallback(
    (r: ProgressReport) => {
      api(`/videos/${videoId}/progress`, { position: r.position, delta: r.delta, duration: r.duration }, { keepalive: r.keepalive }).catch(
        (err) => {
          if (err instanceof ApiError && (err.status === 401 || err.status === 403)) onAuthError(err.status);
        },
      );
    },
    [videoId, onAuthError],
  );

  // ดูจบเกือบทั้งคลิปแล้ว → เริ่มใหม่จากต้น
  const startAt =
    video && video.durationSec && video.lastPositionSec >= video.durationSec - 10 ? 0 : (video?.lastPositionSec ?? 0);

  return (
    <div className="ph-watch">
      <div className="ph-watch__top">
        <button type="button" className="ph-btn ph-btn--sm ph-btn--light" onClick={() => navigate("/")}>
          ← รายการคลิป
        </button>
      </div>

      {error ? <p className="ph-empty">{error}</p> : null}

      {video ? (
        <>
          <ProtectedPlayer
            key={video.id}
            youtubeId={video.youtubeId}
            startAt={startAt}
            watermark={`${me.firstName} ${me.lastName} ${me.studentPhone}`}
            onProgress={save}
          />
          <section className="ph-card ph-watch__info">
            <p className="ph-watch__chapter">{video.chapterTitle}</p>
            <h1 className="ph-watch__title">{video.title}</h1>
            {startAt > 0 ? <p className="ph-small ph-m0">เล่นต่อจากจุดที่ดูค้างไว้</p> : null}
            <div className="ph-actions">
              <button
                type="button"
                className="ph-btn ph-btn--sm ph-btn--ghost"
                disabled={!video.prevId}
                onClick={() => video.prevId && navigate(`/watch/${video.prevId}`)}
              >
                ← คลิปก่อนหน้า
              </button>
              <button
                type="button"
                className="ph-btn ph-btn--sm"
                disabled={!video.nextId}
                onClick={() => video.nextId && navigate(`/watch/${video.nextId}`)}
              >
                คลิปถัดไป →
              </button>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
