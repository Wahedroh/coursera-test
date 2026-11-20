import { useCallback, useEffect, useRef, useState } from "react";
import type { Me } from "../shared/validate";
import { api, ApiError } from "./lib/api";
import { navigate, usePath } from "./lib/router";
import { AccountPage } from "./pages/AccountPage";
import { ClipsPage } from "./pages/ClipsPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { MyQuestionsPage } from "./pages/MyQuestionsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { RegisterPage } from "./pages/RegisterPage";
import { StudentHomePage } from "./pages/StudentHomePage";
import { WatchPage } from "./pages/WatchPage";

type Auth = { state: "loading" } | { state: "guest"; notice?: string } | { state: "student"; me: Me };

const KICKED = "บัญชีนี้ถูกเข้าใช้จากเครื่องอื่น หรือหมดเวลาใช้งาน กรุณาเข้าสู่ระบบใหม่";
const GUEST_PATHS = ["/login", "/register", "/register/facebook"];
const WATCH_PATH = /^\/watch\/(\d+)$/;
/** หน้าที่นักเรียนแต่ละสถานะเปิดได้ (นอกจากหน้าดูคลิป) */
const APPROVED_PATHS = ["/", "/clips", "/questions", "/account", "/account/password"];
const OTHER_PATHS = ["/", "/account/password"];

export function App() {
  const path = usePath();
  const [auth, setAuth] = useState<Auth>({ state: "loading" });
  const authRef = useRef(auth);
  authRef.current = auth;
  // หน้าล่าสุดก่อนเข้าดูคลิป: ปุ่ม "← กลับ" ในหน้าดูคลิปพากลับไปที่นี่
  const backTo = useRef("/");
  if (!WATCH_PATH.test(path)) backTo.current = path + (path === "/clips" ? window.location.search : "");

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
      const approved = auth.me.status === "approved";
      const allowed = approved ? APPROVED_PATHS.includes(path) || WATCH_PATH.test(path) : OTHER_PATHS.includes(path);
      if (!allowed) navigate("/", true);
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
    const approved = auth.me.status === "approved";
    if (path === "/account/password") {
      page = <AccountPage backTo={approved ? "/account" : "/"} onAuthError={authError} />;
    } else if (!approved) {
      page = <HomePage me={auth.me} onLogout={logout} />;
    } else if (watch) {
      page = <WatchPage me={auth.me} videoId={Number(watch[1])} backTo={backTo.current} onAuthError={authError} />;
    } else if (path === "/clips") {
      page = <ClipsPage onAuthError={authError} />;
    } else if (path === "/questions") {
      page = <MyQuestionsPage onAuthError={authError} />;
    } else if (path === "/account") {
      page = <ProfilePage me={auth.me} onLogout={logout} />;
    } else {
      page = <StudentHomePage me={auth.me} onAuthError={authError} />;
    }
  } else if (auth.state === "guest") {
    page =
      path === "/register" ? (
        <RegisterPage onRegistered={signedIn} />
      ) : path === "/register/facebook" ? (
        <RegisterPage mode="facebook" onRegistered={signedIn} />
      ) : (
        <LoginPage notice={auth.notice} onLogin={signedIn} />
      );
  }

  return page;
}
