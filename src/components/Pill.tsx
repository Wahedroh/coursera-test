import type { ReactNode } from "react";

type Props = {
  icon: ReactNode;
  label: string;
  /** ป้ายกระดาษขาวเอียง เช่น "ม.4" */
  tag?: string;
};

/** แถบพู่กันกรม→ฟ้า + วงกลมไอคอนกรมขอบขาว + ป้ายกระดาษ */
export function Pill({ icon, label, tag }: Props) {
  return (
    <div className="ph-pill">
      <div className="ph-pill__bg" />
      <div className="ph-pill__badge">{icon}</div>
      <div className="ph-pill__label">{label}</div>
      {tag ? (
        <div className="ph-pill__tag">
          <span>{tag}</span>
        </div>
      ) : null}
    </div>
  );
}
