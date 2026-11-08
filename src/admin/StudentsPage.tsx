import { useCallback, useEffect, useState } from "react";
import { STATUS_LABELS, type AdminStudent, type AdminStudentList } from "../../shared/admin";
import { COURSES, PASSWORD_MIN, type Course, type StudentStatus } from "../../shared/validate";
import { api, ApiError } from "../lib/api";
import { navigate } from "../lib/router";

type Tab = StudentStatus | "all";
const TABS: Tab[] = ["pending", "approved", "rejected", "suspended", "all"];

const fmtDate = (sec: number) =>
  new Date(sec * 1000).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });

type Props = { onUnauthorized: () => void };

export function StudentsPage({ onUnauthorized }: Props) {
  const [tab, setTab] = useState<Tab>("pending");
  const [course, setCourse] = useState<Course | "">("");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminStudentList | null>(null);
  const [error, setError] = useState("");

  // หน่วงคำค้นไว้เล็กน้อยระหว่างพิมพ์
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const handle = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) onUnauthorized();
      else setError(err instanceof ApiError && err.body?.message ? err.body.message : "ระบบขัดข้อง กรุณาลองใหม่");
    },
    [onUnauthorized],
  );

  const load = useCallback(async () => {
    const p = new URLSearchParams({ page: String(page) });
    if (tab !== "all") p.set("status", tab);
    if (course) p.set("course", course);
    if (query) p.set("q", query);
    try {
      setData(await api<AdminStudentList>(`/admin/students?${p}`));
      setError("");
    } catch (err) {
      handle(err);
    }
  }, [tab, course, query, page, handle]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (path: string, body: unknown) => {
    try {
      await api<AdminStudent>(path, body);
      await load();
    } catch (err) {
      handle(err);
    }
  };

  const allCount = data ? Object.values(data.counts).reduce((a, b) => a + b, 0) : 0;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <section className="ph-admin">
      <div className="ph-tabs" role="tablist" aria-label="สถานะนักเรียน">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={`ph-tab${tab === t ? " is-active" : ""}`}
            onClick={() => {
              setTab(t);
              setPage(1);
            }}
          >
            {t === "all" ? "ทั้งหมด" : STATUS_LABELS[t]}
            <span className="ph-count">{data ? (t === "all" ? allCount : data.counts[t]) : "–"}</span>
          </button>
        ))}
      </div>

      <div className="ph-filters">
        <input
          className="ph-input"
          type="search"
          placeholder="ค้นหาชื่อ โรงเรียน หรือเบอร์"
          aria-label="ค้นหา"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="ph-input ph-select"
          aria-label="คอร์ส"
          value={course}
          onChange={(e) => {
            setCourse(e.target.value as Course | "");
            setPage(1);
          }}
        >
          <option value="">ทุกคอร์ส</option>
          {(Object.keys(COURSES) as Course[]).map((c) => (
            <option key={c} value={c}>
              {COURSES[c]}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <p className="ph-error" role="alert">
          {error}
        </p>
      ) : null}

      {data && data.students.length === 0 ? <p className="ph-empty">ไม่มีนักเรียนในรายการนี้</p> : null}

      <ul className="ph-students">
        {data?.students.map((s) => (
          <StudentCard key={s.id} s={s} act={act} />
        ))}
      </ul>

      {pages > 1 ? (
        <div className="ph-pager">
          <button type="button" className="ph-btn ph-btn--sm ph-btn--ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            ก่อนหน้า
          </button>
          <span>
            หน้า {page} / {pages}
          </span>
          <button
            type="button"
            className="ph-btn ph-btn--sm ph-btn--ghost"
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
          >
            ถัดไป
          </button>
        </div>
      ) : null}
    </section>
  );
}

function StudentCard({ s, act }: { s: AdminStudent; act: (path: string, body: unknown) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState("");
  const base = `/admin/students/${s.id}`;
  const name = `${s.firstName} ${s.lastName}`;

  const run = async (path: string, body: unknown, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    try {
      await act(path, body);
    } finally {
      setBusy(false);
    }
  };

  const setStatus = (status: StudentStatus, confirmText?: string) => run(`${base}/status`, { status }, confirmText);

  const submitPassword = async () => {
    if (pw.length < PASSWORD_MIN) {
      setPwError(`รหัสผ่านต้องมีอย่างน้อย ${PASSWORD_MIN} ตัว`);
      return;
    }
    await run(`${base}/password`, { password: pw });
    setPw("");
    setResetOpen(false);
    window.alert(`ตั้งรหัสผ่านใหม่ให้ ${name} แล้ว`);
  };

  return (
    <li className="ph-student">
      <div className="ph-student__head">
        <strong>{name}</strong>
        <span className={`ph-badge ph-badge--${s.status}`}>{STATUS_LABELS[s.status]}</span>
      </div>
      <dl className="ph-student__info">
        <dt>โรงเรียน</dt>
        <dd>{s.school}</dd>
        <dt>คอร์ส</dt>
        <dd>
          <select
            className="ph-input ph-select ph-select--sm"
            aria-label={`เปลี่ยนคอร์สของ ${name}`}
            value={s.course}
            disabled={busy}
            onChange={(e) =>
              run(`${base}/course`, { course: e.target.value }, `เปลี่ยนคอร์สของ ${name} เป็น ${COURSES[e.target.value as Course]}?`)
            }
          >
            {(Object.keys(COURSES) as Course[]).map((c) => (
              <option key={c} value={c}>
                {COURSES[c]}
              </option>
            ))}
          </select>
        </dd>
        <dt>เบอร์นักเรียน</dt>
        <dd>
          <a href={`tel:${s.studentPhone}`}>{s.studentPhone}</a>
        </dd>
        <dt>เบอร์ผู้ปกครอง</dt>
        <dd>
          <a href={`tel:${s.parentPhone}`}>{s.parentPhone}</a>
        </dd>
        <dt>สมัครเมื่อ</dt>
        <dd>{fmtDate(s.createdAt)}</dd>
      </dl>

      <div className="ph-student__actions">
        {s.status === "pending" || s.status === "rejected" ? (
          <button type="button" className="ph-btn ph-btn--sm ph-btn--ok" disabled={busy} onClick={() => setStatus("approved")}>
            ยืนยัน
          </button>
        ) : null}
        {s.status === "pending" ? (
          <button
            type="button"
            className="ph-btn ph-btn--sm ph-btn--danger"
            disabled={busy}
            onClick={() => setStatus("rejected", `ปฏิเสธ ${name}?`)}
          >
            ปฏิเสธ
          </button>
        ) : null}
        {s.status === "approved" ? (
          <button
            type="button"
            className="ph-btn ph-btn--sm ph-btn--danger"
            disabled={busy}
            onClick={() => setStatus("suspended", `ระงับบัญชี ${name}?`)}
          >
            ระงับ
          </button>
        ) : null}
        {s.status === "suspended" ? (
          <button type="button" className="ph-btn ph-btn--sm ph-btn--ok" disabled={busy} onClick={() => setStatus("approved")}>
            ยกเลิกระงับ
          </button>
        ) : null}
        <button type="button" className="ph-btn ph-btn--sm ph-btn--ghost" disabled={busy} onClick={() => setResetOpen((v) => !v)}>
          ตั้งรหัสผ่านใหม่
        </button>
        <button type="button" className="ph-btn ph-btn--sm" onClick={() => navigate(`/admin/students/${s.id}`)}>
          ประวัติการเรียน
        </button>
      </div>

      {resetOpen ? (
        <div className="ph-reset">
          <label htmlFor={`pw-${s.id}`}>รหัสผ่านใหม่ (อย่างน้อย {PASSWORD_MIN} ตัว)</label>
          <div className="ph-reset__row">
            <input
              id={`pw-${s.id}`}
              className="ph-input"
              type="text"
              autoComplete="off"
              value={pw}
              onChange={(e) => {
                setPw(e.target.value);
                setPwError("");
              }}
            />
            <button type="button" className="ph-btn ph-btn--sm" disabled={busy} onClick={submitPassword}>
              บันทึก
            </button>
          </div>
          {pwError ? <p className="ph-error">{pwError}</p> : null}
          <p className="ph-small ph-m0">เครื่องที่นักเรียนเข้าอยู่จะหลุด ต้องเข้าใหม่ด้วยรหัสนี้</p>
        </div>
      ) : null}
    </li>
  );
}
