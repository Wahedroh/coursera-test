import { COURSES, type Me } from "../../shared/validate";
import { Card } from "../components/Card";
import { StickerTitle } from "../components/StickerTitle";
import { StudentShell } from "../components/StudentShell";
import { api } from "../lib/api";
import { navigate } from "../lib/router";

type Props = { me: Me; onLogout: () => void };

/** แท็บ "บัญชี": ข้อมูลนักเรียน + เปลี่ยนรหัสผ่าน + ออกจากระบบ */
export function ProfilePage({ me, onLogout }: Props) {
  const logout = async () => {
    await api("/auth/logout", {}).catch(() => undefined);
    onLogout();
  };

  return (
    <StudentShell active="account">
      <StickerTitle top="เรียนย้อนหลัง" bottom="ฟิสิกส์" subtitle="บัญชี" />
      <div className="ph-stack">
        <Card>
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
        </Card>
        <div className="ph-alerts">
          <button type="button" className="ph-acct-row" onClick={() => navigate("/account/password")}>
            <span>🔑 เปลี่ยนรหัสผ่าน</span>
            <span className="ph-alert-row__go" aria-hidden="true">
              ›
            </span>
          </button>
          <button type="button" className="ph-acct-row is-out" onClick={logout}>
            <span>ออกจากระบบ</span>
          </button>
        </div>
      </div>
    </StudentShell>
  );
}
