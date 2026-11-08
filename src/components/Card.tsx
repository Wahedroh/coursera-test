import type { ReactNode } from "react";

/** การ์ดขาวนวล มุมโค้ง */
export function Card({ children }: { children: ReactNode }) {
  return <section className="ph-card">{children}</section>;
}
