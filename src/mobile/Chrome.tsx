/** 휴대폰 화면 틀: 브랜드 띠(첫 화면들) · 작은 상단 막대(안쪽 화면들). 모양만 담당한다. */
import type { ReactNode } from "react";
import { Brand } from "@/shared/brand/Logo";
import Icon from "@/shared/Icon";

export const APP_TITLE = "현장 사진";

/** 파란 그라데이션 띠 + 로고. 아래 children은 띠 안의 두 번째 줄 */
export function Hero({ right, children }: { right?: ReactNode; children?: ReactNode }) {
  return (
    <header className="m-hero">
      <i className="hero-glow" aria-hidden="true" />
      <div className="m-hero-row">
        <Brand title={APP_TITLE} size={42} />
        {right}
      </div>
      {children && <div className="m-hero-body">{children}</div>}
    </header>
  );
}

/** 안쪽 화면 상단 막대: [‹ 뒤로] 제목 / 부제 [오른쪽] */
export function TopBar({ onBack, backLabel, backAria, title, sub, right }: {
  onBack: () => void; backLabel?: string; backAria?: string; title: ReactNode; sub?: ReactNode; right?: ReactNode;
}) {
  return (
    <header className="m-bar">
      <button type="button" className={`bar-back${backLabel ? " wide" : ""}`} onClick={onBack} aria-label={backAria}>
        <Icon name="left" size={22} stroke={2.4} />{backLabel && <span>{backLabel}</span>}
      </button>
      <div className="bar-title">
        <b>{title}</b>
        {sub && <span>{sub}</span>}
      </div>
      <div className="bar-right">{right}</div>
    </header>
  );
}
