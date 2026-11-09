import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError, CaseList, CaseSummary, CategoryList, Category, Value } from "@/api/client";
import { useServerEvents } from "@/api/events";
import Icon from "@/shared/Icon";
import CaseBoard from "./review/CaseBoard";
import Queue from "./review/Queue";
import { Stat, useToast } from "./ui";
import "./review/review.css";

/**
 * AD-01 접수 건 · 확인 필요 모아 보기 (03 시나리오 B-7, REQ-B2-06)
 *   [접수 건] 왼쪽 목록(실시간) + 오른쪽 기기 × 항목 표 · [건 완료]
 *   [확인 필요 n] needs_check 값만 모아서 사진 조각 + 값 + 신뢰도 → 맞음 · 수정 · 재촬영 요청 (일괄 확정, 단축키)
 */
export type QItem = { case_id?: string; receipt_no?: string; photo_id?: string; unit_index?: number; item_key?: string; value?: Value };
export type QGroup = { photo_id: string; case_id: string; receipt_no: string; unit_index: number; item_key: string; values: Value[] };

export default function Review() {
  const [tab, setTab] = useState<"cases" | "queue">("cases");
  const [cases, setCases] = useState<CaseSummary[] | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [queue, setQueue] = useState<QItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [queueCase, setQueueCase] = useState<string>("");
  const [tick, setTick] = useState(0);   // 실시간 알림이 오면 상세도 다시 받게
  const [pulse, setPulse] = useState(0);
  const toast = useToast();

  const reload = useCallback(() => {
    Promise.all([api<CaseList>("/cases"), api<{ items?: QItem[] }>("/review-queue")])
      .then(([c, q]) => { setCases(c.items ?? []); setQueue(q.items ?? []); setErr(null); })
      .catch((e: ApiError) => setErr(e.message));
  }, []);
  useEffect(() => {
    reload();
    api<CategoryList>("/categories").then((r) => setCats(r.items ?? [])).catch(() => {});
  }, [reload]);

  // 휴대폰에서 올린 사진 · 확정이 바로 반영된다 (SSE). 알림이 몰리면 한 번만 다시 받는다
  const t = useRef<ReturnType<typeof setTimeout>>();
  useServerEvents(() => {
    clearTimeout(t.current);
    t.current = setTimeout(() => { reload(); setTick((x) => x + 1); setPulse((x) => x + 1); }, 250);
  }, reload);

  const groups = useMemo<QGroup[]>(() => {
    const m = new Map<string, QGroup>();
    for (const q of queue ?? []) {
      if (!q.photo_id || !q.value) continue;
      const g = m.get(q.photo_id) ?? { photo_id: q.photo_id, case_id: q.case_id ?? "", receipt_no: q.receipt_no ?? "", unit_index: q.unit_index ?? 1, item_key: q.item_key ?? "", values: [] };
      g.values.push(q.value);
      m.set(q.photo_id, g);
    }
    return [...m.values()];
  }, [queue]);

  const label = useCallback((caseId: string, key: string) => {
    const cat = cases?.find((c) => c.id === caseId)?.category;
    return cats.find((c) => c.category === cat)?.items?.find((i) => i.key === key)?.label ?? key;
  }, [cases, cats]);

  const open = (cases ?? []).filter((c) => c.status === "open");
  const photoCases = (cases ?? []).filter((c) => (c.progress?.total ?? 0) > 0);
  const total = photoCases.reduce((a, c) => a + (c.progress?.total ?? 0), 0);
  const confirmed = photoCases.reduce((a, c) => a + (c.progress?.confirmed ?? 0), 0);
  const nq = queue?.length ?? 0;
  const ready = cases !== null && queue !== null;

  const openQueue = (caseId = "") => {
    setQueueCase(caseId);
    setTab("queue");
  };

  return (
    <div className="a-stack rv">
      <div className="a-stats">
        <Stat i={0} icon="inbox" label="진행 중 접수 건" value={ready ? <>{open.length}<small>건</small></> : "—"} sub={ready ? `기기 ${open.reduce((a, c) => a + (c.unit_count ?? 0), 0)}대 · 전체 ${cases!.length}건` : " "} />
        <Stat i={1} icon="alert" tone="check" label="확인 필요 값" value={ready ? <>{nq}<small>개</small></> : "—"} sub={ready ? `사진 ${groups.length}장 · ${new Set(groups.map((g) => g.case_id)).size}건` : " "}
          onClick={() => openQueue()} active={tab === "queue"} />
        <Stat i={2} icon="check" tone="ok" label="확정된 칸" value={ready ? <>{total ? Math.round((confirmed / total) * 100) : 0}<small>%</small></> : "—"} sub={ready ? `${confirmed} / ${total}칸 (사진 업무)` : " "} />
        <Stat i={3} icon="shield" label="완료한 건" value={ready ? <>{(cases ?? []).filter((c) => c.status === "completed").length}<small>건</small></> : "—"} sub="미확정 값은 내보내기에서 빠져요" />
      </div>

      <div className="rv-tabs">
        <div className="rv-tab-group" role="tablist">
          <button role="tab" aria-selected={tab === "cases"} className={tab === "cases" ? "on" : ""} onClick={() => setTab("cases")}>
            <Icon name="inbox" size={18} />접수 건 {cases && <span className="rv-count">{cases.length}</span>}
          </button>
          <button role="tab" aria-selected={tab === "queue"} className={tab === "queue" ? "on" : ""} onClick={() => openQueue(queueCase)}>
            <Icon name="alert" size={18} />확인 필요 {queue && <span key={nq} className={`rv-count check${nq ? " pop" : ""}`}>{nq}</span>}
          </button>
          <i className="rv-tab-ind" style={{ transform: `translateX(${tab === "cases" ? 0 : 100}%)` }} aria-hidden="true" />
        </div>
        <span key={pulse} className={`a-chip rv-live${pulse ? " flash" : ""}`}><span className="live" />실시간 · 휴대폰 업로드 자동 반영</span>
      </div>

      {err && <div className="card err-box" role="alert"><Icon name="alert" size={20} />{err}<button className="btn" style={{ marginLeft: "auto" }} onClick={reload}><Icon name="refresh" size={18} />다시 시도</button></div>}

      {tab === "cases"
        ? <CaseBoard cases={cases} cats={cats} groups={groups} tick={tick} reload={reload} toast={toast.show} openQueue={openQueue} />
        : <Queue groups={groups} loading={queue === null} label={label} caseFilter={queueCase} setCaseFilter={setQueueCase} reload={reload} toast={toast.show} />}
      {toast.node}
    </div>
  );
}
