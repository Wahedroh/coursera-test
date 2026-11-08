/** คลื่นฟ้ามุมบนซ้าย-ขวา + จุด halftone และ SVG filter สำหรับขอบพู่กัน */
export function PageBackground() {
  return (
    <>
      <svg className="ph-wave ph-wave--left" viewBox="0 0 330 290" aria-hidden="true">
        <defs>
          <pattern id="ph-dots" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="11" cy="11" r="3.2" fill="#fff" />
          </pattern>
          <radialGradient id="ph-fade" cx="0" cy="0" r="1">
            <stop offset=".25" stopColor="#fff" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id="ph-fade-mask">
            <rect x="20" y="10" width="190" height="130" fill="url(#ph-fade)" />
          </mask>
        </defs>
        <path d="M0 0H330C300 40 250 70 190 92C120 118 80 160 70 230C64 268 40 285 0 290Z" fill="var(--wave)" />
        <path d="M0 0H250C226 30 190 50 140 64C80 82 50 120 40 170C34 196 20 205 0 208Z" fill="var(--wave-d)" opacity=".55" />
        <rect x="20" y="20" width="200" height="120" fill="url(#ph-dots)" opacity=".75" mask="url(#ph-fade-mask)" />
      </svg>
      <svg className="ph-wave ph-wave--right" viewBox="740 0 340 290" aria-hidden="true">
        <path d="M1080 0H740C790 26 860 40 930 50C990 60 1010 100 1012 160C1014 220 1040 270 1080 290Z" fill="var(--wave)" />
        <path d="M1080 0H860C890 12 940 16 990 22C1040 30 1062 52 1068 90C1072 112 1076 124 1080 130Z" fill="var(--wave-d)" opacity=".55" />
        <rect x="890" y="20" width="180" height="150" fill="url(#ph-dots)" opacity=".7" />
      </svg>
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <filter id="ph-rough" x="-5%" y="-10%" width="110%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.06" numOctaves={3} seed={4} />
          <feDisplacementMap in="SourceGraphic" scale={11} />
        </filter>
        <filter id="ph-rough2" x="-10%" y="-20%" width="120%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves={2} seed={9} />
          <feDisplacementMap in="SourceGraphic" scale={10} />
        </filter>
      </svg>
    </>
  );
}
