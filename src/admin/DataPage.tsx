import { useCallback, useEffect, useState } from "react";
import {
  USAGE_WARN_PERCENT,
  type CloseYearCounts,
  type CloseYearDocs,
  type CloseYearScope,
  type Usage,
  type YearGroup,
} from "../../shared/maintenance";
import { COURSES } from "../../shared/validate";
import { api, ApiError } from "../lib/api";
import { fmtSize } from "../lib/upload";

const fmtBytes = (b: number) =>
  b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(1).replace(/\.0$/, "")} GB` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : fmtSize(b);

type Props = { onUnauthorized: () => void };

/** หลังบ้าน: สำรองข้อมูล / กู้คืน / การใช้พื้นที่ / ปิดปีการศึกษา */
export function DataPage({ onUnauthorized }: Props) {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [groups, setGroups] = useState<YearGroup[]>([]);
  const [backedUp, setBackedUp] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const handle = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) onUnauthorized();
      else setMsg({ ok: false, text: err instanceof ApiError && err.body?.message ? err.body.message : "ระบบขัดข้อง กรุณาลองใหม่" });
    },
    [onUnauthorized],
  );

  const reload = useCallback(() => {
    api<Usage>("/admin/usage").then(setUsage).catch(handle);
    api<{ groups: YearGroup[] }>("/admin/close-year/groups")
      .then((r) => setGroups(r.groups))
      .catch(handle);
  }, [handle]);

  useEffect(reload, [reload]);

  return (
    <section className="ph-admin">
      {msg ? (
        <p className={msg.ok ? "ph-alert" : "ph-error ph-error--box"} role="status">
          {msg.text}
        </p>
      ) : null}

      <div className="ph-card ph-form">
        <h2 className="ph-chapter-title">สำรองข้อมูล</h2>
        <p className="ph-m0 ph-small">ดาวน์โหลดเก็บไว้ในเครื่อง ไฟล์ CSV เปิดด้วย Excel ได้ ส่วนไฟล์ JSON ใช้กู้คืนระบบ</p>
        <div className="ph-student__actions">
          <a className="ph-btn ph-btn--sm ph-btn--ghost" href="/api/admin/backup/students.csv">
            ⬇ รายชื่อนักเรียน (CSV)
          </a>
          <a className="ph-btn ph-btn--sm ph-btn--ghost" href="/api/admin/backup/progress.csv">
            ⬇ ประวัติการเรียน (CSV)
          </a>
          <a className="ph-btn ph-btn--sm" href="/api/admin/backup/json" onClick={() => setBackedUp(true)}>
            ⬇ สำรองทั้งระบบ (JSON)
          </a>
        </div>
        <p className="ph-m0 ph-small">
          ไฟล์ JSON มีข้อมูลส่วนตัวนักเรียนและรหัสผ่านที่เข้ารหัสแล้ว เก็บไว้ในที่ปลอดภัย · ไม่รวมไฟล์ PDF (ต้นฉบับอยู่ในเครื่องครู)
        </p>
      </div>

      <RestoreCard
        onDone={(text) => {
          setMsg({ ok: true, text });
          reload();
        }}
        onError={handle}
      />

      <div className="ph-card ph-form">
        <h2 className="ph-chapter-title">การใช้พื้นที่ (โควตาฟรี)</h2>
        {usage ? (
          <>
            <Meter label="ฐานข้อมูล (D1)" used={usage.d1.bytes} limit={usage.d1.limit} percent={usage.d1.percent} />
            <Meter
              label={`ไฟล์ PDF (R2) · ${usage.r2.files} ไฟล์`}
              used={usage.r2.bytes}
              limit={usage.r2.limit}
              percent={usage.r2.percent}
            />
            <p className="ph-m0 ph-small">
              นักเรียน {usage.counts.students} คน · คลิป {usage.counts.videos} · เอกสาร {usage.counts.documents} · ประวัติการดู{" "}
              {usage.counts.progress} แถว · ประกาศ {usage.counts.announcements}
            </p>
          </>
        ) : (
          <p className="ph-m0">กำลังโหลด…</p>
        )}
      </div>

      <CloseYearCard
        groups={groups}
        backedUp={backedUp}
        onDone={(text) => {
          setMsg({ ok: true, text });
          reload();
        }}
        onError={handle}
      />
    </section>
  );
}

function Meter({ label, used, limit, percent }: { label: string; used: number; limit: number; percent: number }) {
  const warn = percent >= USAGE_WARN_PERCENT;
  return (
    <div className={`ph-meter${warn ? " is-warn" : ""}`}>
      <div className="ph-meter__top">
        <span className="ph-bold">{label}</span>
        <span>
          {fmtBytes(used)} / {fmtBytes(limit)} ({percent}%)
        </span>
      </div>
      <div className="ph-meter__bar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={label}>
        <span style={{ width: `${Math.min(100, Math.max(percent, 0.5))}%` }} />
      </div>
      {warn ? (
        <p className="ph-error ph-m0" role="alert">
          ใช้พื้นที่เกิน {USAGE_WARN_PERCENT}% แล้ว ควรสำรองข้อมูลแล้วปิดปีการศึกษาเพื่อล้างข้อมูลรุ่นเก่า
        </p>
      ) : null}
    </div>
  );
}

function RestoreCard({ onDone, onError }: { onDone: (text: string) => void; onError: (err: unknown) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(0);

  const restore = async () => {
    if (!file) return;
    if (
      !window.confirm(
        `กู้คืนจาก "${file.name}"?\n\nข้อมูลปัจจุบันทั้งหมด (นักเรียน คลิป เอกสาร ประวัติ ประกาศ) จะถูกแทนที่ด้วยข้อมูลในไฟล์\nนักเรียนทุกคนจะต้องเข้าสู่ระบบใหม่`,
      )
    )
      return;
    setBusy(true);
    try {
      const data = JSON.parse(await file.text());
      const r = await api<{ counts: Record<string, number> }>("/admin/restore", data);
      onDone(`กู้คืนสำเร็จ: นักเรียน ${r.counts.students} คน · คลิป ${r.counts.videos} · เอกสาร ${r.counts.documents} · ประกาศ ${r.counts.announcements}`);
      setFile(null);
      setKey((k) => k + 1);
    } catch (err) {
      onError(err instanceof SyntaxError ? new ApiError(400, { message: "ไฟล์นี้ไม่ใช่ JSON" }) : err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ph-card ph-form">
      <h2 className="ph-chapter-title">กู้คืนจากไฟล์สำรอง</h2>
      <p className="ph-m0 ph-small">ใช้ไฟล์ JSON จากปุ่ม "สำรองทั้งระบบ" ข้อมูลปัจจุบันจะถูกแทนที่ทั้งหมด</p>
      <div className="ph-docs__form">
        <input
          key={key}
          type="file"
          accept="application/json,.json"
          aria-label="เลือกไฟล์สำรอง JSON"
          className="ph-file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <button type="button" className="ph-btn ph-btn--sm ph-btn--danger" disabled={!file || busy} onClick={restore}>
          {busy ? "กำลังกู้คืน…" : "กู้คืน"}
        </button>
      </div>
    </div>
  );
}

function CloseYearCard({
  groups,
  backedUp,
  onDone,
  onError,
}: {
  groups: YearGroup[];
  backedUp: boolean;
  onDone: (text: string) => void;
  onError: (err: unknown) => void;
}) {
  const years = [...new Set(groups.map((g) => g.year))];
  const [year, setYear] = useState<number | "">("");
  const [course, setCourse] = useState<CloseYearScope>("all");
  const [docs, setDocs] = useState<CloseYearDocs>("none");
  const [ann, setAnn] = useState(false);
  const [preview, setPreview] = useState<CloseYearCounts | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (year === "" && years.length) setYear(years[0]);
  }, [year, years]);

  useEffect(() => {
    setPreview(null);
    if (year === "") return;
    const q = new URLSearchParams({ year: String(year), course, docs, announcements: ann ? "1" : "0" });
    api<CloseYearCounts>(`/admin/close-year/preview?${q}`).then(setPreview).catch(onError);
  }, [year, course, docs, ann, onError]);

  const run = async () => {
    if (!preview || year === "") return;
    const scope = course === "all" ? "ทุกคอร์ส" : COURSES[course];
    if (
      !window.confirm(
        `ปิดปีการศึกษา ${year} (${scope})?\n\nจะลบถาวร:\n- นักเรียน ${preview.students} คน และประวัติการเรียน ${preview.progress} แถว\n- เอกสาร ${preview.documents} ไฟล์\n- ประกาศ ${preview.announcements} รายการ\n\nกู้คืนได้จากไฟล์สำรอง JSON เท่านั้น`,
      )
    )
      return;
    setBusy(true);
    try {
      const r = await api<{ deleted: CloseYearCounts }>("/admin/close-year", { year, course, docs, announcements: ann });
      onDone(
        `ปิดปีการศึกษา ${year} แล้ว: ลบนักเรียน ${r.deleted.students} คน · ประวัติ ${r.deleted.progress} แถว · เอกสาร ${r.deleted.documents} · ประกาศ ${r.deleted.announcements}`,
      );
      setYear("");
    } catch (err) {
      onError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ph-card ph-form">
      <h2 className="ph-chapter-title">ปิดปีการศึกษา</h2>
      <p className="ph-m0 ph-small">ลบนักเรียนรุ่นเก่าและประวัติการเรียนของเขา เพื่อให้อยู่ในโควตาฟรี</p>
      {groups.length === 0 ? (
        <p className="ph-m0">ยังไม่มีนักเรียน</p>
      ) : (
        <>
          <div className="ph-close-grid">
            <label className="ph-field">
              <span className="ph-bold">ปีการศึกษาที่สมัคร</span>
              <select className="ph-input" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y} ({groups.filter((g) => g.year === y).reduce((s, g) => s + g.students, 0)} คน)
                  </option>
                ))}
              </select>
            </label>
            <label className="ph-field">
              <span className="ph-bold">คอร์ส</span>
              <select className="ph-input" value={course} onChange={(e) => setCourse(e.target.value as CloseYearScope)}>
                <option value="all">ทุกคอร์ส</option>
                <option value="m12">{COURSES.m12}</option>
                <option value="m4">{COURSES.m4}</option>
              </select>
            </label>
          </div>
          <fieldset className="ph-fieldset">
            <legend className="ph-bold">เอกสาร PDF ของคอร์สที่เลือก</legend>
            <div className="ph-radios">
              {(
                [
                  ["none", "ไม่ลบ"],
                  ["class_notes", "ลบเฉพาะเอกสารที่เขียนในห้อง"],
                  ["all", "ลบเอกสารทั้งหมด"],
                ] as const
              ).map(([v, l]) => (
                <label key={v} className="ph-radio">
                  <input type="radio" name="close-docs" checked={docs === v} onChange={() => setDocs(v)} />
                  {l}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="ph-radio">
            <input type="checkbox" checked={ann} onChange={(e) => setAnn(e.target.checked)} />
            ลบประกาศทั้งหมด
          </label>
          {preview ? (
            <p className="ph-alert ph-m0">
              จะลบ: นักเรียน {preview.students} คน · ประวัติการเรียน {preview.progress} แถว · เอกสาร {preview.documents} ไฟล์ · ประกาศ{" "}
              {preview.announcements} รายการ
            </p>
          ) : null}
          {!backedUp ? <p className="ph-error ph-m0">ต้องกด "สำรองทั้งระบบ (JSON)" ด้านบนก่อน จึงจะปิดปีการศึกษาได้</p> : null}
          <button
            type="button"
            className="ph-btn ph-btn--sm ph-btn--danger"
            disabled={!backedUp || busy || !preview || preview.students + preview.documents + preview.announcements === 0}
            onClick={run}
          >
            {busy ? "กำลังลบ…" : "ปิดปีการศึกษา"}
          </button>
        </>
      )}
    </div>
  );
}
