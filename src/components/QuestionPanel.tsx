import { useCallback, useEffect, useState, type FormEvent } from "react";
import { fmtPos, QUESTION_MAX, type ClipQuestion, type ClipQuestions } from "../../shared/questions";
import { api, ApiError } from "../lib/api";
import { fmtDateTime } from "./AnnouncementList";
import type { PlayerControl } from "./ProtectedPlayer";

type Props = { videoId: number; player: { current: PlayerControl | null }; onAuthError: (status: number) => void };

/** ถามครูใต้คลิป: เพื่อนในห้องเห็นคำถามด้วย แต่ไม่เห็นชื่อผู้ถาม */
export function QuestionPanel({ videoId, player, onAuthError }: Props) {
  const [data, setData] = useState<ClipQuestions | null>(null);
  const [text, setText] = useState("");
  const [attach, setAttach] = useState(true);
  const [now, setNow] = useState(0);
  const [error, setError] = useState("");
  const [sent, setSent] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<ClipQuestions>(`/videos/${videoId}/questions`)
      .then(setData)
      .catch((err) => {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) onAuthError(err.status);
      });
  }, [videoId, onAuthError]);

  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  // เวลาปัจจุบันของคลิป สำหรับปุ่ม "แนบนาที"
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(player.current?.getTime() ?? 0)), 1000);
    return () => clearInterval(t);
  }, [player]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSent("");
    if (!text.trim()) {
      setError("กรุณาพิมพ์คำถาม");
      return;
    }
    setBusy(true);
    try {
      const pos = attach && now > 0 ? now : null;
      await api(`/videos/${videoId}/questions`, { body: text, positionSec: pos });
      setText("");
      setSent("ส่งคำถามแล้ว ครูจะตอบใต้คลิปนี้");
      load();
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) onAuthError(err.status);
      else setError(err instanceof ApiError && err.body?.message ? err.body.message : "ส่งคำถามไม่ได้ กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  }

  const jump = (s: number) => {
    player.current?.seek(s);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const mine = data?.questions.filter((q) => q.mine) ?? [];
  const others = data?.questions.filter((q) => !q.mine) ?? [];
  const full = data !== null && data.remainingToday === 0;

  const item = (q: ClipQuestion) => (
    <li key={q.id} className={`ph-q${q.mine ? "" : " ph-q--friend"}`}>
      <div className="ph-q__meta">
        {q.positionSec !== null ? (
          <button type="button" className="ph-q__t" onClick={() => jump(q.positionSec!)} aria-label={`ไปที่นาที ${fmtPos(q.positionSec)}`}>
            ⏱ {fmtPos(q.positionSec)}
          </button>
        ) : null}
        <span>{q.mine ? fmtDateTime(q.createdAt) : "จากเพื่อนในห้อง"}</span>
        {q.answer === null && q.mine ? <span className="ph-q__wait">รอครูตอบ</span> : null}
        {q.hidden ? <span className="ph-q__hidden">ครูซ่อนจากเพื่อนในห้อง</span> : null}
      </div>
      <p className="ph-q__body">{q.body}</p>
      {q.answer !== null ? (
        <p className="ph-q__a">
          <b>ครูตอบ:</b> {q.answer}
        </p>
      ) : null}
    </li>
  );

  return (
    <section className="ph-card ph-qa" aria-labelledby="qa-h">
      <h2 id="qa-h" className="ph-qa__h">
        💬 ถามครู
      </h2>
      <form className="ph-qa__form" onSubmit={submit} noValidate>
        <label htmlFor="qa-text" className="ph-sr">
          คำถาม
        </label>
        <textarea
          id="qa-text"
          className="ph-input ph-qa__text"
          placeholder={full ? "วันนี้ถามครบแล้ว พรุ่งนี้ถามได้อีกนะ" : "พิมพ์คำถามเกี่ยวกับคลิปนี้…"}
          maxLength={QUESTION_MAX}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={full}
        />
        <div className="ph-qa__row">
          <label className="ph-chip">
            <input type="checkbox" checked={attach} onChange={(e) => setAttach(e.target.checked)} disabled={full || now === 0} />⏱ แนบนาทีที่{" "}
            {fmtPos(now)}
          </label>
          <button className="ph-btn ph-btn--sm ph-qa__send" type="submit" disabled={busy || full}>
            {busy ? "กำลังส่ง…" : "ส่งคำถาม"}
          </button>
        </div>
        {data ? <p className="ph-small ph-m0">วันนี้ถามได้อีก {data.remainingToday} ข้อ · เพื่อนในห้องเห็นคำถาม แต่ไม่เห็นชื่อผู้ถาม</p> : null}
        {error ? (
          <p className="ph-error" role="alert">
            {error}
          </p>
        ) : null}
        {sent ? (
          <p className="ph-note" role="status">
            {sent}
          </p>
        ) : null}
      </form>
      {mine.length ? (
        <>
          <h3 className="ph-qa__sec">คำถามของฉัน</h3>
          <ul className="ph-qa__list">{mine.map(item)}</ul>
        </>
      ) : null}
      {others.length ? (
        <>
          <h3 className="ph-qa__sec">คำถามจากเพื่อนในห้อง</h3>
          <ul className="ph-qa__list">{others.map(item)}</ul>
        </>
      ) : null}
    </section>
  );
}
