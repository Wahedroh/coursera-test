import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./theme/fonts";
import "./theme/tokens.css";
import "./theme/base.css";
import "./theme/components.css";
import { App } from "./App";
import { AdminApp } from "./admin/AdminApp";
import { PageBackground } from "./components/PageBackground";
import { navigate, usePath } from "./lib/router";
import { PrivacyPage, TermsPage } from "./pages/LegalPages";

/** /admin/* = หลังบ้านครู, ที่เหลือ = ฝั่งนักเรียน */
function Root() {
  const path = usePath();
  const isAdmin = path === "/admin" || path.startsWith("/admin/");
  // หน้านโยบาย/ข้อตกลง เปิดได้โดยไม่ต้องเข้าสู่ระบบ
  const page =
    path === "/privacy" ? <PrivacyPage /> : path === "/terms" ? <TermsPage /> : isAdmin ? <AdminApp /> : <App />;
  const link = (to: string, label: string) => (
    <a
      href={to}
      onClick={(e) => {
        e.preventDefault();
        navigate(to);
        window.scrollTo(0, 0);
      }}
    >
      {label}
    </a>
  );
  return (
    <>
      <PageBackground />
      <main className={isAdmin ? "ph-page ph-page--wide" : "ph-page"}>{page}</main>
      <footer className="ph-footer">
        <div>
          เรียนฟิสิกส์ <b>:</b> Physics Head
        </div>
        <nav className="ph-footer__links" aria-label="นโยบาย">
          {link("/privacy", "นโยบายความเป็นส่วนตัว")}
          {link("/terms", "ข้อตกลงการใช้งาน")}
        </nav>
      </footer>
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
