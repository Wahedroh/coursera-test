import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./theme/fonts";
import "./theme/tokens.css";
import "./theme/base.css";
import "./theme/components.css";
import { App } from "./App";
import { AdminApp } from "./admin/AdminApp";
import { PageBackground } from "./components/PageBackground";
import { usePath } from "./lib/router";

/** /admin/* = หลังบ้านครู, ที่เหลือ = ฝั่งนักเรียน */
function Root() {
  const path = usePath();
  const isAdmin = path === "/admin" || path.startsWith("/admin/");
  return (
    <>
      <PageBackground />
      <main className={isAdmin ? "ph-page ph-page--wide" : "ph-page"}>{isAdmin ? <AdminApp /> : <App />}</main>
      <footer className="ph-footer">
        เรียนฟิสิกส์ <b>:</b> Physics Head
      </footer>
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
