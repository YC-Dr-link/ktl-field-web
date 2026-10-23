import { useCallback, useEffect, useState } from "react";
import { api, ApiError, Client, Schemas, Tester, TesterList } from "@/api/client";

type PairCode = { code?: string; expires_at?: string; qr_svg?: string };
type Settings = Schemas["Settings"];
const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const json = (method: string, body?: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

/** AD-05 단말 · 시험자 관리 (03 시나리오 B-9, REQ-B2-08) */
export default function Devices() {
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);
  const say = (text: string, err = false) => setMsg({ text, err });
  return (
    <div className="a-stack">
      {msg && <div className={`card ${msg.err ? "err-box" : "ok-line"}`} role="status">{msg.text}</div>}
      <PairCodeCard onError={(m) => say(m, true)} />
      <ClientsCard say={say} />
      <TestersCard say={say} />
      <SettingsCard say={say} />
    </div>
  );
}

function PairCodeCard({ onError }: { onError: (m: string) => void }) {
  const [pc, setPc] = useState<PairCode | null>(null);
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!pc?.expires_at) return;
    const tick = () => setLeft(Math.max(0, Math.round((new Date(pc.expires_at!).getTime() - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [pc]);
  const issue = () => api<PairCode>("/pair-codes", json("POST")).then(setPc).catch((e: ApiError) => onError(e.message));
  const expired = !!pc && left === 0;
  return (
    <section className="card">
      <div className="a-head"><h2>단말 등록 코드</h2><button className="btn primary" onClick={issue}>{pc ? "새 코드 발급" : "등록 코드 발급"}</button></div>
      {!pc && <p className="muted">휴대폰을 새로 쓸 때 발급하세요. 휴대폰 카메라로 QR을 찍으면 등록 화면이 열려요. 코드는 5분 동안만 쓸 수 있어요.</p>}
      {pc && (
        <div className={`pair${expired ? " expired" : ""}`}>
          {/* 서버(이 노트북)가 만든 QR SVG — 외부 내용 아님 */}
          <div className="pair-qr" dangerouslySetInnerHTML={{ __html: pc.qr_svg ?? "" }} aria-label="등록 QR" />
          <div>
            <div className="pair-code">{pc.code?.replace(/(\d{3})(\d{3})/, "$1 $2")}</div>
            <div className={expired ? "err-text" : "muted"}>{expired ? "만료됐어요. 새 코드를 발급하세요." : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")} 뒤 만료`}</div>
          </div>
        </div>
      )}
    </section>
  );
}

function ClientsCard({ say }: { say: (t: string, e?: boolean) => void }) {
  const [items, setItems] = useState<Client[] | null>(null);
  const [ask, setAsk] = useState<string | null>(null);
  const load = useCallback(() => api<{ items?: Client[] }>("/clients").then((r) => setItems(r.items ?? [])).catch((e: ApiError) => say(e.message, true)), [say]);
  useEffect(() => { load(); }, [load]);
  const revoke = async (c: Client) => {
    try {
      await api(`/clients/${encodeURIComponent(c.client_id ?? "")}`, json("DELETE"));
      say(`${c.device_name} 해제했어요. 이 휴대폰은 다시 등록해야 써요.`);
      setAsk(null);
      load();
    } catch (e) {
      say((e as ApiError).message, true);
    }
  };
  return (
    <section className="card">
      <div className="a-head"><h2>등록된 단말</h2><span className="muted">분실한 휴대폰은 바로 해제하세요</span></div>
      <table className="a-table">
        <thead><tr><th>이름</th><th>등록</th><th>마지막 접속</th><th /></tr></thead>
        <tbody>
          {items?.map((c) => (
            <tr key={c.client_id}>
              <td><b>{c.device_name}</b></td><td>{fmt(c.paired_at)}</td><td>{fmt(c.last_seen_at)}</td>
              <td className="right">
                {ask === c.client_id
                  ? <><button className="btn danger" onClick={() => revoke(c)}>해제 확인</button> <button className="btn" onClick={() => setAsk(null)}>취소</button></>
                  : <button className="btn" onClick={() => setAsk(c.client_id ?? null)}>해제</button>}
              </td>
            </tr>
          ))}
          {items && !items.length && <tr><td colSpan={4} className="muted">등록된 단말이 없어요</td></tr>}
        </tbody>
      </table>
    </section>
  );
}

function TestersCard({ say }: { say: (t: string, e?: boolean) => void }) {
  const [items, setItems] = useState<Tester[] | null>(null);
  const [pinFor, setPinFor] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const load = useCallback(() => api<TesterList>("/testers").then((r) => setItems(r.items ?? [])).catch((e: ApiError) => say(e.message, true)), [say]);
  useEffect(() => { load(); }, [load]);
  const patch = async (t: Tester, body: object, done: string) => {
    try {
      await api(`/testers/${encodeURIComponent(t.id ?? "")}`, json("PATCH", body));
      say(done);
      setPinFor(null);
      setPin("");
      load();
    } catch (e) {
      say((e as ApiError).message, true);
    }
  };
  const add = async () => {
    try {
      await api("/testers", json("POST", { name: name.trim(), pin }));
      say(`${name.trim()} 추가했어요.`);
      setAdding(false);
      setName("");
      setPin("");
      load();
    } catch (e) {
      say((e as ApiError).message, true);
    }
  };
  const pinOk = /^\d{4,6}$/.test(pin);
  return (
    <section className="card">
      <div className="a-head"><h2>시험자</h2>{!adding && <button className="btn" onClick={() => { setAdding(true); setPinFor(null); setPin(""); }}>＋ 추가</button>}</div>
      {adding && (
        <div className="a-inline">
          <input placeholder="이름 (예: 시험자D)" value={name} onChange={(e) => setName(e.target.value)} />
          <input placeholder="PIN 4~6자리" inputMode="numeric" value={pin} maxLength={6} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
          <button className="btn primary" disabled={!name.trim() || !pinOk} onClick={add}>추가</button>
          <button className="btn" onClick={() => setAdding(false)}>취소</button>
        </div>
      )}
      <table className="a-table">
        <thead><tr><th>이름</th><th>상태</th><th /></tr></thead>
        <tbody>
          {items?.map((t) => (
            <tr key={t.id} className={t.active === false ? "dim" : ""}>
              <td><b>{t.name}</b></td>
              <td>{t.active === false ? <span className="badge">비활성</span> : t.locked ? <span className="badge err">잠김</span> : <span className="badge ok">사용 중</span>}</td>
              <td className="right">
                {pinFor === t.id ? (
                  <span className="a-inline">
                    <input placeholder="새 PIN 4~6자리" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} autoFocus />
                    <button className="btn primary" disabled={!pinOk} onClick={() => patch(t, { pin }, `${t.name} PIN을 바꿨어요.`)}>저장</button>
                    <button className="btn" onClick={() => setPinFor(null)}>취소</button>
                  </span>
                ) : (
                  <>
                    {t.locked && <button className="btn" onClick={() => patch(t, { unlock: true }, `${t.name} 잠금을 풀었어요.`)}>잠금 해제</button>}{" "}
                    <button className="btn" onClick={() => { setPinFor(t.id ?? null); setPin(""); setAdding(false); }}>PIN 재설정</button>{" "}
                    <button className="btn" onClick={() => patch(t, { active: t.active === false }, t.active === false ? `${t.name} 다시 쓸 수 있어요.` : `${t.name} 비활성 — 휴대폰 목록에서 빠져요.`)}>{t.active === false ? "활성" : "비활성"}</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function SettingsCard({ say }: { say: (t: string, e?: boolean) => void }) {
  const [s, setS] = useState<Settings | null>(null);
  useEffect(() => { api<Settings>("/settings").then(setS).catch((e: ApiError) => say(e.message, true)); }, [say]);
  if (!s) return null;
  const save = () => api<Settings>("/settings", json("PUT", s)).then((r) => { setS(r); say("설정을 저장했어요."); }).catch((e: ApiError) => say(e.message, true));
  return (
    <section className="card">
      <div className="a-head"><h2>설정</h2><button className="btn primary" onClick={save}>저장</button></div>
      <div className="a-form">
        <label>출력 인코딩
          <select value={s.export_encoding} onChange={(e) => setS({ ...s, export_encoding: e.target.value as Settings["export_encoding"] })}>
            <option value="cp949">cp949 (엑셀 기본)</option><option value="utf-8">UTF-8</option>
          </select>
        </label>
        <label>확인 필요 기준 (신뢰도 미만이면 노랑)
          <input type="number" min={0.5} max={0.99} step={0.05} value={s.confidence_threshold ?? 0.8} onChange={(e) => setS({ ...s, confidence_threshold: Number(e.target.value) })} />
        </label>
        <label>사진 보관 기간 (일, 비우면 자동 삭제 안 함)
          <input type="number" min={1} value={s.photo_retention_days ?? ""} placeholder="자동 삭제 안 함" onChange={(e) => setS({ ...s, photo_retention_days: e.target.value ? Number(e.target.value) : null })} />
        </label>
      </div>
    </section>
  );
}
