import { CSSProperties, useEffect, useState } from "react";
import { Brand } from "@/shared/brand/Logo";
import Icon, { IconName } from "@/shared/Icon";
import Devices from "./Devices";
import ExportScreen from "./Export";
import Gas from "./Gas";
import Radon from "./Radon";
import Review from "./Review";

/** 노트북 관리 화면 (AD-01~05). AD-01 #8 · AD-02 #9 · AD-03 #10 · AD-04 · 05 #7 */
const SCREENS: readonly { id: string; label: string; icon: IconName; desc: string }[] = [
  { id: "AD-01", label: "접수 건 · 확인 필요", icon: "inbox", desc: "휴대폰에서 올라온 값 중 확인이 필요한 것을 노트북에서 정리해요." },
  { id: "AD-02", label: "가스 구간 선택", icon: "wave", desc: "GL240 로거 그래프에서 13개 항목의 안정 구간을 끌어서 골라요." },
  { id: "AD-03", label: "라돈 병합", icon: "merge", desc: "챔버 기준기와 시험품 파일을 맞춰 붙이고 지시오차 · 반복성을 미리 봐요." },
  { id: "AD-04", label: "내보내기", icon: "download", desc: "확정된 값만 CSV · TXT · Excel 파일로 내보내요." },
  { id: "AD-05", label: "단말 · 시험자 관리", icon: "devices", desc: "휴대폰 등록 · 해제, 시험자 PIN, 판독 설정을 관리해요." },
];

const today = new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });

export default function App() {
  const [cur, setCur] = useState<string>(() => (SCREENS.some((s) => `#${s.id}` === location.hash) ? location.hash.slice(1) : "AD-01"));
  // 다른 화면에서 location.hash = "#AD-02" 처럼 넘어올 수 있게
  useEffect(() => {
    const on = () => { const id = location.hash.slice(1); if (SCREENS.some((s) => s.id === id)) setCur(id); };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const screen = SCREENS.find((s) => s.id === cur)!;
  const idx = SCREENS.indexOf(screen);
  const open = (id: string) => {
    setCur(id);
    history.replaceState(null, "", `#${id}`);
  };
  return (
    <div className="a-shell">
      <nav className="a-nav">
        <div className="a-logo"><Brand title="현장 관리" size={42} /></div>
        <div className="a-nav-label">메뉴</div>
        <div className="a-nav-list" style={{ ["--idx" as string]: idx } as CSSProperties}>
          <i className="a-nav-ind" aria-hidden="true" />
          {SCREENS.map((s) => (
            <button key={s.id} className={s.id === cur ? "on" : ""} onClick={() => open(s.id)} aria-current={s.id === cur ? "page" : undefined}>
              <Icon name={s.icon} size={20} />
              <span className="lbl">{s.label}</span>
              <span className="id">{s.id}</span>
            </button>
          ))}
        </div>
        <div className="a-nav-foot">
          <Icon name="shield" size={18} />
          <span>현장 오프라인 모드<br /><small>인터넷 없이 노트북 안에서만 동작</small></span>
        </div>
      </nav>
      <main className="a-main">
        <header className="a-top">
          <div>
            <div className="a-crumb">현장 관리 <Icon name="right" size={14} /> {screen.id}</div>
            <h1 key={cur} className="enter"><span className="a-h1-ico"><Icon name={screen.icon} size={22} /></span>{screen.label}</h1>
            <p className="a-desc">{screen.desc}</p>
          </div>
          <div className="a-top-right">
            <span className="a-chip"><Icon name="devices" size={16} />이 노트북 로컬 서버</span>
            <span className="a-chip"><Icon name="clock" size={16} />{today}</span>
          </div>
        </header>
        <div key={cur} className="a-content enter">
          {cur === "AD-01" ? <Review /> : cur === "AD-02" ? <Gas /> : cur === "AD-03" ? <Radon /> : cur === "AD-04" ? <ExportScreen /> : <Devices />}
        </div>
      </main>
    </div>
  );
}
