import { useCallback, useEffect, useRef, useState } from "react";
import type { Me } from "../shared/validate";
import { api, ApiError } from "./lib/api";
import { navigate, usePath } from "./lib/router";
import { CoursePage } from "./pages/CoursePage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { WatchPage } from "./pages/WatchPage";

type Auth = { state: "loading" } | { state: "guest"; notice?: string } | { state: "student"; me: Me };

const KICKED = "บัญชีนี้ถูกเข้าใช้จากเครื่องอื่น หรือหมดเวลาใช้งาน กรุณาเข้าสู่ระบบใหม่";
const GUEST_PATHS = ["/login", "/register"];
const WATCH_PATH = /^\/watch\/(\d+)$/;

export function App() {
  const path = usePath();
  const [auth, setAuth] = useState<Auth>({ state: "loading" });
  const authRef = useRef(auth);
  authRef.current = auth;

  const loadMe = useCallback(async () => {
    try {
      setAuth({ state: "student", me: await api<Me>("/me") });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // เคยเข้าอยู่แล้วหลุด = มีเครื่องอื่นเข้าบัญชีนี้ หรือหมดอายุ
        setAuth({ state: "guest", notice: authRef.current.state === "student" ? KICKED : undefined });
      } else if (authRef.current.state === "loading") {
        setAuth({ state: "guest", notice: "เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่" });
      }
    }
  }, []);

  useEffect(() => {
    loadMe();
    // กลับมาที่แท็บนี้ → ตรวจสถานะใหม่ (เห็นผลครูยืนยัน / รู้ว่าถูกเครื่องอื่นเข้าแทน)
    const onVisible = () => {
      if (document.visibilityState === "visible" && authRef.current.state === "student") loadMe();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [loadMe]);

  // พาไปหน้าที่ถูกต้องตามสถานะการเข้าสู่ระบบ
  useEffect(() => {
    if (auth.state === "guest" && !GUEST_PATHS.includes(path)) navigate("/login", true);
    if (auth.state === "student") {
      const canWatch = auth.me.status === "approved" && WATCH_PATH.test(path);
      if (path !== "/" && !canWatch) navigate("/", true);
    }
  }, [auth, path]);

  const signedIn = (me: Me) => {
    setAuth({ state: "student", me });
    navigate("/", true);
  };

  // API ตอบ 401/403 ระหว่างใช้งาน → ตรวจสถานะใหม่ (ถูกเครื่องอื่นเข้าแทน / ครูระงับบัญชี)
  const authError = useCallback(() => {
    loadMe();
  }, [loadMe]);

  let page = null;
  if (auth.state === "student") {
    const watch = path.match(WATCH_PATH);
    const logout = () => setAuth({ state: "guest" });
    if (auth.me.status === "approved" && watch) {
      page = <WatchPage me={auth.me} videoId={Number(watch[1])} onAuthError={authError} />;
    } else if (auth.me.status === "approved") {
      page = <CoursePage me={auth.me} onLogout={logout} onAuthError={authError} />;
    } else {
      page = <HomePage me={auth.me} onLogout={logout} />;
    }
  } else if (auth.state === "guest") {
    page =
      path === "/register" ? (
        <RegisterPage onRegistered={signedIn} />
      ) : (
        <LoginPage notice={auth.notice} onLogin={signedIn} />
      );
  }

  return page;
}
