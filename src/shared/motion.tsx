/**
 * 꾸밈 · 움직임 공통 조각. 애니메이션은 transform · opacity만 (값싼 휴대폰에서도 부드럽게, blur 필터 금지).
 * 동작 줄이기 설정(prefers-reduced-motion)이면 base.css에서 전부 끈다.
 */
import type { CSSProperties } from "react";

/** 목록 줄이 30ms씩 늦게 들어오게: style={stagger(i)} */
export const stagger = (i: number): CSSProperties => ({ ["--i" as string]: Math.min(i, 12) });

/** 화면 뒤 배경: 옅은 점 격자 + 천천히 떠다니는 빛 + 아래 눈금자 */
export function Backdrop() {
  return (
    <div className="backdrop" aria-hidden="true">
      <div className="grid" />
      <div className="glow g1" />
      <div className="glow g2" />
      <div className="glow g3" />
      <div className="ticks" />
    </div>
  );
}

/** 확정 · 완료 표시: 원과 체크가 그려진다 */
export function CheckDraw({ size = 72, className }: { size?: number; className?: string }) {
  return (
    <svg className={`check-draw${className ? ` ${className}` : ""}`} width={size} height={size} viewBox="0 0 52 52" aria-hidden="true">
      <circle className="cd-ring" cx="26" cy="26" r="23" />
      <path className="cd-tick" d="M15 27l7.5 7.5L38 19" />
    </svg>
  );
}

/** 불러오는 동안 자리 표시 (반짝이는 빈 카드) */
export function Skeleton({ rows = 3, label }: { rows?: number; label?: string }) {
  return (
    <div className="skeleton-list" role="status" aria-live="polite">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="card skeleton" style={stagger(i)}>
          <span className="sk sk-ico" />
          <span className="sk-lines"><span className="sk sk-1" /><span className="sk sk-2" /></span>
        </div>
      ))}
      {label && <p className="skeleton-label">{label}</p>}
    </div>
  );
}

/** 빈 화면 그림 (선 그림 · 브랜드 색) */
export function EmptyArt({ kind = "box" }: { kind?: "box" | "build" | "table" | "phone" }) {
  return (
    <svg className="empty-art" width="168" height="120" viewBox="0 0 168 120" aria-hidden="true">
      <ellipse cx="84" cy="108" rx="58" ry="7" className="ea-shadow" />
      <rect x="28" y="18" width="112" height="80" rx="16" className="ea-card" />
      <rect x="28" y="18" width="112" height="22" rx="16" className="ea-head" />
      <rect x="28" y="30" width="112" height="10" className="ea-head" />
      <circle cx="42" cy="29" r="3" className="ea-dot" /><circle cx="52" cy="29" r="3" className="ea-dot" /><circle cx="62" cy="29" r="3" className="ea-dot r" />
      {kind === "table" && (
        <g className="ea-line">
          <path d="M40 54h88M40 66h88M40 78h88" /><path d="M68 48v38M100 48v38" />
        </g>
      )}
      {kind === "build" && (
        <g>
          <path className="ea-arc" d="M58 82a26 26 0 0 1 52 0" />
          <path className="ea-arc on" d="M58 82a26 26 0 0 1 40-22" />
          <path className="ea-needle" d="M84 82 L101 61 L88 85 Z" />
          <circle cx="84" cy="82" r="4.5" className="ea-hub" />
        </g>
      )}
      {kind === "box" && (
        <g className="ea-line">
          <path d="M56 58l28-10 28 10-28 10z" /><path d="M56 58v18l28 10 28-10V58" /><path d="M84 68v18" />
        </g>
      )}
      {kind === "phone" && (
        <g className="ea-line">
          <rect x="70" y="48" width="28" height="44" rx="5" /><path d="M80 86h8" />
        </g>
      )}
      <path className="ea-spark" d="M146 20l2.4 6.2 6.2 2.4-6.2 2.4-2.4 6.2-2.4-6.2-6.2-2.4 6.2-2.4z" />
    </svg>
  );
}
