import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ANNOUNCE_BODY_MAX,
  ANNOUNCE_TARGETS,
  ANNOUNCE_TITLE_MAX,
  type Announcement,
  type AnnounceTarget,
} from "../../shared/announcements";
import { fmtDateTime } from "../components/AnnouncementList";
import { api, ApiError } from "../lib/api";

type Draft = { target: AnnounceTarget; title: string; body: string };
const EMPTY: Draft = { target: "all", title: "", body: "" };
type List = { announcements: Announcement[] };

export function AnnouncementsPage({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [items, setItems] = useState<Announcement[] | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handle = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) onUnauthorized();
      else setError(err instanceof ApiError && err.body?.message ? err.body.message : "ระบบขัดข้อง กรุณาลองใหม่");
    },
    [onUnauthorized],
  );

  useEffect(() => {
    api<List>("/admin/announcements")
      .then((r) => setItems(r.announcements))
      .catch(handle);
  }, [handle]);

  const call = async (path: string, body: unknown) => {
    setError("");
    setBusy(true);
    try {
      setItems((await api<List>(path, body)).announcements);
      return true;
    } catch (err) {
      handle(err);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.title.trim()) return setError("กรุณากรอกหัวข้อ");
    if (!draft.body.trim()) return setError("กรุณากรอกข้อความ");
    const ok = await call(editingId ? `/admin/announcements/${editingId}` : "/admin/announcements", draft);
    if (ok) {
      setDraft(EMPTY);
      setEditingId(null);
    }
  };

  return (
    <section className="ph-admin">
      <form className="ph-card ph-form" onSubmit={submit}>
        <h2 className="ph-chapter-title">{editingId ? "แก้ไขประกาศ" : "ประกาศใหม่"}</h2>
        <fieldset className="ph-fieldset">
          <legend className="ph-bold">ส่งถึง</legend>
          <div className="ph-radios">
            {(Object.keys(ANNOUNCE_TARGETS) as AnnounceTarget[]).map((t) => (
              <label key={t} className="ph-radio">
                <input
                  type="radio"
                  name="target"
                  value={t}
                  checked={draft.target === t}
                  onChange={() => setDraft({ ...draft, target: t })}
                />
                {ANNOUNCE_TARGETS[t]}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="ph-field">
          <label htmlFor="ann-title">หัวข้อ</label>
          <input
            id="ann-title"
            className="ph-input"
            maxLength={ANNOUNCE_TITLE_MAX}
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
        </div>
        <div className="ph-field">
          <label htmlFor="ann-body">ข้อความ</label>
          <textarea
            id="ann-body"
            className="ph-input ph-textarea"
            rows={5}
            maxLength={ANNOUNCE_BODY_MAX}
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          />
        </div>
        {error ? (
          <p className="ph-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="ph-student__actions">
          <button type="submit" className="ph-btn ph-btn--sm" disabled={busy}>
            {editingId ? "บันทึกการแก้ไข" : "ประกาศ"}
          </button>
          {editingId ? (
            <button
              type="button"
              className="ph-btn ph-btn--sm ph-btn--ghost"
              onClick={() => {
                setEditingId(null);
                setDraft(EMPTY);
                setError("");
              }}
            >
              ยกเลิก
            </button>
          ) : null}
        </div>
      </form>

      {items && items.length === 0 ? <p className="ph-empty">ยังไม่มีประกาศ</p> : null}
      <ul className="ph-students">
        {items?.map((a) => (
          <li key={a.id} className="ph-student">
            <div className="ph-student__head">
              <strong>{a.title}</strong>
              <span className="ph-badge ph-badge--pending">{ANNOUNCE_TARGETS[a.target]}</span>
            </div>
            <p className="ph-announce__time">
              {fmtDateTime(a.createdAt)}
              {a.updatedAt > a.createdAt ? " (แก้ไขแล้ว)" : ""}
            </p>
            <p className="ph-announce__body">{a.body}</p>
            <div className="ph-student__actions">
              <button
                type="button"
                className="ph-btn ph-btn--sm ph-btn--ghost"
                onClick={() => {
                  setEditingId(a.id);
                  setDraft({ target: a.target, title: a.title, body: a.body });
                  setError("");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                แก้ไข
              </button>
              <button
                type="button"
                className="ph-btn ph-btn--sm ph-btn--danger"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(`ลบประกาศ "${a.title}"?`)) call(`/admin/announcements/${a.id}/delete`, {});
                }}
              >
                ลบ
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
