import { useEffect, type ReactElement } from "react";
import { createPortal } from "react-dom";
import { navigate } from "../lib/router";

export type StudentTab = "home" | "clips" | "questions" | "account";

const TABS: { key: StudentTab; path: string; label: string; icon: ReactElement }[] = [
  {
    key: "home",
    path: "/",
    label: "หน้าแรก",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </svg>
    ),
  },
  {
    key: "clips",
    path: "/clips",
    label: "คลิปทั้งหมด",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <path d="M10 9l5 3-5 3z" />
      </svg>
    ),
  },
  {
    key: "questions",
    path: "/questions",
    label: "คำถามของฉัน",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 5h16v11H9l-5 4z" />
      </svg>
    ),
  },
  {
    key: "account",
    path: "/account",
    label: "บัญชี",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="9" r="4" />
        <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
      </svg>
    ),
  },
];

/** แถบเมนูล่างจอของนักเรียน (ลิงก์ท้ายเว็บถูกดันขึ้นเหนือแถบด้วยคลาส has-tabbar) */
export function TabBar({ active, newAnswers }: { active: StudentTab; newAnswers: number }) {
  useEffect(() => {
    document.body.classList.add("has-tabbar");
    return () => document.body.classList.remove("has-tabbar");
  }, []);

  // วางที่ body โดยตรง: ไม่ให้ลิงก์ท้ายเว็บ (ซึ่งอยู่ชั้นสูงกว่าเนื้อหา) ทับแถบ
  return createPortal(
    <nav className="ph-tabbar" aria-label="เมนูนักเรียน">
      {TABS.map((t) => {
        const on = t.key === active;
        const dot = t.key === "questions" && !on && newAnswers > 0;
        return (
          <a
            key={t.key}
            href={t.path}
            className={on ? "is-active" : undefined}
            aria-current={on ? "page" : undefined}
            onClick={(e) => {
              e.preventDefault();
              navigate(t.path);
              window.scrollTo(0, 0);
            }}
          >
            {t.icon}
            {t.label}
            {dot ? (
              <span className="ph-tabbar__dot" aria-label={`คำตอบใหม่ ${newAnswers} ข้อ`}>
                {newAnswers}
              </span>
            ) : null}
          </a>
        );
      })}
    </nav>,
    document.body,
  );
}
