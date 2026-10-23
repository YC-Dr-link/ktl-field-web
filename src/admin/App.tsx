import { useState } from "react";

/** 노트북 관리 화면 (AD-01~05) 뼈대. 각 화면은 이슈마다 채운다. */
const SCREENS = [
  { id: "AD-01", label: "접수 건 · 확인 필요" },
  { id: "AD-02", label: "가스 구간 선택" },
  { id: "AD-03", label: "라돈 병합" },
  { id: "AD-04", label: "내보내기" },
  { id: "AD-05", label: "단말 · 시험자 관리" },
] as const;

export default function App() {
  const [cur, setCur] = useState<string>(SCREENS[0].id);
  const screen = SCREENS.find((s) => s.id === cur)!;
  return (
    <div className="a-shell">
      <nav className="a-nav">
        <b className="a-logo">현장 관리</b>
        {SCREENS.map((s) => (
          <button key={s.id} className={s.id === cur ? "on" : ""} onClick={() => setCur(s.id)}>
            <span className="muted">{s.id}</span> {s.label}
          </button>
        ))}
      </nav>
      <main className="a-main">
        <h1>{screen.label}</h1>
        <div className="card muted">{screen.id} 화면은 다음 작업에서 채워요.</div>
      </main>
    </div>
  );
}
