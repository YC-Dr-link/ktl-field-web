import { useEffect, useState } from "react";
import { api, ApiError, CaseList as CaseListRes, CaseSummary, CategoryList } from "@/api/client";

/** MO-03 접수 건 목록: 진행 중 건이 위, 완료 건은 아래 흐리게. 카드에 진행률 · 확인 필요 수 (03 시나리오 B-3) */
export default function CaseList() {
  const [items, setItems] = useState<CaseSummary[] | null>(null);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);

  const load = () => {
    setErr(null);
    setSlow(false);
    const t = setTimeout(() => setSlow(true), 3000);   // 3초 넘으면 무엇을 하는 중인지 문구 (03 공통 규칙)
    Promise.all([api<CaseListRes>("/cases"), api<CategoryList>("/categories")])
      .then(([c, cat]) => {
        setItems(c.items ?? []);
        setLabels(Object.fromEntries((cat.items ?? []).map((x) => [x.category ?? "", x.label ?? ""])));
      })
      .catch((e: ApiError) => setErr(e.message))
      .finally(() => clearTimeout(t));
  };
  useEffect(load, []);

  if (err)
    return (
      <div className="card err-box">
        <p>{err}</p>
        <button className="btn" onClick={load}>다시 시도</button>
      </div>
    );
  if (!items)
    return <div className="card muted loading">{slow ? "노트북 서버에서 접수 건을 받는 중이에요…" : "불러오는 중…"}</div>;
  if (!items.length) return <div className="card muted">아직 접수 건이 없어요. [+ 새 건]으로 시작하세요.</div>;

  const sorted = [...items].sort((a, b) => Number(a.status === "completed") - Number(b.status === "completed")
    || (b.updated_at ?? "").localeCompare(a.updated_at ?? ""));
  return (
    <ul className="case-list">
      {sorted.map((c) => {
        const done = c.status === "completed";
        const p = c.progress ?? {};
        return (
          <li key={c.id} className={`card case${done ? " done" : ""}`}>
            <div className="case-top">
              <b className="case-no">{c.receipt_no}</b>
              <span className="muted">{labels[c.category ?? ""] ?? c.category}</span>
              {done && <span className="badge ok">✓ 완료</span>}
            </div>
            {!done && (
              <div className="case-sub">
                기기 {c.unit_count}대 · 확정 {p.confirmed ?? 0}/{p.total ?? 0}
                {!!p.needs_check && <span className="badge check">⚠ 확인 필요 {p.needs_check}</span>}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
