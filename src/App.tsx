import { useEffect, useState } from "react";
import { PageBackground } from "./components/PageBackground";
import { StickerTitle } from "./components/StickerTitle";
import { Card } from "./components/Card";
import { Pill } from "./components/Pill";
import { AtomIcon, CradleIcon } from "./components/icons";

type Health = { ok: boolean; tables: number } | null;

// ระยะที่ 1: หน้าโครงเปล่าสำหรับตรวจธีม + การเชื่อม API/D1/R2
export function App() {
  const [health, setHealth] = useState<Health>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((h: Health) => setHealth(h))
      .catch(() => setFailed(true));
  }, []);

  return (
    <>
      <PageBackground />
      <main className="ph-page">
        <StickerTitle top="เรียนย้อนหลัง" bottom="ฟิสิกส์" />
        <Card>
          <Pill icon={<AtomIcon />} label="คอร์ส" tag="ม.1&2" />
          <Pill icon={<CradleIcon />} label="คอร์ส" tag="ม.4" />
          <p className="ph-brand" role="status">
            {failed ? "เชื่อมต่อระบบไม่ได้" : health ? "ระบบพร้อม" : "กำลังเชื่อมต่อ…"}
          </p>
          <p className="ph-brand">
            เรียนฟิสิกส์ <b>:</b> Physics Head
          </p>
        </Card>
      </main>
    </>
  );
}
