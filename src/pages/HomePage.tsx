import { useState } from "react";
import { COURSES, type Me } from "../../shared/validate";
import { AnnouncementList } from "../components/AnnouncementList";
import { Card } from "../components/Card";
import { StickerTitle } from "../components/StickerTitle";
import { api } from "../lib/api";

const STATUS = {
  pending: { subtitle: "รอครูยืนยัน", text: "สมัครเรียบร้อยแล้ว รอครูยืนยัน เมื่อครูยืนยันแล้วจะเห็นคลิปของคอร์ส" },
  approved: { subtitle: "ยินดีต้อนรับ", text: "ครูยืนยันแล้ว" },
  rejected: { subtitle: "ไม่ผ่านการยืนยัน", text: "บัญชีนี้ไม่ได้รับการยืนยัน กรุณาติดต่อครู" },
  suspended: { subtitle: "บัญชีถูกระงับ", text: "บัญชีนี้ถูกระงับ กรุณาติดต่อครู" },
} as const;

type Props = { me: Me; onLogout: () => void };

export function HomePage({ me, onLogout }: Props) {
  const [busy, setBusy] = useState(false);
  const s = STATUS[me.status];

  async function logout() {
    setBusy(true);
    try {
      await api("/auth/logout", {});
    } finally {
      onLogout();
    }
  }

  return (
    <>
      <StickerTitle top="เรียนย้อนหลัง" bottom="ฟิสิกส์" subtitle={s.subtitle} />
      <div className="ph-stack">
        <Card>
          <div className="ph-form">
            <p className={`ph-status ph-status--${me.status}`} role="status">
              {s.text}
            </p>
            <dl className="ph-profile">
              <dt>ชื่อ</dt>
              <dd>
                {me.firstName} {me.lastName}
              </dd>
              <dt>โรงเรียน</dt>
              <dd>{me.school}</dd>
              <dt>คอร์ส</dt>
              <dd>{COURSES[me.course]}</dd>
              <dt>เบอร์นักเรียน</dt>
              <dd>{me.studentPhone}</dd>
            </dl>
            <button className="ph-btn ph-btn--ghost" type="button" onClick={logout} disabled={busy}>
              ออกจากระบบ
            </button>
          </div>
        </Card>
        <AnnouncementList />
      </div>
    </>
  );
}
