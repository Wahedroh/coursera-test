import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  COURSES,
  validateRegister,
  type Course,
  type FieldErrors,
  type Me,
  type RegisterInput,
} from "../../shared/validate";
import { Card } from "../components/Card";
import { Pill } from "../components/Pill";
import { StickerTitle } from "../components/StickerTitle";
import { AtomIcon, CradleIcon } from "../components/icons";
import { api, ApiError } from "../lib/api";
import { navigate } from "../lib/router";

const EMPTY: RegisterInput = {
  firstName: "",
  lastName: "",
  school: "",
  studentPhone: "",
  parentPhone: "",
  course: "",
  password: "",
  consent: false,
};

const COURSE_CHOICES: { value: Course; icon: ReactNode; tag: string }[] = [
  { value: "m12", icon: <AtomIcon />, tag: "ม.1&2" },
  { value: "m4", icon: <CradleIcon />, tag: "ม.4" },
];

/** เด้งรายชื่อโรงเรียนที่เคยมีคนกรอก */
function useSchoolSuggestions(q: string): string[] {
  const [list, setList] = useState<string[]>([]);
  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setList([]);
      return;
    }
    const t = setTimeout(() => {
      api<{ schools: string[] }>(`/schools?q=${encodeURIComponent(term)}`)
        .then((r) => setList(r.schools))
        .catch(() => setList([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);
  return list;
}

type Props = { onRegistered: (me: Me) => void };

export function RegisterPage({ onRegistered }: Props) {
  const [form, setForm] = useState<RegisterInput>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);
  const schools = useSchoolSuggestions(form.school);

  function set<K extends keyof RegisterInput>(key: K, value: RegisterInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setServerError("");
    const { errors: found } = validateRegister(form);
    setErrors(found);
    if (Object.keys(found).length) {
      document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
      return;
    }
    setBusy(true);
    try {
      onRegistered(await api<Me>("/auth/register", form));
    } catch (err) {
      if (err instanceof ApiError && err.body?.fields) setErrors(err.body.fields as FieldErrors);
      else setServerError("ระบบขัดข้อง กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  }

  const field = (key: "firstName" | "lastName" | "studentPhone" | "parentPhone", label: string, phone = false) => (
    <div className="ph-field">
      <label htmlFor={key}>{label}</label>
      <input
        id={key}
        className="ph-input"
        type={phone ? "tel" : "text"}
        inputMode={phone ? "numeric" : undefined}
        maxLength={phone ? 12 : 100}
        placeholder={phone ? "0812345678" : undefined}
        autoComplete={key === "firstName" ? "given-name" : key === "lastName" ? "family-name" : "off"}
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        aria-invalid={errors[key] ? true : undefined}
        aria-describedby={errors[key] ? `${key}-err` : undefined}
      />
      {errors[key] ? (
        <p id={`${key}-err`} className="ph-error">
          {errors[key]}
        </p>
      ) : null}
    </div>
  );

  return (
    <>
      <StickerTitle top="เรียนย้อนหลัง" bottom="ฟิสิกส์" subtitle="สมัครเรียน" />
      <Card>
        <form className="ph-form" onSubmit={submit} noValidate>
          <div className="ph-row">
            {field("firstName", "ชื่อ")}
            {field("lastName", "นามสกุล")}
          </div>

          <div className="ph-field">
            <label htmlFor="school">โรงเรียน</label>
            <input
              id="school"
              className="ph-input"
              list="school-list"
              maxLength={150}
              autoComplete="off"
              value={form.school}
              onChange={(e) => set("school", e.target.value)}
              aria-invalid={errors.school ? true : undefined}
              aria-describedby={errors.school ? "school-err" : undefined}
            />
            <datalist id="school-list">
              {schools.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            {errors.school ? (
              <p id="school-err" className="ph-error">
                {errors.school}
              </p>
            ) : null}
          </div>

          {field("studentPhone", "เบอร์นักเรียน (ใช้เป็นชื่อเข้าระบบ)", true)}
          {field("parentPhone", "เบอร์ผู้ปกครอง", true)}

          <fieldset className="ph-field ph-fieldset" aria-describedby={errors.course ? "course-err" : undefined}>
            <legend>เลือกคอร์ส (เลือกได้ 1 คอร์ส)</legend>
            {COURSE_CHOICES.map((c) => (
              <label key={c.value} className="ph-choice">
                <input
                  type="radio"
                  name="course"
                  value={c.value}
                  checked={form.course === c.value}
                  onChange={() => set("course", c.value)}
                  aria-invalid={errors.course ? true : undefined}
                />
                <Pill icon={c.icon} label="คอร์ส" tag={c.tag} />
                <span className="ph-sr">{COURSES[c.value]}</span>
              </label>
            ))}
            {errors.course ? (
              <p id="course-err" className="ph-error">
                {errors.course}
              </p>
            ) : null}
          </fieldset>

          <div className="ph-field">
            <label htmlFor="password">ตั้งรหัสผ่าน (อย่างน้อย 6 ตัว)</label>
            <input
              id="password"
              className="ph-input"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={errors.password ? "password-err" : undefined}
            />
            {errors.password ? (
              <p id="password-err" className="ph-error">
                {errors.password}
              </p>
            ) : null}
          </div>

          <div className="ph-field">
            <label className="ph-check">
              <input
                type="checkbox"
                checked={form.consent}
                onChange={(e) => set("consent", e.target.checked)}
                aria-invalid={errors.consent ? true : undefined}
                aria-describedby={errors.consent ? "consent-err" : undefined}
              />
              <span>
                ยินยอมให้เก็บข้อมูล ชื่อ-นามสกุล โรงเรียน เบอร์นักเรียน และเบอร์ผู้ปกครอง
                เพื่อใช้ยืนยันตัวตนและติดต่อเรื่องการเรียนเท่านั้น
              </span>
            </label>
            {errors.consent ? (
              <p id="consent-err" className="ph-error">
                {errors.consent}
              </p>
            ) : null}
          </div>

          {serverError ? (
            <p className="ph-error" role="alert">
              {serverError}
            </p>
          ) : null}
          <button className="ph-btn" type="submit" disabled={busy}>
            {busy ? "กำลังสมัคร…" : "สมัครเรียน"}
          </button>
          <div className="ph-actions ph-actions--center">
            <span>มีบัญชีแล้ว?</span>
            <button type="button" className="ph-link" onClick={() => navigate("/login")}>
              เข้าสู่ระบบ
            </button>
          </div>
        </form>
      </Card>
    </>
  );
}
