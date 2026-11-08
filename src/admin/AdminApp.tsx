import { useCallback, useEffect, useState } from "react";
import { StickerTitle } from "../components/StickerTitle";
import { api } from "../lib/api";
import { navigate, usePath } from "../lib/router";
import { AdminLoginPage } from "./AdminLoginPage";
import { AnnouncementsPage } from "./AnnouncementsPage";
import { ContentPage } from "./ContentPage";
import { DataPage } from "./DataPage";
import { StudentProgressPage } from "./StudentProgressPage";
import { StudentsPage } from "./StudentsPage";

type State = "loading" | "guest" | "admin";

const PAGES = [
  { path: "/admin", label: "นักเรียน" },
  { path: "/admin/content", label: "บทและคลิป" },
  { path: "/admin/announcements", label: "ประกาศ" },
  { path: "/admin/data", label: "ข้อมูล" },
] as const;
const STUDENT_PATH = /^\/admin\/students\/(\d+)$/;

export function AdminApp() {
  const path = usePath();
  const [state, setState] = useState<State>("loading");
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    api("/admin/me")
      .then(() => setState("admin"))
      .catch(() => setState("guest"));
  }, []);

  useEffect(() => {
    if (state === "guest" && path !== "/admin/login") navigate("/admin/login", true);
    if (state === "admin" && !PAGES.some((p) => p.path === path) && !STUDENT_PATH.test(path)) navigate("/admin", true);
  }, [state, path]);

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
  if (state === "guest") return <AdminLoginPage notice={notice} />;

  return (
    <>
      <div className="ph-adminbar">
        <StickerTitle
          top="หลังบ้าน"
          bottom={STUDENT_PATH.test(path) ? "ประวัติการเรียน" : (PAGES.find((p) => p.path === path)?.label ?? "นักเรียน")}
          size="sm"
        />
        <button type="button" className="ph-btn ph-btn--sm ph-btn--light" onClick={logout}>
          ออกจากระบบ
        </button>
      </div>
      <nav className="ph-adminnav" aria-label="เมนูหลังบ้าน">
        {PAGES.map((p) => {
          // หน้าประวัติรายคนอยู่ใต้เมนู "นักเรียน"
          const active = path === p.path || (p.path === "/admin" && STUDENT_PATH.test(path));
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
            </a>
          );
        })}
      </nav>
      {STUDENT_PATH.test(path) ? (
        <StudentProgressPage studentId={Number(path.match(STUDENT_PATH)![1])} onUnauthorized={unauthorized} />
      ) : path === "/admin/content" ? (
        <ContentPage onUnauthorized={unauthorized} />
      ) : path === "/admin/data" ? (
        <DataPage onUnauthorized={unauthorized} />
      ) : path === "/admin/announcements" ? (
        <AnnouncementsPage onUnauthorized={unauthorized} />
      ) : (
        <StudentsPage onUnauthorized={unauthorized} />
      )}
    </>
  );
}
