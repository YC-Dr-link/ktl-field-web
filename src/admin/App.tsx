import { CSSProperties, useState } from "react";
import { Brand } from "@/shared/brand/Logo";
import Icon, { IconName } from "@/shared/Icon";
import { EmptyArt } from "@/shared/motion";
import Devices from "./Devices";
import ExportScreen from "./Export";

/** 노트북 관리 화면 (AD-01~05). AD-04 · AD-05는 #7, AD-01은 #8, AD-02 · 03(S)은 #9 · #10에서. */
const SCREENS: readonly { id: string; label: string; icon: IconName; desc: string }[] = [
  { id: "AD-01", label: "접수 건 · 확인 필요", icon: "inbox", desc: "휴대폰에서 올라온 값 중 확인이 필요한 것을 노트북에서 정리해요." },
  { id: "AD-02", label: "가스 구간 선택", icon: "wave", desc: "가스 측정 기록에서 쓸 구간을 골라요." },
  { id: "AD-03", label: "라돈 병합", icon: "merge", desc: "라돈 측정 결과를 접수 건과 합쳐요." },
  { id: "AD-04", label: "내보내기", icon: "download", desc: "확정된 값만 CSV · TXT · Excel 파일로 내보내요." },
  { id: "AD-05", label: "단말 · 시험자 관리", icon: "devices", desc: "휴대폰 등록 · 해제, 시험자 PIN, 판독 설정을 관리해요." },
];

const today = new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });

export default function App() {
  const [cur, setCur] = useState<string>(() => (SCREENS.some((s) => `#${s.id}` === location.hash) ? location.hash.slice(1) : "AD-04"));
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
          {cur === "AD-04" ? <ExportScreen /> : cur === "AD-05" ? <Devices /> : (
            <section className="card a-empty">
              <EmptyArt kind="build" />
              <span className="badge brand"><Icon name="sparkle" size={14} />준비 중</span>
              <h2>{screen.label}</h2>
              <p className="muted">{screen.id} 화면은 다음 작업에서 채워요. 지금은 <b>내보내기</b>와 <b>단말 · 시험자 관리</b>를 쓸 수 있어요.</p>
              <div className="a-actions">
                <button className="btn" onClick={() => open("AD-04")}><Icon name="download" size={18} />내보내기</button>
                <button className="btn" onClick={() => open("AD-05")}><Icon name="devices" size={18} />단말 · 시험자 관리</button>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
