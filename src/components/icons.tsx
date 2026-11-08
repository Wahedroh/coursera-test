import type { ReactNode } from "react";

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      stroke="#fff"
      strokeWidth={5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const Y = { fill: "var(--yellow)", stroke: "none" } as const;

export function AtomIcon() {
  return (
    <Icon>
      <ellipse cx="50" cy="50" rx="40" ry="15" />
      <ellipse cx="50" cy="50" rx="40" ry="15" transform="rotate(60 50 50)" />
      <ellipse cx="50" cy="50" rx="40" ry="15" transform="rotate(-60 50 50)" />
      <circle cx="50" cy="50" r="7" fill="#fff" />
      <circle cx="90" cy="50" r="6" {...Y} />
      <circle cx="30" cy="16" r="6" {...Y} />
      <circle cx="30" cy="84" r="6" {...Y} />
    </Icon>
  );
}

export function CradleIcon() {
  return (
    <Icon>
      <path d="M8 14H78" />
      <path d="M20 14V66M36 14V66M52 14V66M68 14V66" />
      <path d="M78 14L94 58" />
      <circle cx="20" cy="74" r="8" fill="#fff" />
      <circle cx="36" cy="74" r="8" fill="#fff" />
      <circle cx="52" cy="74" r="8" fill="#fff" />
      <circle cx="68" cy="74" r="8" fill="#fff" />
      <circle cx="96" cy="64" r="8" {...Y} />
    </Icon>
  );
}
