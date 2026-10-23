import { useEffect, useState } from "react";
import { api, ApiError, Tester, TesterList } from "@/api/client";
import Keypad, { applyKey } from "@/shared/Keypad";

/** MO-02 시험자 + PIN. 틀리면 남은 횟수, 5회면 잠김 — 문구는 서버가 준 그대로 (03 시나리오 B-2) */
export default function Login({ onDone }: { onDone: () => void }) {
  const [testers, setTesters] = useState<Tester[] | null>(null);
  const [who, setWho] = useState<Tester | null>(null);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<TesterList>("/testers").then((r) => setTesters((r.items ?? []).filter((t) => t.active !== false))).catch((e: ApiError) => setErr(e.message));
  }, []);

  const pick = (t: Tester) => {
    setWho(t);
    setPin("");
    setErr(t.locked ? "잠긴 시험자예요. 노트북 담당에게 잠금 해제를 요청하세요." : null);
    setLocked(!!t.locked);
  };

  const submit = async () => {
    if (!who || pin.length < 4 || busy) return;
    setBusy(true);
    try {
      await api("/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tester_id: who.id, pin }) });
      onDone();
    } catch (e) {
      const ae = e instanceof ApiError ? e : null;
      setErr(ae?.message ?? String(e));
      setLocked(ae?.code === "PIN_LOCKED");
      setPin("");
    } finally {
      setBusy(false);
    }
  };

  if (!who)
    return (
      <div className="m-screen">
        <header className="m-bar"><b>시험자 선택</b></header>
        <main className="m-body">
          {err && <div className="card err-box" role="alert">{err}</div>}
          {!testers && !err && <div className="card muted loading">불러오는 중…</div>}
          <div className="tester-list">
            {testers?.map((t) => (
              <button key={t.id} className="btn tester" onClick={() => pick(t)}>
                {t.name}{t.locked && <span className="badge err">잠김</span>}
              </button>
            ))}
          </div>
        </main>
      </div>
    );

  return (
    <div className="m-screen">
      <header className="m-bar">
        <button className="btn ghost" onClick={() => setWho(null)}>‹ 다른 사람</button>
        <b>{who.name}</b>
      </header>
      <main className="m-body pin-body">
        <div className="pin-dots" aria-label={`PIN ${pin.length}자리 입력됨`}>
          {Array.from({ length: Math.max(4, pin.length) }, (_, i) => <span key={i} className={i < pin.length ? "on" : ""} />)}
        </div>
        <div className="pin-msg" role="alert">{err ? <span className="err-text">{err}</span> : "PIN을 입력하세요"}</div>
        <Keypad disabled={locked || busy} onKey={(k) => setPin((p) => applyKey(p, k, 6))} />
        <button className="btn primary big" disabled={locked || busy || pin.length < 4} onClick={submit}>{busy ? "확인 중…" : "확인"}</button>
      </main>
    </div>
  );
}
