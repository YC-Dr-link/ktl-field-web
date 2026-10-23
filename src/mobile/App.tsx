/** 휴대폰 웹 (MO-01~06) 뼈대. 화면은 이슈마다 채운다 — MO-03 목록은 #2(목업)부터. */
export default function App() {
  return (
    <div className="m-screen">
      <header className="m-bar">
        <b>현장 사진</b>
        <span className="muted">시험자 선택 전</span>
      </header>
      <main className="m-body">
        <div className="card">
          <b>접수 건 목록 (MO-03)</b>
          <p className="muted">서버 연결 전입니다. 다음 작업에서 목록이 나와요.</p>
        </div>
      </main>
    </div>
  );
}
