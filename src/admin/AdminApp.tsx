import { useCallback, useEffect, useState } from "react";
import { StickerTitle } from "../components/StickerTitle";
import { api } from "../lib/api";
import { navigate, usePath } from "../lib/router";
import { AdminLoginPage } from "./AdminLoginPage";
import { StudentsPage } from "./StudentsPage";

type State = "loading" | "guest" | "admin";

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
    if (state === "admin" && path !== "/admin") navigate("/admin", true);
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
        <StickerTitle top="หลังบ้าน" bottom="นักเรียน" size="sm" />
        <button type="button" className="ph-btn ph-btn--sm ph-btn--light" onClick={logout}>
          ออกจากระบบ
        </button>
      </div>
      <StudentsPage onUnauthorized={unauthorized} />
    </>
  );
}
