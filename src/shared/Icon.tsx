/**
 * 번들에 들어가는 선 아이콘 (24×24, currentColor). 외부 아이콘 폰트 · CDN을 쓰지 않는다.
 * 글자와 함께 쓰는 꾸밈이라 기본은 aria-hidden.
 */
const P = {
  camera: <><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.6l1.4-2h5l1.4 2h1.6A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" /><circle cx="12" cy="12.5" r="3.5" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  alert: <><path d="M12 4l9 15.5H3z" /><path d="M12 10v4" /><path d="M12 17h.01" /></>,
  left: <path d="M15 5l-7 7 7 7" />,
  right: <path d="M9 5l7 7-7 7" />,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  user: <><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20c.8-3.6 3.8-5.5 7.5-5.5s6.7 1.9 7.5 5.5" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="9.5" rx="2.5" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></>,
  logout: <><path d="M14 4h3.5A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5H14" /><path d="M10 8l-4 4 4 4" /><path d="M6 12h9" /></>,
  upload: <><path d="M12 15V4" /><path d="M7.5 8.5L12 4l4.5 4.5" /><path d="M4.5 15v2.5A2.5 2.5 0 0 0 7 20h10a2.5 2.5 0 0 0 2.5-2.5V15" /></>,
  download: <><path d="M12 4v11" /><path d="M7.5 10.5L12 15l4.5-4.5" /><path d="M4.5 15v2.5A2.5 2.5 0 0 0 7 20h10a2.5 2.5 0 0 0 2.5-2.5V15" /></>,
  refresh: <><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" /><path d="M19.5 4.5v4h-4" /></>,
  wifiOff: <><path d="M4 4l16 16" /><path d="M8.5 16.2a5 5 0 0 1 7 0" /><path d="M5.2 12.8a9.6 9.6 0 0 1 4-2.2" /><path d="M14.8 10.6a9.6 9.6 0 0 1 4 2.2" /><path d="M2.5 9.3a14 14 0 0 1 4.1-2.6" /><path d="M10.6 5.6A14 14 0 0 1 21.5 9.3" /><path d="M12 19.5h.01" /></>,
  clock: <><circle cx="12" cy="12" r="8" /><path d="M12 7.5V12l3 2" /></>,
  image: <><rect x="4" y="5" width="16" height="14" rx="2.5" /><circle cx="9" cy="10" r="1.6" /><path d="M20 15.5l-4.5-4.5L7 19.5" /></>,
  phone: <><rect x="7" y="3" width="10" height="18" rx="2.5" /><path d="M11 17.5h2" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  flow: <><path d="M3.5 9h11a3 3 0 1 0-3-3" /><path d="M3.5 13h15a3 3 0 1 1-3 3" /><path d="M3.5 17h6" /></>,
  dust: <><circle cx="7" cy="8" r="1.6" /><circle cx="15.5" cy="6.5" r="2.2" /><circle cx="11" cy="13" r="2.6" /><circle cx="17.5" cy="14.5" r="1.4" /><circle cx="7.5" cy="18" r="1.4" /><circle cx="14" cy="19" r="1" /></>,
  gas: <><path d="M12 3.5c3.5 3.5 6 6.4 6 10a6 6 0 0 1-12 0c0-2.3 1.2-4 2.6-5.6.3 1.7 1.2 2.8 2.4 3.3C11 8.5 11.2 6 12 3.5z" /></>,
  radon: <><circle cx="12" cy="12" r="1.8" /><ellipse cx="12" cy="12" rx="8.5" ry="3.4" /><ellipse cx="12" cy="12" rx="8.5" ry="3.4" transform="rotate(60 12 12)" /><ellipse cx="12" cy="12" rx="8.5" ry="3.4" transform="rotate(-60 12 12)" /></>,
  inbox: <><path d="M4 13.5l2.2-7.2A2 2 0 0 1 8.1 5h7.8a2 2 0 0 1 1.9 1.3l2.2 7.2V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><path d="M4 13.5h4.5l1.2 2h4.6l1.2-2H20" /></>,
  file: <><path d="M14 3.5H7.5A2.5 2.5 0 0 0 5 6v12a2.5 2.5 0 0 0 2.5 2.5h9A2.5 2.5 0 0 0 19 18V8.5z" /><path d="M14 3.5v5h5" /><path d="M9 13.5h6" /><path d="M9 17h4" /></>,
  devices: <><rect x="3" y="5" width="13" height="10" rx="2" /><path d="M6.5 19h6" /><rect x="15.5" y="9" width="5.5" height="11" rx="1.6" /></>,
  merge: <><path d="M7 4v4a4 4 0 0 0 4 4h6" /><path d="M7 20v-4a4 4 0 0 1 4-4" /><path d="M14 9l3 3-3 3" /></>,
  wave: <><path d="M3 12h3l2-5 3.5 10 2.5-7 1.5 2H21" /></>,
  settings: <><path d="M4 7h10" /><path d="M18 7h2" /><circle cx="16" cy="7" r="2" /><path d="M4 17h3" /><path d="M11 17h9" /><circle cx="9" cy="17" r="2" /></>,
  qr: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><path d="M14 14h2.5v2.5H14z" /><path d="M19 14v1" /><path d="M14 19.5h1" /><path d="M18 18h2v2h-2z" /></>,
  table: <><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><path d="M3.5 9.5h17" /><path d="M3.5 14.5h17" /><path d="M9.5 9.5v10" /></>,
  sparkle: <path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9-1.9 5.1-1.9-5.1-5.1-1.9 5.1-1.9z" />,
  x: <><path d="M6 6l12 12" /><path d="M18 6L6 18" /></>,
  back: <><path d="M9 6h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-6-6z" /><path d="M11.5 9.5l5 5" /><path d="M16.5 9.5l-5 5" /></>,
  shield: <><path d="M12 3.5l7 2.8v5.2c0 4.3-3 7.6-7 9-4-1.4-7-4.7-7-9V6.3z" /><path d="M8.8 12l2.2 2.2 4.2-4.4" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></>,
  calendar: <><rect x="4" y="5.5" width="16" height="14.5" rx="2.5" /><path d="M4 10h16" /><path d="M8.5 3.5v4" /><path d="M15.5 3.5v4" /></>,
  keyboard: <><rect x="3" y="6" width="18" height="12" rx="2.5" /><path d="M7 10h.01M10 10h.01M13 10h.01M16 10h.01M7 14h10" /></>,
  edit: <><path d="M4.5 19.5l1-4.2L15.8 5a2 2 0 0 1 2.9 0l.3.3a2 2 0 0 1 0 2.9L8.7 18.5z" /><path d="M13.5 7.3l3.2 3.2" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>,
  zoomIn: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /><path d="M11 8.5v5M8.5 11h5" /></>,
  zoomOut: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /><path d="M8.5 11h5" /></>,
  chart: <><path d="M4 4v16h16" /><path d="M7.5 15l3.5-4.5 3 2.5 5-6.5" /></>,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r=".8" /></>,
  trash: <><path d="M4.5 7h15" /><path d="M9.5 7V5h5v2" /><path d="M6.5 7l1 12.5h9l1-12.5" /><path d="M10 11v5M14 11v5" /></>,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5" /><path d="M12 8h.01" /></>,
  play: <path d="M8 5.5v13l10.5-6.5z" />,
  layers: <><path d="M12 4l8.5 4.5L12 13 3.5 8.5z" /><path d="M3.5 12.5L12 17l8.5-4.5" /><path d="M3.5 16.5L12 21l8.5-4.5" /></>,
  filter: <path d="M4 5.5h16l-6.2 7.3v5.4l-3.6 1.8v-7.2z" />,
  checkAll: <><path d="M2.5 12.5l4 4L15 8" /><path d="M11 16l1 .5L21.5 7.5" /></>,
  clockAlt: <><circle cx="12" cy="12" r="8" /><path d="M12 7.5V12h4" /><path d="M3 5l2.5-2" /><path d="M21 5l-2.5-2" /></>,
} satisfies Record<string, React.ReactNode>;

export type IconName = keyof typeof P;

export default function Icon({ name, size = 22, stroke = 2, className }: { name: IconName; size?: number; stroke?: number; className?: string }) {
  return (
    <svg className={`ico${className ? ` ${className}` : ""}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {P[name]}
    </svg>
  );
}
