type Props = {
  /** บรรทัดบน (สีกรม) */
  top: string;
  /** บรรทัดล่าง (สีเหลือง ตัวใหญ่) */
  bottom: string;
  /** ป้ายเล็กใต้หัวข้อ */
  subtitle?: string;
};

/** หัวข้อแบบสติกเกอร์ 2 บรรทัด: ขอบขาวหนา + ขอบกรมนอก + เงา */
export function StickerTitle({ top, bottom, subtitle }: Props) {
  return (
    <h1 className="ph-title">
      <span>
        <span className="ph-stk ph-stk--top" data-t={top}>
          {top}
        </span>
      </span>
      <span>
        <span className="ph-stk ph-stk--bottom" data-t={bottom}>
          {bottom}
        </span>
      </span>
      {subtitle ? (
        <span>
          <span className="ph-subtitle">{subtitle}</span>
        </span>
      ) : null}
    </h1>
  );
}
