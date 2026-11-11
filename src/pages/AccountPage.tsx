import { useEffect, useState, type FormEvent } from "react";
import { PASSWORD_MIN } from "../../shared/validate";
import { Card } from "../components/Card";
import { StickerTitle } from "../components/StickerTitle";
import { api, ApiError } from "../lib/api";
import { navigate } from "../lib/router";

type Props = { onAuthError: () => void };

/** นักเรียนเปลี่ยนรหัสผ่านเอง (สมัครด้วย Facebook และยังไม่มีรหัส → ตั้งรหัสใหม่ได้เลย) */
export function AccountPage({ onAuthError }: Props) {
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ hasPassword: boolean }>("/auth/password")
      .then((r) => setHasPassword(r.hasPassword))
      .catch(onAuthError);
  }, [onAuthError]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (hasPassword && !current) found.current = "กรุณากรอกรหัสผ่านเดิม";
    if (next.length < PASSWORD_MIN) found.next = `รหัสผ่านใหม่ต้องมีอย่างน้อย ${PASSWORD_MIN} ตัว`;
    else if (next !== confirm) found.confirm = "รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน";
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      await api("/auth/password", { current, next });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) onAuthError();
      else if (err instanceof ApiError && err.body?.fields) setErrors(err.body.fields);
      else setErrors({ form: err instanceof ApiError && err.body?.message ? err.body.message : "ระบบขัดข้อง กรุณาลองใหม่" });
    } finally {
      setBusy(false);
    }
  };

  const field = (id: "current" | "next" | "confirm", label: string, value: string, set: (v: string) => void, auto: string) => (
    <div className="ph-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="ph-input"
        type="password"
        autoComplete={auto}
        value={value}
        onChange={(e) => {
          set(e.target.value);
          setErrors((x) => ({ ...x, [id]: "" }));
        }}
        aria-invalid={errors[id] ? true : undefined}
      />
      {errors[id] ? <p className="ph-error">{errors[id]}</p> : null}
    </div>
  );

  return (
    <>
      <StickerTitle top="เรียนย้อนหลัง" bottom="ฟิสิกส์" subtitle={hasPassword === false ? "ตั้งรหัสผ่าน" : "เปลี่ยนรหัสผ่าน"} />
      <div className="ph-stack">
        <div>
          <button type="button" className="ph-btn ph-btn--sm ph-btn--light" onClick={() => navigate("/")}>
            ← กลับหน้าแรก
          </button>
        </div>
        <Card>
          {done ? (
            <div className="ph-form">
              <p className="ph-status ph-status--approved" role="status">
                บันทึกรหัสผ่านใหม่แล้ว
              </p>
              <button type="button" className="ph-btn" onClick={() => navigate("/")}>
                กลับหน้าแรก
              </button>
            </div>
          ) : hasPassword === null ? null : (
            <form className="ph-form" onSubmit={submit} noValidate>
              {hasPassword === false ? (
                <p className="ph-alert">บัญชีนี้สมัครด้วย Facebook ตั้งรหัสผ่านไว้เพื่อเข้าด้วยเบอร์นักเรียนได้อีกทาง</p>
              ) : (
                field("current", "รหัสผ่านเดิม", current, setCurrent, "current-password")
              )}
              {field("next", `รหัสผ่านใหม่ (อย่างน้อย ${PASSWORD_MIN} ตัว)`, next, setNext, "new-password")}
              {field("confirm", "พิมพ์รหัสผ่านใหม่อีกครั้ง", confirm, setConfirm, "new-password")}
              {errors.form ? (
                <p className="ph-error" role="alert">
                  {errors.form}
                </p>
              ) : null}
              <button className="ph-btn" type="submit" disabled={busy}>
                {busy ? "กำลังบันทึก…" : "บันทึกรหัสผ่าน"}
              </button>
            </form>
          )}
        </Card>
      </div>
    </>
  );
}
