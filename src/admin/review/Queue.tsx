import { useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "@/api/client";
import Icon from "@/shared/Icon";
import { CheckDraw, Skeleton, stagger } from "@/shared/motion";
import type { QGroup } from "../Review";
import { json } from "../ui";
import PhotoPanel, { confPct, Crop } from "./PhotoPanel";

/**
 * 확인 필요 모아 보기: 왼쪽 사진 조각 목록(선택 · 일괄 확정) + 오른쪽 크게 보고 맞음 · 수정 · 재촬영 요청.
 * 단축키 ↑↓(J/K) 이동 · Y 맞음 · E 고치기 · R 재촬영 · 스페이스 선택 · Z 확대
 */
export default function Queue({ groups, loading, label, caseFilter, setCaseFilter, reload, toast }: {
  groups: QGroup[]; loading: boolean; label: (caseId: string, key: string) => string;
  caseFilter: string; setCaseFilter: (id: string) => void; reload: () => void; toast: (t: string, k?: "ok" | "err" | "info") => void;
}) {
  const [sel, setSel] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  // TODO(확인 필요): "재촬영 요청"은 API 명세(02)에 없다 — 지금은 이 화면에서만 표시. B-1(여준)과 경로 · 휴대폰 표시 방법 맞추기
  const [retake, setRetake] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);
  const [leaving, setLeaving] = useState<string | null>(null);
  const lastIdx = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);

  const list = useMemo(() => {
    const l = groups.filter((g) => !caseFilter || g.case_id === caseFilter);
    // 재촬영 요청한 것은 맨 뒤로
    return [...l.filter((g) => !retake.has(g.photo_id)), ...l.filter((g) => retake.has(g.photo_id))];
  }, [groups, caseFilter, retake]);

  // 고른 것이 목록에서 사라지면(확정됨) 같은 자리의 다음 것을 고른다
  useEffect(() => {
    if (sel && list.some((g) => g.photo_id === sel)) {
      lastIdx.current = list.findIndex((g) => g.photo_id === sel);
      return;
    }
    setSel(list[Math.min(lastIdx.current, list.length - 1)]?.photo_id ?? null);
  }, [list, sel]);

  const move = (d: number) => {
    const i = list.findIndex((g) => g.photo_id === sel);
    const next = list[Math.max(0, Math.min(list.length - 1, i + d))];
    if (next) {
      setSel(next.photo_id);
      listRef.current?.querySelector<HTMLElement>(`[data-id="${next.photo_id}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  };
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "SELECT" || e.ctrlKey || e.metaKey) return;
      if (e.key === "ArrowDown" || e.key === "j") { e.preventDefault(); move(1); }
      else if (e.key === "ArrowUp" || e.key === "k") { e.preventDefault(); move(-1); }
      else if (e.key === " " && sel) { e.preventDefault(); toggle(sel); }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  });

  const toggle = (id: string) => setChecked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const visibleChecked = list.filter((g) => checked.has(g.photo_id));
  const allOn = list.length > 0 && visibleChecked.length === list.length;

  const confirmMany = async () => {
    const todo = visibleChecked;
    setBulk({ done: 0, total: todo.length });
    let ok = 0;
    for (const g of todo) {
      try {
        await api(`/photos/${encodeURIComponent(g.photo_id)}/values`, json("PATCH", { values: g.values.map((v) => ({ key: v.key, value: v.value })), confirm: true }));
        ok++;
      } catch (e) {
        toast(`${g.receipt_no} ${label(g.case_id, g.item_key)}: ${(e as ApiError).message}`, "err");
      }
      setBulk({ done: ok, total: todo.length });
    }
    setChecked(new Set());
    setBulk(null);
    toast(`${ok}장을 읽은 값 그대로 확정했어요`);
    reload();
  };

  const cur = list.find((g) => g.photo_id === sel) ?? null;
  const caseOpts = [...new Map(groups.map((g) => [g.case_id, g.receipt_no])).entries()];

  if (loading) return <Skeleton rows={4} label="확인 필요 값을 모으는 중…" />;

  if (!groups.length) {
    return (
      <section className="card a-empty rv-clear">
        <CheckDraw size={84} />
        <h2>확인 필요 값이 없어요</h2>
        <p className="muted">휴대폰에서 올라온 값 중 신뢰도가 낮은 것은 여기에 모여요. 지금은 모두 처리했어요. 남은 일은 <b>건 완료</b>와 <b>내보내기</b>예요.</p>
      </section>
    );
  }

  return (
    <div className="rv-split q">
      <section className="card rv-list-card">
        <div className="rv-qhead">
          <label className="rv-check" title="모두 선택">
            <input type="checkbox" checked={allOn} onChange={() => setChecked(allOn ? new Set() : new Set(list.map((g) => g.photo_id)))} />
          </label>
          <select className="rv-select" value={caseFilter} onChange={(e) => setCaseFilter(e.target.value)} aria-label="접수 건으로 거르기">
            <option value="">모든 건 · 사진 {groups.length}장</option>
            {caseOpts.map(([id, no]) => <option key={id} value={id}>{no} · {groups.filter((g) => g.case_id === id).length}장</option>)}
          </select>
        </div>
        {visibleChecked.length > 0 && (
          <div className="rv-bulk enter">
            <span><b>{visibleChecked.length}장</b> 선택</span>
            <button className="btn primary ok" disabled={!!bulk} onClick={confirmMany}>
              <Icon name="checkAll" size={18} />{bulk ? `확정 중 ${bulk.done}/${bulk.total}` : "읽은 값 그대로 확정"}
            </button>
          </div>
        )}
        <div className="rv-qlist" ref={listRef} role="listbox" aria-label="확인 필요 사진">
          {list.map((g, i) => {
            const v = g.values[0];
            const on = g.photo_id === sel;
            const rt = retake.has(g.photo_id);
            return (
              <div key={g.photo_id} data-id={g.photo_id} role="option" aria-selected={on} tabIndex={-1} style={stagger(i)}
                className={`rv-qitem${on ? " on" : ""}${rt ? " rt" : ""}${leaving === g.photo_id ? " leaving" : ""}`} onClick={() => setSel(g.photo_id)}>
                <label className="rv-check" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={checked.has(g.photo_id)} onChange={() => toggle(g.photo_id)} aria-label="선택" />
                </label>
                <Crop photoId={g.photo_id} bbox={v.bbox} />
                <span className="rv-qtext">
                  <span className="rv-qtitle">{label(g.case_id, g.item_key)} <span className="muted">· 기기 {g.unit_index}</span></span>
                  <span className="rv-qno">{g.receipt_no}</span>
                  <span className="rv-qval"><b>{v.value}</b>{v.unit && <small>{v.unit}</small>}{g.values.length > 1 && <span className="badge">+{g.values.length - 1}</span>}</span>
                  <span className="rv-qconf">
                    <span className="rv-bar"><i style={{ transform: `scaleX(${v.confidence ?? 0})` }} /></span>{rt ? <span className="badge">재촬영 요청됨</span> : <span>신뢰도 {confPct(v.confidence)}%</span>}
                  </span>
                </span>
              </div>
            );
          })}
          {!list.length && <p className="muted rv-none">이 건에는 확인 필요 값이 없어요.</p>}
        </div>
        <div className="rv-keys" aria-hidden="true">
          <span><span className="kbd">↑↓</span>이동</span>
          <span><span className="kbd">Y</span>맞음</span>
          <span><span className="kbd">E</span>고치기</span>
          <span><span className="kbd">R</span>재촬영</span>
          <span><span className="kbd">Space</span>선택</span>
        </div>
      </section>

      <section className="card rv-view">
        {cur ? (
          <PhotoPanel key={cur.photo_id} photoId={cur.photo_id} hotkeys
            title={`${label(cur.case_id, cur.item_key)} · 기기 ${cur.unit_index}`}
            sub={`${cur.receipt_no} · ${list.findIndex((g) => g.photo_id === cur.photo_id) + 1} / ${list.length}`}
            retake={retake.has(cur.photo_id)}
            onRetake={() => {
              setRetake((s) => new Set(s).add(cur.photo_id));
              toast(`${cur.receipt_no} 기기 ${cur.unit_index} ${label(cur.case_id, cur.item_key)} — 재촬영을 요청했어요`, "info");
              move(1);
            }}
            onDone={(r) => {
              setLeaving(cur.photo_id);
              toast(r.kind === "edited" ? `${label(cur.case_id, cur.item_key)} 값 ${r.changed}개를 고쳐서 확정했어요` : `${label(cur.case_id, cur.item_key)} 확정했어요`);
              setTimeout(() => { setLeaving(null); reload(); }, 260);
            }} />
        ) : <p className="muted">왼쪽에서 사진을 고르세요.</p>}
      </section>
    </div>
  );
}
