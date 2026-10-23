import { useState } from "react";
import Devices from "./Devices";
import ExportScreen from "./Export";

/** 노트북 관리 화면 (AD-01~05). AD-04 · AD-05는 #7, AD-01은 #8, AD-02 · 03(S)은 #9 · #10에서. */
const SCREENS = [
  { id: "AD-01", label: "접수 건 · 확인 필요" },
  { id: "AD-02", label: "가스 구간 선택" },
  { id: "AD-03", label: "라돈 병합" },
  { id: "AD-04", label: "내보내기" },
  { id: "AD-05", label: "단말 · 시험자 관리" },
] as const;

export default function App() {
  const [cur, setCur] = useState<string>(() => (SCREENS.some((s) => `#${s.id}` === location.hash) ? location.hash.slice(1) : "AD-04"));
  const screen = SCREENS.find((s) => s.id === cur)!;
  const open = (id: string) => {
    setCur(id);
    history.replaceState(null, "", `#${id}`);
  };
  return (
    <div className="a-shell">
      <nav className="a-nav">
        <b className="a-logo">현장 관리</b>
        {SCREENS.map((s) => (
          <button key={s.id} className={s.id === cur ? "on" : ""} onClick={() => open(s.id)}>
            <span className="muted">{s.id}</span> {s.label}
          </button>
        ))}
      </nav>
      <main className="a-main">
        <h1>{screen.label}</h1>
        {cur === "AD-04" ? <ExportScreen /> : cur === "AD-05" ? <Devices /> : <div className="card muted">{screen.id} 화면은 다음 작업에서 채워요.</div>}
      </main>
    </div>
  );
}
