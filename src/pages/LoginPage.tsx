import { useState, type FormEvent } from "react";
import type { Me } from "../../shared/validate";
import { Card } from "../components/Card";
import { StickerTitle } from "../components/StickerTitle";
import { api, ApiError } from "../lib/api";
import { navigate } from "../lib/router";

type Props = { notice?: string; onLogin: (me: Me) => void };

const FB_ERRORS: Record<string, string> = {
  cancelled: "ยกเลิกการเข้าสู่ระบบด้วย Facebook",
  failed: "เข้าสู่ระบบด้วย Facebook ไม่สำเร็จ กรุณาลองใหม่",
  config: "ยังเข้าสู่ระบบด้วย Facebook ไม่ได้ในตอนนี้ กรุณาใช้เบอร์และรหัสผ่าน",
};

export function LoginPage({ notice, onLogin }: Props) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const fbError = new URLSearchParams(window.location.search).get("fb");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      onLogin(await api<Me>("/auth/login", { phone, password }));
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? "เบอร์หรือรหัสผ่านไม่ถูกต้อง"
          : err instanceof ApiError && err.status === 429 && err.body?.message
            ? err.body.message
            : "ระบบขัดข้อง กรุณาลองใหม่",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <StickerTitle top="เรียนย้อนหลัง" bottom="ฟิสิกส์" subtitle="เข้าสู่ระบบ" />
      <Card>
        <form className="ph-form" onSubmit={submit} noValidate>
          {notice ? (
            <p className="ph-alert" role="alert">
              {notice}
            </p>
          ) : null}
          {fbError ? (
            <p className="ph-error" role="alert">
              {FB_ERRORS[fbError] ?? FB_ERRORS.failed}
            </p>
          ) : null}
          <a className="ph-btn ph-btn--fb" href="/api/auth/facebook">
            เข้าสู่ระบบด้วย Facebook
          </a>
          <p className="ph-divider">หรือใช้เบอร์นักเรียน</p>
          <div className="ph-field">
            <label htmlFor="phone">เบอร์นักเรียน</label>
            <input
              id="phone"
              className="ph-input"
              type="tel"
              inputMode="numeric"
              autoComplete="username"
              placeholder="0812345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>
          <div className="ph-field">
            <label htmlFor="password">รหัสผ่าน</label>
            <input
              id="password"
              className="ph-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error ? (
            <p className="ph-error" role="alert">
              {error}
            </p>
          ) : null}
          <button className="ph-btn" type="submit" disabled={busy}>
            {busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
          </button>
          <div className="ph-actions">
            <button type="button" className="ph-link" onClick={() => setShowForgot((v) => !v)}>
              ลืมรหัสผ่าน?
            </button>
            <button type="button" className="ph-link" onClick={() => navigate("/register")}>
              สมัครเรียน
            </button>
          </div>
          {showForgot ? <p className="ph-note">ติดต่อครูเพื่อให้ตั้งรหัสผ่านใหม่ให้</p> : null}
        </form>
      </Card>
    </>
  );
}
