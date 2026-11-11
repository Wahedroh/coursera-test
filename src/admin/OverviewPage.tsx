import { useCallback, useEffect, useMemo, useState } from "react";
import type { ClassOverview } from "../../shared/admin";
import { COURSES, type Course } from "../../shared/validate";
import { fmtDateTime } from "../components/AnnouncementList";
import { api, ApiError } from "../lib/api";
import { navigate } from "../lib/router";

const DAY = 24 * 60 * 60;
type Filter = "all" | "inactive" | "never";

/** ภาพรวมทั้งห้อง: ใครดูคลิปไหนไปแล้วกี่ % และใครไม่เข้าเรียนนาน */
export function OverviewPage({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [course, setCourse] = useState<Course>("m12");
  const [data, setData] = useState<ClassOverview | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState("");

  const handle = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) onUnauthorized();
      else setError("ระบบขัดข้อง กรุณาลองใหม่");
    },
    [onUnauthorized],
  );

  useEffect(() => {
    setData(null);
    api<ClassOverview>(`/admin/overview?course=${course}`).then(setData).catch(handle);
  }, [course, handle]);

  const now = Math.floor(Date.now() / 1000);
  const inactive = (t: number | null) => t !== null && now - t > 7 * DAY;

  const rows = useMemo(() => {
    if (!data) return [];
    if (filter === "inactive") return data.students.filter((s) => s.lastWatchedAt === null || inactive(s.lastWatchedAt));
    if (filter === "never") return data.students.filter((s) => s.lastWatchedAt === null);
    return data.students;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, filter]);

  const counts = data
    ? {
        all: data.students.length,
        inactive: data.students.filter((s) => s.lastWatchedAt === null || inactive(s.lastWatchedAt)).length,
        never: data.students.filter((s) => s.lastWatchedAt === null).length,
      }
    : null;

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
      <div className="ph-tabs" role="tablist" aria-label="ตัวกรอง">
        {(
          [
            ["all", "นักเรียนทั้งหมด"],
            ["inactive", "ไม่เข้าเรียนเกิน 7 วัน"],
            ["never", "ยังไม่เคยดูคลิป"],
          ] as const
        ).map(([f, label]) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            className={`ph-tab${filter === f ? " is-active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {label}
            <span className="ph-count">{counts ? counts[f] : "–"}</span>
          </button>
        ))}
      </div>

      {error ? <p className="ph-error ph-error--box">{error}</p> : null}
      {data && data.videos.length === 0 ? <p className="ph-empty">คอร์สนี้ยังไม่มีคลิป</p> : null}
      {data && data.videos.length > 0 && rows.length === 0 ? <p className="ph-empty">ไม่มีนักเรียนในรายการนี้</p> : null}

      {data && data.videos.length > 0 && rows.length > 0 ? (
        <div className="ph-card ph-ov">
          <div className="ph-ov__legend ph-small">
            <span className="ph-ov__cell is-none">–</span> ยังไม่เปิด
            <span className="ph-ov__cell is-part">40</span> ดูบางส่วน
            <span className="ph-ov__cell is-done">✓</span> ดูจบ
          </div>
          <div className="ph-ov__scroll">
            <table className="ph-ov__table">
              <thead>
                <tr>
                  <th scope="col" className="ph-ov__name">
                    นักเรียน
                  </th>
                  <th scope="col">ดูล่าสุด</th>
                  {data.videos.map((v, i) => (
                    <th key={v.id} scope="col" title={`${v.chapterTitle} · ${v.title}`} className="ph-ov__vh">
                      <span className="ph-ov__vno">{i + 1}</span>
                      <span className="ph-ov__vtitle">{v.title}</span>
                    </th>
                  ))}
                </tr>
                <tr className="ph-ov__sum">
                  <th scope="row" className="ph-ov__name">
                    ดูจบ (คน)
                  </th>
                  <td />
                  {data.videos.map((v) => (
                    <td key={v.id}>
                      {data.students.filter((s) => (s.percents[v.id] ?? -1) >= 100).length}/{data.students.length}
                    </td>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id}>
                    <th scope="row" className="ph-ov__name">
                      <a
                        href={`/admin/students/${s.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          navigate(`/admin/students/${s.id}`);
                        }}
                      >
                        {s.name}
                      </a>
                      <span className="ph-small">{s.school}</span>
                    </th>
                    <td className={s.lastWatchedAt === null || inactive(s.lastWatchedAt) ? "ph-ov__late" : undefined}>
                      {s.lastWatchedAt ? fmtDateTime(s.lastWatchedAt) : "ยังไม่เคยดู"}
                    </td>
                    {data.videos.map((v) => {
                      const p = s.percents[v.id];
                      const cls = p === undefined ? "is-none" : p >= 100 ? "is-done" : "is-part";
                      return (
                        <td key={v.id}>
                          <span className={`ph-ov__cell ${cls}`} title={p === undefined ? "ยังไม่เปิด" : `ดูแล้ว ${p}%`}>
                            {p === undefined ? "–" : p >= 100 ? "✓" : p}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
