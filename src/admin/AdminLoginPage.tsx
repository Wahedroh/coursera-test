import { useState } from "react";
import { Card } from "../components/Card";
import { StickerTitle } from "../components/StickerTitle";

const ERRORS: Record<string, string> = {
  failed: "เข้าสู่ระบบด้วย Facebook ไม่สำเร็จ กรุณาลองใหม่",
  cancelled: "ยกเลิกการเข้าสู่ระบบด้วย Facebook",
  config: "ยังไม่ได้ตั้งค่า Facebook Login (FACEBOOK_APP_ID / FACEBOOK_APP_SECRET)",
};

export function AdminLoginPage({ notice }: { notice?: string }) {
  const params = new URLSearchParams(window.location.search);
  const error = params.get("error");
  const deniedId = error === "denied" ? params.get("id") : null;
  const [copied, setCopied] = useState(false);

  return (
    <>
      <StickerTitle top="เรียนย้อนหลัง" bottom="ฟิสิกส์" subtitle="หลังบ้านครู" />
      <Card>
        <div className="ph-form">
          {notice ? <p className="ph-alert">{notice}</p> : null}
          {error && error !== "denied" ? (
            <p className="ph-error" role="alert">
              {ERRORS[error] ?? ERRORS.failed}
            </p>
          ) : null}
          {deniedId ? (
            <div className="ph-alert" role="alert">
              <p className="ph-m0">บัญชี Facebook นี้ยังไม่มีสิทธิ์เข้าหลังบ้าน</p>
              <p className="ph-m0">
                ID ของบัญชีนี้: <code className="ph-code">{deniedId}</code>{" "}
                <button
                  type="button"
                  className="ph-link"
                  onClick={() => navigator.clipboard?.writeText(deniedId).then(() => setCopied(true))}
                >
                  {copied ? "คัดลอกแล้ว" : "คัดลอก"}
                </button>
              </p>
              <p className="ph-m0 ph-small">
                ถ้าเป็นบัญชีครู ให้นำ ID นี้ไปใส่ในค่า ADMIN_FACEBOOK_IDS แล้วเข้าสู่ระบบใหม่
              </p>
            </div>
          ) : null}
          <a className="ph-btn ph-btn--fb" href="/api/admin/auth/facebook">
            เข้าสู่ระบบด้วย Facebook
          </a>
        </div>
      </Card>
    </>
  );
}
