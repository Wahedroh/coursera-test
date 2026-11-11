import { useEffect, useRef, useState } from "react";
import { loadYouTube, YTState, type YTPlayer } from "../lib/youtube";

// ตัวเล่น YouTube แบบป้องกัน (ดู docs/PLAN.md หัวข้อ 4.4)
// - ซ่อนปุ่มของ YouTube ใช้ปุ่มของเราเอง
// - ชั้นบังทับทั้งกรอบ: กดโลโก้/ชื่อคลิป/คลิปแนะนำไม่ได้ จึงออกไป YouTube ไม่ได้
// - ปิดคลิกขวา, ลายน้ำชื่อ + เบอร์ ลอยย้ายตำแหน่งทุก 20 วินาที
// - รายงานความคืบหน้าทุก 15 วินาที + ตอนหยุด/จบ/ออกจากหน้า

export type ProgressReport = { position: number; delta: number; duration: number; keepalive: boolean };
/** ให้ส่วนอื่นของหน้าอ่านเวลาปัจจุบัน / กระโดดไปนาทีที่ต้องการ (เช่น ช่องถามครู) */
export type PlayerControl = { getTime: () => number; seek: (s: number) => void };

type Props = {
  youtubeId: string;
  startAt: number;
  watermark: string;
  onProgress: (r: ProgressReport) => void;
  onEnded?: () => void;
  controlRef?: { current: PlayerControl | null };
};

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];
const SAVE_EVERY_SEC = 15;

const fmt = (s: number) => {
  const t = Math.max(0, Math.floor(s));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = String(t % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};

export function ProtectedPlayer({ youtubeId, startAt, watermark, onProgress, onEnded, controlRef }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [time, setTime] = useState(startAt);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fs, setFs] = useState(false);
  const [wm, setWm] = useState({ top: 8, left: 6 });

  // ตัวนับเวลาที่ดูจริง (นับเฉพาะตอนเล่นอยู่)
  const acc = useRef({ delta: 0, lastTick: 0, playing: false });
  const cb = useRef({ onProgress, onEnded });
  cb.current = { onProgress, onEnded };

  const flush = (keepalive = false) => {
    const p = playerRef.current;
    if (!p) return;
    const a = acc.current;
    if (a.playing) {
      const now = performance.now();
      a.delta += (now - a.lastTick) / 1000;
      a.lastTick = now;
    }
    const delta = Math.round(a.delta);
    a.delta -= delta;
    cb.current.onProgress({ position: p.getCurrentTime(), delta, duration: p.getDuration(), keepalive });
  };

  // สร้างตัวเล่น
  useEffect(() => {
    let disposed = false;
    loadYouTube()
      .then((YT) => {
        if (disposed || !hostRef.current) return;
        playerRef.current = new YT.Player(hostRef.current, {
          videoId: youtubeId,
          host: "https://www.youtube-nocookie.com",
          width: "100%",
          height: "100%",
          playerVars: {
            controls: 0,
            disablekb: 1,
            fs: 0,
            rel: 0,
            modestbranding: 1,
            iv_load_policy: 3,
            playsinline: 1,
            start: Math.floor(startAt),
            origin: window.location.origin,
          },
          events: {
            onReady: (e) => {
              if (disposed) return;
              const f = e.target.getIframe();
              f.setAttribute("tabindex", "-1"); // กด Tab เข้า iframe ไม่ได้
              f.setAttribute("title", "วิดีโอ");
              setDuration(e.target.getDuration());
              setReady(true);
            },
            onStateChange: (e) => {
              const a = acc.current;
              const isPlaying = e.data === YTState.PLAYING;
              if (isPlaying && !a.playing) a.lastTick = performance.now();
              if (!isPlaying && a.playing) a.delta += (performance.now() - a.lastTick) / 1000;
              a.playing = isPlaying;
              setPlaying(isPlaying);
              if (isPlaying) {
                setStarted(true);
                setDuration(e.target.getDuration());
              }
              if (e.data === YTState.PAUSED) flush();
              if (e.data === YTState.ENDED) {
                flush();
                cb.current.onEnded?.();
              }
            },
            onError: () => setFailed(true),
          },
        });
      })
      .catch(() => setFailed(true));
    return () => {
      disposed = true;
      flush(true);
      playerRef.current?.destroy();
      playerRef.current = null;
    };
    // ตั้งค่าครั้งเดียวต่อคลิป
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [youtubeId]);

  // อัปเดตเวลา + บันทึกทุก 15 วินาทีขณะเล่น
  useEffect(() => {
    let sinceSave = 0;
    const t = setInterval(() => {
      const p = playerRef.current;
      if (!p || !acc.current.playing) return;
      setTime(p.getCurrentTime());
      sinceSave += 0.5;
      if (sinceSave >= SAVE_EVERY_SEC) {
        sinceSave = 0;
        flush();
      }
    }, 500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ออกจากหน้า / สลับแอป → บันทึกทันที
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flush(true);
    };
    const onLeave = () => flush(true);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onLeave);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onLeave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ย้ายลายน้ำทุก 20 วินาที
  useEffect(() => {
    const t = setInterval(() => setWm({ top: 5 + Math.random() * 75, left: 4 + Math.random() * 52 }), 20000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onChange = () => setFs(document.fullscreenElement === wrapRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggle = () => {
    const p = playerRef.current;
    if (!p || !ready) return;
    if (playing) p.pauseVideo();
    else p.playVideo();
  };

  const seek = (s: number) => {
    const p = playerRef.current;
    if (!p) return;
    flush();
    p.seekTo(s, true);
    setTime(s);
  };

  useEffect(() => {
    if (!controlRef) return;
    controlRef.current = {
      getTime: () => playerRef.current?.getCurrentTime?.() ?? 0,
      seek: (s) => {
        if (playerRef.current && ready) seek(s);
      },
    };
    return () => {
      controlRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlRef, ready]);

  const toggleFullscreen = async () => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
      return;
    }
    if (el.requestFullscreen) {
      try {
        await el.requestFullscreen();
        // มือถือ: หมุนจอแนวนอน (ถ้าเบราว์เซอร์รองรับ)
        await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.("landscape");
      } catch {
        /* ไม่รองรับ */
      }
      return;
    }
    // iPhone ไม่รองรับ fullscreen ของ element: ขยายเต็มจอด้วย CSS แทน
    setFs((v) => !v);
  };

  return (
    <div
      ref={wrapRef}
      className={`ph-player${fs ? " is-fs" : ""}`}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="ph-player__stage">
        <div className="ph-player__frame">
          <div ref={hostRef} />
        </div>
        <div
          className="ph-player__shield"
          onClick={toggle}
          onDoubleClick={toggleFullscreen}
          aria-hidden="true"
        >
          {!playing ? <span className={`ph-player__bigplay${started ? " is-small" : ""}`}>▶</span> : null}
        </div>
        <div className="ph-player__wm" style={{ top: `${wm.top}%`, left: `${wm.left}%` }} aria-hidden="true">
          {watermark}
        </div>
        {failed ? <p className="ph-player__error">เปิดคลิปไม่ได้ กรุณาลองใหม่</p> : null}
      </div>

      <div className="ph-player__bar">
        <button type="button" className="ph-pbtn" onClick={toggle} disabled={!ready} aria-label={playing ? "หยุด" : "เล่น"}>
          {playing ? "❚❚" : "▶"}
        </button>
        <span className="ph-player__time">
          {fmt(time)} / {fmt(duration)}
        </span>
        <input
          className="ph-player__seek"
          type="range"
          min={0}
          max={Math.max(1, Math.floor(duration))}
          step={1}
          value={Math.min(Math.floor(time), Math.floor(duration) || 0)}
          onChange={(e) => seek(Number(e.target.value))}
          disabled={!ready}
          aria-label="เลื่อนตำแหน่งคลิป"
        />
        <select
          className="ph-player__speed"
          value={speed}
          onChange={(e) => {
            const r = Number(e.target.value);
            setSpeed(r);
            playerRef.current?.setPlaybackRate(r);
          }}
          disabled={!ready}
          aria-label="ความเร็ว"
        >
          {SPEEDS.map((s) => (
            <option key={s} value={s}>
              {s}x
            </option>
          ))}
        </select>
        <button
          type="button"
          className="ph-pbtn"
          disabled={!ready}
          onClick={() => {
            const p = playerRef.current;
            if (!p) return;
            if (muted) p.unMute();
            else p.mute();
            setMuted(!muted);
          }}
          aria-label={muted ? "เปิดเสียง" : "ปิดเสียง"}
        >
          {muted ? "🔇" : "🔊"}
        </button>
        <button type="button" className="ph-pbtn" onClick={toggleFullscreen} aria-label={fs ? "ออกจากเต็มจอ" : "เต็มจอ"}>
          {fs ? "⤡" : "⤢"}
        </button>
      </div>
    </div>
  );
}
