import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  DOC_KINDS,
  DOC_MAX_BYTES,
  parseYouTubeId,
  type AdminChapter,
  type AdminContent,
  type AdminVideo,
  type DocKind,
} from "../../shared/content";
import { COURSES, type Course } from "../../shared/validate";
import { Sortable } from "../components/Sortable";
import { api, ApiError } from "../lib/api";
import { fmtSize, uploadForm } from "../lib/upload";

const fmtDur = (s: number | null) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : "ยังไม่ทราบความยาว");

type Props = { onUnauthorized: () => void };

export function ContentPage({ onUnauthorized }: Props) {
  const [course, setCourse] = useState<Course>("m12");
  const [data, setData] = useState<AdminContent | null>(null);
  const [error, setError] = useState("");
  const [newChapter, setNewChapter] = useState("");

  const handle = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) onUnauthorized();
      else setError(err instanceof ApiError && err.body?.message ? err.body.message : "ระบบขัดข้อง กรุณาลองใหม่");
    },
    [onUnauthorized],
  );

  useEffect(() => {
    setData(null);
    api<AdminContent>(`/admin/content?course=${course}`).then(setData).catch(handle);
  }, [course, handle]);

  /** รอผลจาก API ที่คืนเนื้อหาทั้งคอร์สกลับมา แล้วอัปเดตหน้า (คืน true ถ้าสำเร็จ) */
  const apply = useCallback(
    async (req: Promise<AdminContent>): Promise<boolean> => {
      setError("");
      try {
        setData(await req);
        return true;
      } catch (err) {
        handle(err);
        return false;
      }
    },
    [handle],
  );
  const run = useCallback((path: string, body: unknown) => apply(api<AdminContent>(path, body)), [apply]);
  const upload = useCallback(
    (videoId: number, kind: DocKind, file: File) =>
      apply(uploadForm<AdminContent>(`/admin/videos/${videoId}/documents`, { kind, file })),
    [apply],
  );

  const addChapter = async (e: FormEvent) => {
    e.preventDefault();
    if (!newChapter.trim()) return;
    if (await run("/admin/chapters", { course, title: newChapter })) setNewChapter("");
  };

  return (
    <section className="ph-admin">
      <div className="ph-tabs" role="tablist" aria-label="คอร์ส">
        {(Object.keys(COURSES) as Course[]).map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={course === c}
            className={`ph-tab${course === c ? " is-active" : ""}`}
            onClick={() => setCourse(c)}
          >
            {COURSES[c]}
          </button>
        ))}
      </div>

      {error ? (
        <p className="ph-error ph-error--box" role="alert">
          {error}
        </p>
      ) : null}

      {data && data.chapters.length === 0 ? <p className="ph-empty">ยังไม่มีบทในคอร์สนี้ เริ่มจากเพิ่มบทด้านล่าง</p> : null}

      {data ? (
        <Sortable
          className="ph-chapters"
          items={data.chapters}
          getId={(c) => c.id}
          getLabel={(c) => c.title}
          onReorder={(ids) => run("/admin/chapters/reorder", { course, ids })}
          render={(ch, handleEl) => <ChapterCard ch={ch} handle={handleEl} run={run} upload={upload} />}
        />
      ) : null}

      <form className="ph-card ph-inline-form" onSubmit={addChapter}>
        <label htmlFor="new-chapter">เพิ่มบทใหม่ใน {COURSES[course]}</label>
        <div className="ph-reset__row">
          <input
            id="new-chapter"
            className="ph-input"
            placeholder="เช่น การเคลื่อนที่แนวตรง"
            value={newChapter}
            onChange={(e) => setNewChapter(e.target.value)}
          />
          <button type="submit" className="ph-btn ph-btn--sm">
            เพิ่มบท
          </button>
        </div>
      </form>
    </section>
  );
}

type Run = (path: string, body: unknown) => Promise<boolean>;
type Upload = (videoId: number, kind: DocKind, file: File) => Promise<boolean>;

function ChapterCard({ ch, handle, run, upload }: { ch: AdminChapter; handle: ReactNode; run: Run; upload: Upload }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(ch.title);
  const [vTitle, setVTitle] = useState("");
  const [vLink, setVLink] = useState("");
  const [vError, setVError] = useState("");

  const addVideo = async (e: FormEvent) => {
    e.preventDefault();
    if (!vTitle.trim()) return setVError("กรุณากรอกชื่อคลิป");
    if (!parseYouTubeId(vLink)) return setVError("ลิงก์ YouTube ไม่ถูกต้อง");
    setVError("");
    if (await run("/admin/videos", { chapterId: ch.id, title: vTitle, youtube: vLink })) {
      setVTitle("");
      setVLink("");
    }
  };

  return (
    <div className="ph-card ph-chapter">
      <div className="ph-row-head">
        {handle}
        {editing ? (
          <form
            className="ph-reset__row ph-grow"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await run(`/admin/chapters/${ch.id}`, { title })) setEditing(false);
            }}
          >
            <input className="ph-input" aria-label="ชื่อบท" value={title} onChange={(e) => setTitle(e.target.value)} />
            <button type="submit" className="ph-btn ph-btn--sm">
              บันทึก
            </button>
          </form>
        ) : (
          <h2 className="ph-chapter-title ph-grow">{ch.title}</h2>
        )}
        <button type="button" className="ph-btn ph-btn--sm ph-btn--ghost" onClick={() => setEditing((v) => !v)}>
          {editing ? "ยกเลิก" : "แก้ชื่อ"}
        </button>
        <button
          type="button"
          className="ph-btn ph-btn--sm ph-btn--danger"
          onClick={() => {
            if (window.confirm(`ลบบท "${ch.title}"?\nคลิป ${ch.videos.length} คลิปในบทนี้ และความคืบหน้าของนักเรียนจะถูกลบด้วย`)) {
              run(`/admin/chapters/${ch.id}/delete`, {});
            }
          }}
        >
          ลบบท
        </button>
      </div>

      {ch.videos.length === 0 ? <p className="ph-note ph-small">ยังไม่มีคลิปในบทนี้</p> : null}
      <Sortable
        className="ph-vlist"
        items={ch.videos}
        getId={(v) => v.id}
        getLabel={(v) => v.title}
        onReorder={(ids) => run(`/admin/chapters/${ch.id}/videos/reorder`, { ids })}
        render={(v, h) => <VideoRow v={v} handle={h} run={run} upload={upload} />}
      />

      <form className="ph-inline-form ph-addvideo" onSubmit={addVideo}>
        <span className="ph-small ph-bold">เพิ่มคลิป</span>
        <input className="ph-input" placeholder="ชื่อคลิป" aria-label="ชื่อคลิป" value={vTitle} onChange={(e) => setVTitle(e.target.value)} />
        <input
          className="ph-input"
          placeholder="ลิงก์ YouTube เช่น https://youtu.be/…"
          aria-label="ลิงก์ YouTube"
          value={vLink}
          onChange={(e) => setVLink(e.target.value)}
        />
        <button type="submit" className="ph-btn ph-btn--sm">
          เพิ่มคลิป
        </button>
        {vError ? <p className="ph-error">{vError}</p> : null}
      </form>
    </div>
  );
}

function VideoRow({ v, handle, run, upload }: { v: AdminVideo; handle: ReactNode; run: Run; upload: Upload }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(v.title);
  const [link, setLink] = useState(`https://youtu.be/${v.youtubeId}`);
  const [err, setErr] = useState("");
  const [docsOpen, setDocsOpen] = useState(false);

  return (
    <div className="ph-vrow">
      {handle}
      <img
        className="ph-thumb"
        src={`https://i.ytimg.com/vi/${v.youtubeId}/mqdefault.jpg`}
        alt=""
        loading="lazy"
        width={96}
        height={54}
      />
      {editing ? (
        <form
          className="ph-vrow__edit"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!parseYouTubeId(link)) return setErr("ลิงก์ YouTube ไม่ถูกต้อง");
            if (await run(`/admin/videos/${v.id}`, { title, youtube: link })) setEditing(false);
          }}
        >
          <input className="ph-input" aria-label="ชื่อคลิป" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className="ph-input" aria-label="ลิงก์ YouTube" value={link} onChange={(e) => setLink(e.target.value)} />
          {err ? <p className="ph-error">{err}</p> : null}
          <div className="ph-student__actions">
            <button type="submit" className="ph-btn ph-btn--sm">
              บันทึก
            </button>
            <button type="button" className="ph-btn ph-btn--sm ph-btn--ghost" onClick={() => setEditing(false)}>
              ยกเลิก
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="ph-vrow__body">
            <span className="ph-bold">{v.title}</span>
            <span className="ph-small">
              {v.youtubeId} · {fmtDur(v.durationSec)}
            </span>
          </div>
          <div className="ph-vrow__actions">
            <button type="button" className="ph-btn ph-btn--sm ph-btn--ghost" onClick={() => setDocsOpen((o) => !o)}>
              เอกสาร ({v.documents.length})
            </button>
            <button type="button" className="ph-btn ph-btn--sm ph-btn--ghost" onClick={() => setEditing(true)}>
              แก้ไข
            </button>
            <button
              type="button"
              className="ph-btn ph-btn--sm ph-btn--danger"
              onClick={() => {
                if (window.confirm(`ลบคลิป "${v.title}"?\nความคืบหน้าของนักเรียนในคลิปนี้จะถูกลบด้วย`)) {
                  run(`/admin/videos/${v.id}/delete`, {});
                }
              }}
            >
              ลบ
            </button>
          </div>
        </>
      )}
      {docsOpen ? <DocsPanel v={v} run={run} upload={upload} /> : null}
    </div>
  );
}

function DocsPanel({ v, run, upload }: { v: AdminVideo; run: Run; upload: Upload }) {
  const [kind, setKind] = useState<DocKind>("handout");
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [inputKey, setInputKey] = useState(0);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return setErr("กรุณาเลือกไฟล์ PDF");
    if (file.size > DOC_MAX_BYTES) return setErr(`ไฟล์ใหญ่ ${fmtSize(file.size)} เกิน 10MB`);
    setErr("");
    setBusy(true);
    const ok = await upload(v.id, kind, file);
    setBusy(false);
    if (ok) {
      setFile(null);
      setInputKey((k) => k + 1); // ล้างช่องเลือกไฟล์
    }
  };

  return (
    <div className="ph-docs">
      {v.documents.length === 0 ? <p className="ph-small ph-m0">ยังไม่มีเอกสาร</p> : null}
      <ul className="ph-docs__list">
        {v.documents.map((d) => (
          <li key={d.id} className="ph-docs__item">
            <span className="ph-badge ph-badge--pending">{DOC_KINDS[d.kind]}</span>
            <a href={`/api/admin/documents/${d.id}`} className="ph-docs__name">
              {d.filename}
            </a>
            <span className="ph-small">{fmtSize(d.sizeBytes)}</span>
            <button
              type="button"
              className="ph-btn ph-btn--sm ph-btn--danger"
              onClick={() => {
                if (window.confirm(`ลบเอกสาร "${d.filename}"?`)) run(`/admin/documents/${d.id}/delete`, {});
              }}
            >
              ลบ
            </button>
          </li>
        ))}
      </ul>
      <form className="ph-docs__form" onSubmit={send}>
        <select
          className="ph-input ph-select ph-select--sm"
          aria-label="ประเภทเอกสาร"
          value={kind}
          onChange={(e) => setKind(e.target.value as DocKind)}
        >
          {(Object.keys(DOC_KINDS) as DocKind[]).map((k) => (
            <option key={k} value={k}>
              {DOC_KINDS[k]}
            </option>
          ))}
        </select>
        <input
          key={inputKey}
          type="file"
          accept="application/pdf,.pdf"
          aria-label="เลือกไฟล์ PDF"
          className="ph-file"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setErr("");
          }}
        />
        <button type="submit" className="ph-btn ph-btn--sm" disabled={busy}>
          {busy ? "กำลังอัปโหลด…" : "อัปโหลด PDF"}
        </button>
        {err ? <p className="ph-error">{err}</p> : null}
        <p className="ph-small ph-m0">PDF ไม่เกิน 10MB</p>
      </form>
    </div>
  );
}
