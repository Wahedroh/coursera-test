import { useCallback, useEffect, useState } from "react";
import { StickerTitle } from "../components/StickerTitle";
import { api } from "../lib/api";
import { navigate, usePath } from "../lib/router";
import { AdminLoginPage } from "./AdminLoginPage";
import { AnnouncementsPage } from "./AnnouncementsPage";
import { ContentPage } from "./ContentPage";
import { DataPage } from "./DataPage";
import { OverviewPage } from "./OverviewPage";
import { QuestionsPage } from "./QuestionsPage";
import { StudentProgressPage } from "./StudentProgressPage";
import { StudentsPage } from "./StudentsPage";
import { SummaryPage } from "./SummaryPage";
import type { AdminBadges } from "../../shared/admin";

type State = "loading" | "guest" | "admin";

const PAGES = [
  { path: "/admin", label: "สรุป" },
  { path: "/admin/students", label: "นักเรียน" },
  { path: "/admin/overview", label: "ภาพรวม" },
  { path: "/admin/questions", label: "คำถาม" },
  { path: "/admin/content", label: "บทและคลิป" },
  { path: "/admin/announcements", label: "ประกาศ" },
  { path: "/admin/data", label: "ข้อมูล" },
] as const;
const STUDENT_PATH = /^\/admin\/students\/(\d+)$/;

export function AdminApp() {
  const path = usePath();
  const [state, setState] = useState<State>("loading");
  const [notice, setNotice] = useState<string>();
  const [badges, setBadges] = useState<AdminBadges>({ questions: 0, students: 0 });

  useEffect(() => {
    api("/admin/me")
      .then(() => setState("admin"))
      .catch(() => setState("guest"));
  }, []);

  useEffect(() => {
    if (state === "guest" && path !== "/admin/login") navigate("/admin/login", true);
    if (state === "admin" && !PAGES.some((p) => p.path === path) && !STUDENT_PATH.test(path)) navigate("/admin", true);
  }, [state, path]);

  // ตัวเลขบนเมนู: คำถามรอตอบ / นักเรียนรอยืนยัน (โหลดใหม่ทุกครั้งที่เปลี่ยนหน้า)
  const loadPending = useCallback(() => {
    api<AdminBadges>("/admin/badges")
      .then(setBadges)
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    if (state === "admin") loadPending();
  }, [state, path, loadPending]);

  const unauthorized = useCallback(() => {
    setNotice("หมดเวลาใช้งาน กรุณาเข้าสู่ระบบใหม่");
    setState("guest");
  }, []);

  const logout = async () => {
    await api("/admin/logout", {}).catch(() => undefined);
    setNotice(undefined);
    setState("guest");
  };

  if (state === "loading") return null;
  if (state === "guest")
    return (
      <AdminLoginPage
        notice={notice}
        onLogin={() => {
          setNotice(undefined);
          setState("admin");
          navigate("/admin", true);
        }}
      />
    );

  return (
    <>
      <div className="ph-adminbar">
        <StickerTitle
          top="หลังบ้าน"
          bottom={STUDENT_PATH.test(path) ? "ประวัติการเรียน" : (PAGES.find((p) => p.path === path)?.label ?? "สรุป")}
          size="sm"
        />
        <button type="button" className="ph-btn ph-btn--sm ph-btn--light" onClick={logout}>
          ออกจากระบบ
        </button>
      </div>
      <nav className="ph-adminnav" aria-label="เมนูหลังบ้าน">
        {PAGES.map((p) => {
          // หน้าประวัติรายคนอยู่ใต้เมนู "นักเรียน"
          const active = path === p.path || (p.path === "/admin/students" && STUDENT_PATH.test(path));
          const count = p.path === "/admin/questions" ? badges.questions : p.path === "/admin/students" ? badges.students : 0;
          return (
            <a
              key={p.path}
              href={p.path}
              className={`ph-adminnav__link${active ? " is-active" : ""}`}
              aria-current={active ? "page" : undefined}
              onClick={(e) => {
                e.preventDefault();
                navigate(p.path);
              }}
            >
              {p.label}
              {count > 0 ? (
                <span className="ph-adminnav__count" aria-label={p.path === "/admin/questions" ? `รอตอบ ${count} ข้อ` : `รอยืนยัน ${count} คน`}>
                  {count}
                </span>
              ) : null}
            </a>
          );
        })}
      </nav>
      {STUDENT_PATH.test(path) ? (
        <StudentProgressPage studentId={Number(path.match(STUDENT_PATH)![1])} onUnauthorized={unauthorized} />
      ) : path === "/admin/content" ? (
        <ContentPage onUnauthorized={unauthorized} />
      ) : path === "/admin/questions" ? (
        <QuestionsPage onUnauthorized={unauthorized} onChanged={loadPending} />
      ) : path === "/admin/overview" ? (
        <OverviewPage onUnauthorized={unauthorized} />
      ) : path === "/admin/data" ? (
        <DataPage onUnauthorized={unauthorized} />
      ) : path === "/admin/announcements" ? (
        <AnnouncementsPage onUnauthorized={unauthorized} />
      ) : path === "/admin/students" ? (
        <StudentsPage onUnauthorized={unauthorized} onChanged={loadPending} />
      ) : (
        <SummaryPage onUnauthorized={unauthorized} />
      )}
    </>
  );
}
