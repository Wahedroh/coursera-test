import { useEffect, useState } from "react";
import type { Announcement } from "../../shared/announcements";
import { api } from "../lib/api";

export const fmtDateTime = (sec: number) =>
  new Date(sec * 1000).toLocaleString("th-TH", { day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });

/** ประกาศจากครูที่นักเรียนคนนี้ควรเห็น (ทุกคน + คอร์สตัวเอง) */
export function AnnouncementList() {
  const [items, setItems] = useState<Announcement[] | null>(null);

  useEffect(() => {
    api<{ announcements: Announcement[] }>("/announcements")
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
        {items.map((a) => (
          <li key={a.id} className="ph-announce__item">
            <h3 className="ph-announce__title">{a.title}</h3>
            <p className="ph-announce__time">{fmtDateTime(a.createdAt)}</p>
            <p className="ph-announce__body">{a.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
