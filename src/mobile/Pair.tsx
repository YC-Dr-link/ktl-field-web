import { useState } from "react";
import { api, ApiError, Client } from "@/api/client";

/** MO-01 단말 등록 (휴대폰마다 처음 한 번). 노트북 QR 링크(/pair?code=483920)로 들어오면 코드가 채워져 있다. */
export default function Pair({ initialCode, notice, onDone }: { initialCode: string; notice?: string | null; onDone: () => void }) {
  const [code, setCode] = useState(initialCode.replace(/\D/g, "").slice(0, 6));
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(notice ?? null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const ok = /^\d{6}$/.test(code) && name.trim().length > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ok || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await api<Client>("/clients/pair", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pair_code: code, device_name: name.trim() }) });
      setDone(true);
      setTimeout(onDone, 900);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : String(e));   // 만료 · 잘못된 코드는 서버 문구 그대로
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="m-screen">
      <header className="m-bar"><b>단말 등록</b></header>
      <form className="m-body" onSubmit={submit}>
        {done ? (
          <div className="card ok-box">✓ 등록되었습니다</div>
        ) : (
          <>
            <p className="m-lead">노트북 화면의 QR을 찍으면 코드가 채워져요. 이 휴대폰은 처음 한 번만 등록하면 돼요.</p>
            <label className="field">
              <span>등록 코드 (6자리)</span>
              <input className="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" />
            </label>
            <label className="field">
              <span>이 휴대폰 이름</span>
              <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="예: 현장폰-1" autoFocus={code.length === 6} />
            </label>
            {err && <div className="card err-box" role="alert">{err}</div>}
            <button className="btn primary big" disabled={!ok || busy}>{busy ? "등록 중…" : "등록"}</button>
            <p className="muted small">등록한 뒤 브라우저 메뉴에서 <b>홈 화면에 추가</b>하면 앱처럼 열 수 있어요.</p>
          </>
        )}
      </form>
    </div>
  );
}
