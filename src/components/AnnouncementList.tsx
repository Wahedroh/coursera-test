import { useEffect, useState } from "react";
import type { Announcement } from "../../shared/announcements";
import { api } from "../lib/api";

export const fmtDateTime = (sec: number) =>
  new Date(sec * 1000).toLocaleString("th-TH", { day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });

// API บันทึกว่า "เห็นแล้ว" ทุกครั้งที่โหลด ถ้าโหลดซ้ำทันที (เช่น React StrictMode) ป้าย "ใหม่" จะหาย
// จึงใช้ผลเดิมถ้าเพิ่งโหลดไปไม่เกิน 5 วินาที
let recent: { at: number; req: Promise<{ announcements: Announcement[] }> } | null = null;
function loadOnce() {
  if (!recent || Date.now() - recent.at > 5000) {
    recent = { at: Date.now(), req: api<{ announcements: Announcement[] }>("/announcements") };
  }
  return recent.req;
}

/** ประกาศจากครูที่นักเรียนคนนี้ควรเห็น (ทุกคน + คอร์สตัวเอง); limit = แสดงกี่อันก่อนกด "ดูประกาศทั้งหมด" */
export function AnnouncementList({ limit }: { limit?: number }) {
  const [items, setItems] = useState<Announcement[] | null>(null);
  const [all, setAll] = useState(false);

  useEffect(() => {
    loadOnce()
      .then((r) => setItems(r.announcements))
      .catch(() => setItems([]));
  }, []);

  if (!items || items.length === 0) return null;

  return (
    <section className="ph-card ph-announce" aria-labelledby="announce-h">
      <h2 id="announce-h" className="ph-announce__h">
        📢 ประกาศจากครู
      </h2>
      <ul className="ph-announce__list">
        {(all || !limit ? items : items.slice(0, limit)).map((a) => (
          <li key={a.id} className="ph-announce__item">
            <h3 className="ph-announce__title">
              {a.isNew ? <span className="ph-new">ใหม่</span> : null}
              {a.title}
            </h3>
            <p className="ph-announce__time">{fmtDateTime(a.createdAt)}</p>
            <p className="ph-announce__body">{a.body}</p>
          </li>
        ))}
      </ul>
      {limit && !all && items.length > limit ? (
        <button type="button" className="ph-link ph-announce__more" onClick={() => setAll(true)}>
          ดูประกาศทั้งหมด ({items.length})
        </button>
      ) : null}
    </section>
  );
}
