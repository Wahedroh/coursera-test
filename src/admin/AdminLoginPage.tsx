import { useState, type FormEvent } from "react";
import { api, ApiError } from "../lib/api";
import { Card } from "../components/Card";
import { StickerTitle } from "../components/StickerTitle";

export function AdminLoginPage({ notice, onLogin }: { notice?: string; onLogin: () => void }) {
  const [password, setPassword] = useState("");
  const [pwError, setPwError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setPwError("");
    setBusy(true);
    try {
      await api("/admin/auth/password", { password });
      onLogin();
    } catch (err) {
      setPwError(err instanceof ApiError && err.body?.message ? err.body.message : "ระบบขัดข้อง กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <StickerTitle top="เรียนย้อนหลัง" bottom="ฟิสิกส์" subtitle="หลังบ้านครู" />
      <Card>
        <div className="ph-form">
          {notice ? <p className="ph-alert">{notice}</p> : null}
          <form className="ph-form" onSubmit={submit}>
            <div className="ph-field">
              <label htmlFor="admin-password">รหัสผ่านครู</label>
              <input
                id="admin-password"
                className="ph-input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {pwError ? (
              <p className="ph-error" role="alert">
                {pwError}
              </p>
            ) : null}
            <button className="ph-btn" type="submit" disabled={busy || !password}>
              {busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
            </button>
          </form>
        </div>
      </Card>
    </>
  );
}
