import { useEffect, useState } from "react";
import { api, ApiError, Case } from "@/api/client";

type ItemStatus = NonNullable<NonNullable<NonNullable<Case["units"]>[number]["items"]>[number]["status"]>;
const STATUS: Record<ItemStatus, [string, string]> = {
  empty: ["", "촬영 전"], queued: ["", "보내는 중"], reading: ["", "읽는 중…"], done: ["", "읽음"],
  needs_check: ["check", "⚠ 확인 필요"], confirmed: ["ok", "✓ 확정"], failed: ["err", "읽지 못함"],
};

/** 접수 건 — 기기별 촬영 항목. 촬영 · 업로드 · 실시간 상태(MO-05)는 #5에서 이 화면에 붙인다. */
export default function CaseView({ id }: { id: string }) {
  const [c, setC] = useState<Case | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [unit, setUnit] = useState(1);

  useEffect(() => {
    api<Case>(`/cases/${encodeURIComponent(id)}`).then(setC).catch((e: ApiError) => setErr(e.message));
  }, [id]);

  const units = c?.units ?? [];
  const cur = units.find((u) => u.index === unit) ?? units[0];
  return (
    <div className="m-screen">
      <header className="m-bar">
        <button className="btn ghost" onClick={() => history.back()}>‹</button>
        <b>{c?.receipt_no ?? "…"}{units.length > 0 && ` · 기기 ${cur?.index}/${units.length}`}</b>
        <span className="unit-nav">
          <button className="btn ghost" disabled={unit <= 1} onClick={() => setUnit((u) => u - 1)} aria-label="앞 기기">◂</button>
          <button className="btn ghost" disabled={unit >= units.length} onClick={() => setUnit((u) => u + 1)} aria-label="다음 기기">▸</button>
        </span>
      </header>
      <main className="m-body">
        {err && <div className="card err-box" role="alert">{err}</div>}
        {!c && !err && <div className="card muted loading">불러오는 중…</div>}
        <ul className="check-list">
          {cur?.items?.map((it) => {
            const [tone, label] = STATUS[it.status ?? "empty"];
            return (
              <li key={it.key} className="card check-item">
                <span className={`dot${it.status && it.status !== "empty" ? " on" : ""}`} aria-hidden />
                <span className="grow">{it.label}{it.required && <span className="req" aria-label="필수">*</span>}</span>
                <span className={`badge ${tone}`}>{label}</span>
              </li>
            );
          })}
        </ul>
        {c && <p className="muted small">촬영은 다음 작업(MO-05)에서 연결돼요.</p>}
      </main>
    </div>
  );
}
