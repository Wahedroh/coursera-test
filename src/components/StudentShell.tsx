import { useEffect, useState, type ReactNode } from "react";
import type { HomeData } from "../../shared/home";
import { api } from "../lib/api";
import { TabBar, type StudentTab } from "./TabBar";

type Props = { active: StudentTab; newAnswers?: number; children: ReactNode };

/** หน้าของนักเรียนที่ครูยืนยันแล้ว + แถบเมนูล่าง (หน้าแรกส่งจำนวนคำตอบใหม่มาเอง หน้าอื่นโหลดเอง) */
export function StudentShell({ active, newAnswers, children }: Props) {
  const [loaded, setLoaded] = useState(0);

  useEffect(() => {
    if (newAnswers !== undefined || active === "questions") return;
    api<HomeData>("/home")
      .then((h) => setLoaded(h.alerts.newAnswers))
      .catch(() => undefined);
  }, [active, newAnswers]);

  return (
    <>
      {children}
      <TabBar active={active} newAnswers={newAnswers ?? loaded} />
    </>
  );
}
