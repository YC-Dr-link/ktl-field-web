import { useEffect, useState } from "react";
import { api, ApiError, CaseList as CaseListRes, CaseSummary, CategoryList } from "@/api/client";
import Icon, { IconName } from "@/shared/Icon";
import { EmptyArt, Skeleton, stagger } from "@/shared/motion";
import { go } from "./router";

/** 분류별 그림 (모양만 — 모르는 분류는 문서 아이콘) */
export const CAT_ICON: Record<string, IconName> = { sampling: "flow", dust: "dust", gas: "gas", radon: "radon" };

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
      <div className="card err-box" role="alert">
        <div className="err-row"><Icon name="wifiOff" /><p>{err}</p></div>
        <button className="btn" onClick={load}><Icon name="refresh" size={18} />다시 시도</button>
      </div>
    );
  if (!items)
    return <Skeleton rows={3} label={slow ? "노트북 서버에서 접수 건을 받는 중이에요…" : undefined} />;
  if (!items.length)
    return (
      <div className="card empty enter">
        <EmptyArt kind="box" />
        <b>아직 접수 건이 없어요</b>
        <span className="muted">[새 건]으로 시작하세요.</span>
      </div>
    );

  const sorted = [...items].sort((a, b) => Number(a.status === "completed") - Number(b.status === "completed")
    || (b.updated_at ?? "").localeCompare(a.updated_at ?? ""));
  const open = items.filter((c) => c.status !== "completed");
  const needs = open.reduce((n, c) => n + (c.progress?.needs_check ?? 0), 0);
  return (
    <>
      <div className="stats stagger">
        <div className="stat" style={stagger(0)}><b>{open.length}</b><span>진행 중</span></div>
        <div className={`stat${needs ? " warn" : ""}`} style={stagger(1)}><b>{needs}</b><span>확인 필요</span></div>
        <div className="stat good" style={stagger(2)}><b>{items.length - open.length}</b><span>완료</span></div>
      </div>
      <div className="section-label">최근 접수 건</div>
      <ul className="case-list stagger">
        {sorted.map((c, i) => {
          const done = c.status === "completed";
          const p = c.progress ?? {};
          const pct = p.total ? Math.round(((p.confirmed ?? 0) / p.total) * 100) : 0;
          return (
            <li key={c.id} className={`card case${done ? " done" : ""}`} role="button" tabIndex={0} style={stagger(i + 3)}
              onClick={() => go(`/cases/${encodeURIComponent(c.id ?? "")}`)} onKeyDown={(e) => e.key === "Enter" && go(`/cases/${encodeURIComponent(c.id ?? "")}`)}>
              <span className="ico-tile">{done ? <Icon name="check" size={24} stroke={2.6} /> : <Icon name={CAT_ICON[c.category ?? ""] ?? "file"} size={24} />}</span>
              <div className="case-main">
                <b className="case-no">{c.receipt_no}</b>
                <div className="case-sub">
                  <span>{labels[c.category ?? ""] ?? c.category}</span>·<span>기기 {c.unit_count}대</span>
                  {done && <span className="badge ok"><Icon name="check" size={13} stroke={3} />완료</span>}
                </div>
              </div>
              <Icon name="right" className="go" />
              {!done && (
                <div className="case-progress">
                  <span className="bar" aria-hidden="true"><i style={{ transform: `scaleX(${pct / 100})` }} /></span>
                  <span className="num">확정 {p.confirmed ?? 0}/{p.total ?? 0}</span>
                  {!!p.needs_check && <span className="badge check"><Icon name="alert" size={13} stroke={2.4} />확인 필요 {p.needs_check}</span>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
