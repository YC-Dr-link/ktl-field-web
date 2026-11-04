import { useEffect, useState } from "react";
import { api, ApiError, Tester, TesterList } from "@/api/client";
import Keypad, { applyKey } from "@/shared/Keypad";
import Icon from "@/shared/Icon";
import { Skeleton, stagger } from "@/shared/motion";
import { Hero, TopBar } from "./Chrome";

/** MO-02 시험자 + PIN. 틀리면 남은 횟수, 5회면 잠김 — 문구는 서버가 준 그대로 (03 시나리오 B-2) */
export default function Login({ onDone }: { onDone: () => void }) {
  const [testers, setTesters] = useState<Tester[] | null>(null);
  const [who, setWho] = useState<Tester | null>(null);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);   // 틀릴 때마다 점이 흔들리게 (모양만)

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
      setShake((n) => n + 1);
    } finally {
      setBusy(false);
    }
  };

  if (!who)
    return (
      <div className="m-screen">
        <Hero>
          <h2>시험자 선택</h2>
          <p>본인 이름을 누르고 PIN을 입력하세요</p>
        </Hero>
        <main className="m-body">
          {err && <div className="card err-box" role="alert"><div className="err-row"><Icon name="alert" />{err}</div></div>}
          {!testers && !err && <Skeleton rows={3} />}
          <div className="tester-list stagger">
            {testers?.map((t, i) => (
              <button key={t.id} className={`tester${t.locked ? " locked" : ""}`} style={stagger(i)} onClick={() => pick(t)}>
                <span className="avatar">{t.locked ? <Icon name="lock" size={20} /> : <Icon name="user" size={22} />}</span>
                <span className="name">{t.name}</span>
                {t.locked ? <span className="badge err"><Icon name="lock" size={14} />잠김</span> : <Icon name="right" className="go" />}
              </button>
            ))}
          </div>
        </main>
      </div>
    );

  return (
    <div className="m-screen">
      <TopBar onBack={() => setWho(null)} backLabel="다른 사람" title={who.name} sub="PIN 확인" />
      <main className="m-body pin-body">
        <div className="pin-head">
          <span className="avatar lg"><Icon name={locked ? "lock" : "user"} size={32} /></span>
          <b>{who.name}</b>
        </div>
        <div key={shake} className={`pin-dots${shake ? " shake" : ""}${err ? " err" : ""}`} aria-label={`PIN ${pin.length}자리 입력됨`}>
          {Array.from({ length: Math.max(4, pin.length) }, (_, i) => <span key={i} className={i < pin.length ? "on" : ""} />)}
        </div>
        <div className="pin-msg" role="alert">{err ? <span className="err-text">{err}</span> : "PIN을 입력하세요"}</div>
        <Keypad disabled={locked || busy} onKey={(k) => setPin((p) => applyKey(p, k, 6))} />
        <button className="btn primary big" disabled={locked || busy || pin.length < 4} onClick={submit}>{busy ? "확인 중…" : "확인"}</button>
      </main>
    </div>
  );
}
