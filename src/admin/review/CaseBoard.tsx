import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { api, ApiError, Case, CaseSummary, Category } from "@/api/client";
import Icon, { IconName } from "@/shared/Icon";
import { CheckDraw, EmptyArt, stagger } from "@/shared/motion";
import type { QGroup } from "../Review";
import { ago, CATEGORY_ICON, CATEGORY_LABEL, fmtDate, json } from "../ui";
import PhotoPanel from "./PhotoPanel";

type ItemStatus = NonNullable<NonNullable<NonNullable<NonNullable<Case["units"]>[number]["items"]>[number]["status"]>>;
const CELL: Record<ItemStatus, { text: string; icon?: IconName; cls: string }> = {
  empty: { text: "미촬영", cls: "empty" },
  queued: { text: "대기", icon: "clock", cls: "auto" },
  reading: { text: "읽는 중", icon: "refresh", cls: "reading" },
  done: { text: "확정 대기", icon: "eye", cls: "auto" },
  needs_check: { text: "확인 필요", icon: "alert", cls: "check" },
  confirmed: { text: "확정", icon: "check", cls: "ok" },
  failed: { text: "읽지 못함", icon: "x", cls: "err" },
};
const DAY = 86_400_000;
type Unconfirmed = { unit_index?: number; item_key?: string; label?: string; status?: ItemStatus };

/** 접수 건 탭: 왼쪽 목록(거르기) + 오른쪽 선택 건의 기기 × 항목 표 · [건 완료] */
export default function CaseBoard({ cases, cats, groups, tick, reload, toast, openQueue }: {
  cases: CaseSummary[] | null; cats: Category[]; groups: QGroup[]; tick: number; reload: () => void;
  toast: (t: string, k?: "ok" | "err" | "info") => void; openQueue: (caseId?: string) => void;
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | "open" | "completed">("");
  const [cat, setCat] = useState("");
  const [range, setRange] = useState<"all" | "today" | "week">("all");
  const [sel, setSel] = useState<string | null>(null);

  const list = useMemo(() => {
    const now = Date.now();
    const startToday = new Date().setHours(0, 0, 0, 0);
    return (cases ?? [])
      .filter((c) => (!q || c.receipt_no?.includes(q.trim())) && (!status || c.status === status) && (!cat || c.category === cat))
      .filter((c) => {
        const t = new Date(c.updated_at ?? 0).getTime();
        return range === "all" || (range === "today" ? t >= startToday : t >= now - 7 * DAY);
      })
      .sort((a, b) => (a.status === b.status ? (b.updated_at ?? "").localeCompare(a.updated_at ?? "") : a.status === "open" ? -1 : 1));
  }, [cases, q, status, cat, range]);

  useEffect(() => {
    // 처음에는 확인 필요가 가장 많은 진행 중 건을 연다
    if (!sel && cases?.length) {
      const score = (c: CaseSummary) => (c.status === "open" ? 1000 : 0) + (c.progress?.needs_check ?? 0) * 100 + (c.progress?.total ?? 0);
      setSel([...cases].sort((a, b) => score(b) - score(a))[0].id ?? null);
    }
  }, [cases, sel]);

  const cur = cases?.find((c) => c.id === sel) ?? null;
  const catChips: [string, string][] = [["", "전체"], ...Object.entries(CATEGORY_LABEL)];

  return (
    <div className="rv-split">
      <section className="card rv-list-card">
        <div className="rv-filters">
          <label className="rv-search">
            <Icon name="search" size={18} />
            <input placeholder="접수번호 찾기 (예: 000125)" value={q} onChange={(e) => setQ(e.target.value)} />
            {q && <button onClick={() => setQ("")} aria-label="지우기"><Icon name="x" size={14} /></button>}
          </label>
          <div className="rv-filter-row">
            <span className="seg sm">
              {([["", "전체"], ["open", "진행 중"], ["completed", "완료"]] as const).map(([k, l]) => <button key={k} className={status === k ? "on" : ""} onClick={() => setStatus(k)}>{l}</button>)}
            </span>
            <label className="rv-date"><Icon name="calendar" size={16} />
              <select value={range} onChange={(e) => setRange(e.target.value as typeof range)} aria-label="날짜">
                <option value="all">전체 기간</option><option value="today">오늘</option><option value="week">최근 7일</option>
              </select>
            </label>
          </div>
          <div className="rv-chips">
            {catChips.map(([k, l]) => (
              <button key={k} className={`rv-chip${cat === k ? " on" : ""}`} onClick={() => setCat(k)}>
                {k && <Icon name={CATEGORY_ICON[k]} size={14} />}{l}
                <span>{(cases ?? []).filter((c) => !k || c.category === k).length}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="rv-clist">
          {!cases && Array.from({ length: 5 }, (_, i) => <div key={i} className="rv-citem sk-row" style={stagger(i)}><span className="sk sk-ico" /><span className="sk-lines"><span className="sk sk-1" /><span className="sk sk-2" /></span></div>)}
          {list.map((c, i) => {
            const p = c.progress ?? {};
            const pct = p.total ? (p.confirmed ?? 0) / p.total : 0;
            const photo = (p.total ?? 0) > 0;
            return (
              <button key={c.id} className={`rv-citem${c.id === sel ? " on" : ""}${c.status === "completed" ? " done" : ""}`} style={stagger(i)} onClick={() => setSel(c.id ?? null)}>
                <span className={`rv-cat ${c.category}`}><Icon name={CATEGORY_ICON[c.category ?? ""] ?? "file"} size={18} /></span>
                <span className="rv-ctext">
                  <span className="rv-cno">{c.receipt_no}</span>
                  <span className="rv-cmeta">{CATEGORY_LABEL[c.category ?? ""] ?? c.category} · 기기 {c.unit_count}대 · {ago(c.updated_at)}</span>
                  {photo
                    ? <span className="rv-prog"><i style={{ transform: `scaleX(${pct})` }} /><b style={{ transform: `scaleX(${p.total ? (p.needs_check ?? 0) / p.total : 0})`, left: `${pct * 100}%` }} /></span>
                    : <span className="rv-cmeta file"><Icon name="file" size={13} />데이터 파일 · {c.category === "gas" ? "AD-02" : "AD-03"}</span>}
                </span>
                <span className="rv-cside">
                  {c.status === "completed" ? <span className="badge ok"><Icon name="check" size={12} stroke={2.6} />완료</span>
                    : (p.needs_check ?? 0) > 0 ? <span className="badge check"><Icon name="alert" size={12} stroke={2.4} />{p.needs_check}</span>
                    : photo ? <span className="rv-pct">{Math.round(pct * 100)}%</span> : <span className="badge brand">진행 중</span>}
                </span>
              </button>
            );
          })}
          {cases && !list.length && <div className="rv-none"><EmptyArt kind="box" /><p className="muted">조건에 맞는 접수 건이 없어요.</p><button className="btn" onClick={() => { setQ(""); setStatus(""); setCat(""); setRange("all"); }}>거르기 지우기</button></div>}
        </div>
      </section>

      <section className="card rv-detail">
        {cur ? <Detail key={cur.id} c={cur} cats={cats} groups={groups} tick={tick} reload={reload} toast={toast} openQueue={openQueue} /> : (
          <div className="a-empty"><EmptyArt kind="table" /><h2>접수 건을 고르세요</h2><p className="muted">왼쪽에서 고르면 기기 × 항목 표가 나와요.</p></div>
        )}
      </section>
    </div>
  );
}

function Detail({ c, cats, groups, tick, reload, toast, openQueue }: {
  c: CaseSummary; cats: Category[]; groups: QGroup[]; tick: number; reload: () => void;
  toast: (t: string, k?: "ok" | "err" | "info") => void; openQueue: (caseId?: string) => void;
}) {
  const [d, setD] = useState<Case | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<{ msg: string; list: Unconfirmed[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [justDone, setJustDone] = useState(false);
  const [reopen, setReopen] = useState<string | null>(null);
  const [photo, setPhoto] = useState<{ id: string; title: string } | null>(null);
  useEffect(() => {
    if (!photo) return;
    const on = (e: KeyboardEvent) => e.key === "Escape" && setPhoto(null);
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [photo]);

  useEffect(() => {
    api<Case>(`/cases/${encodeURIComponent(c.id ?? "")}`).then(setD).catch((e: ApiError) => setErr(e.message));
  }, [c.id, c.status, tick]);

  const cat = cats.find((x) => x.category === c.category);
  const isData = c.category === "gas" || c.category === "radon";
  const items = d?.units?.[0]?.items ?? [];
  const all = (d?.units ?? []).flatMap((u) => u.items ?? []);
  const count = (s: ItemStatus) => all.filter((i) => i.status === s).length;
  const segs: [ItemStatus, string][] = [["confirmed", "ok"], ["needs_check", "check"], ["done", "auto"], ["reading", "auto"], ["failed", "err"]];
  const caseQueue = groups.filter((g) => g.case_id === c.id).length;
  const options = Object.entries(d?.options ?? {});

  const complete = async () => {
    setBusy(true);
    setBlocked(null);
    try {
      await api<Case>(`/cases/${encodeURIComponent(c.id ?? "")}/complete`, json("POST"));
      setJustDone(true);
      toast(`${c.receipt_no} 건을 완료했어요`);
      reload();
    } catch (e) {
      const ae = e as ApiError;
      setBlocked({ msg: ae.message, list: (ae.detail?.unconfirmed as Unconfirmed[] | undefined) ?? [] });
    } finally {
      setBusy(false);
    }
  };
  const doReopen = async () => {
    try {
      await api<Case>(`/cases/${encodeURIComponent(c.id ?? "")}/reopen`, json("POST", { reason: reopen ?? "" }));
      setReopen(null);
      setJustDone(false);
      toast(`${c.receipt_no} 건을 다시 열었어요`, "info");
      reload();
    } catch (e) {
      toast((e as ApiError).message, "err");
    }
  };

  return (
    <div className="rv-d">
      <div className="rv-dhead">
        <span className={`rv-cat lg ${c.category}`}><Icon name={CATEGORY_ICON[c.category ?? ""] ?? "file"} size={24} /></span>
        <div className="rv-dtitle">
          <div className="rv-dno">{c.receipt_no}
            {c.status === "completed" ? <span className="badge ok"><Icon name="check" size={12} stroke={2.6} />완료</span> : <span className="badge brand">진행 중</span>}
          </div>
          <div className="muted rv-dmeta">
            {cat?.label ?? CATEGORY_LABEL[c.category ?? ""]} · 기기 {c.unit_count}대{options.map(([k, v]) => <span key={k}> · {cat?.options?.find((o) => o.key === k)?.label ?? k} <b>{v}</b></span>)}
            {" · "}만든 사람 시험자A · {fmtDate(d?.created_at ?? c.updated_at)}
          </div>
        </div>
        <div className="rv-dact">
          {caseQueue > 0 && <button className="btn" onClick={() => openQueue(c.id)}><Icon name="alert" size={18} />확인 필요 {caseQueue}장</button>}
          {c.status === "completed"
            ? (reopen === null ? <button className="btn" onClick={() => setReopen("")}><Icon name="refresh" size={18} />다시 열기</button> : null)
            : !isData && <button className="btn primary" disabled={busy || !d} onClick={complete}><Icon name="shield" size={18} />{busy ? "확인 중…" : "건 완료"}</button>}
        </div>
      </div>

      {reopen !== null && (
        <div className="rv-reopen enter">
          <Icon name="edit" size={18} />
          <input autoFocus placeholder="다시 여는 사유 (예: 정밀오차 2 재측정)" value={reopen} onChange={(e) => setReopen(e.target.value)} onKeyDown={(e) => e.key === "Enter" && reopen.trim() && doReopen()} />
          <button className="btn primary" disabled={!reopen.trim()} onClick={doReopen}>다시 열기</button>
          <button className="btn" onClick={() => setReopen(null)}>취소</button>
        </div>
      )}

      {justDone && c.status === "completed" && (
        <div className="rv-done enter"><CheckDraw size={44} /><div><b>건을 완료했어요</b><span className="muted">휴대폰 목록에서 "완료"로 바뀌어요. 이제 AD-04에서 내보낼 수 있어요.</span></div>
          <button className="btn" onClick={() => { location.hash = "#AD-04"; }}><Icon name="download" size={18} />내보내기</button></div>
      )}

      {blocked && (
        <div className="rv-blocked enter" role="alert">
          <div className="rv-blocked-head"><Icon name="alert" size={20} /><b>{blocked.msg}</b><button className="rv-x" onClick={() => setBlocked(null)} aria-label="닫기"><Icon name="x" size={16} /></button></div>
          <div className="rv-blocked-list">
            {blocked.list.slice(0, 8).map((u, i) => (
              <span key={i} className={`rv-cell ${CELL[u.status ?? "empty"].cls}`} style={stagger(i)}>기기 {u.unit_index} · {u.label} <small>{CELL[u.status ?? "empty"].text}</small></span>
            ))}
            {blocked.list.length > 8 && <span className="rv-more">외 {blocked.list.length - 8}개</span>}
          </div>
          {caseQueue > 0 && <button className="btn" onClick={() => openQueue(c.id)}><Icon name="alert" size={18} />확인 필요 {caseQueue}장 먼저 처리하기</button>}
        </div>
      )}

      {err && <div className="card err-box"><Icon name="alert" size={20} />{err}</div>}

      {isData ? (
        <div className="a-hint rv-data">
          <EmptyArt kind="table" />
          <div><b>{c.category === "gas" ? "가스 로거 파일로 구간을 골라요" : "라돈 파일을 맞춰 붙여요"}</b><span>{c.category === "gas" ? "GL240 1분 · 1초 파일을 넣고 13개 항목 구간을 고르는 화면이에요." : "챔버 기준기와 시험품 파일을 넣고 지시오차 · 반복성을 미리 보는 화면이에요."}</span></div>
          <button className="btn primary" onClick={() => { location.hash = c.category === "gas" ? "#AD-02" : "#AD-03"; }}><Icon name={c.category === "gas" ? "wave" : "merge"} size={18} />{c.category === "gas" ? "AD-02 가스 구간 선택" : "AD-03 라돈 병합"}</button>
        </div>
      ) : (
        <>
          <div className="rv-stack">
            <div className="rv-stackbar" aria-hidden="true">
              {all.length > 0 && segs.map(([s, cls]) => count(s) > 0 && <i key={s} className={cls} style={{ flexGrow: count(s) }} />)}
              {all.length > 0 && count("empty") > 0 && <i className="empty" style={{ flexGrow: count("empty") }} />}
            </div>
            <div className="rv-legend">
              {segs.map(([s, cls]) => <span key={s} className={cls}><i />{CELL[s].text} <b>{count(s)}</b></span>)}
              <span className="empty"><i />미촬영 <b>{count("empty")}</b></span>
            </div>
          </div>

          <div className="a-table-wrap rv-matrix-wrap">
            <table className="a-table rv-matrix">
              <thead><tr><th>항목</th>{d?.units?.map((u) => <th key={u.index}>기기 {u.index}</th>)}</tr></thead>
              <tbody>
                {!d && Array.from({ length: 6 }, (_, i) => <tr key={i}><td colSpan={4}><span className="sk" style={{ height: 14, width: `${60 + (i % 3) * 12}%` }} /></td></tr>)}
                {items.map((it, r) => (
                  <tr key={it.key}>
                    <td className="rv-iname">{it.label}{it.required && <span className="rv-req" title="필수">*</span>}</td>
                    {d?.units?.map((u) => {
                      const cell = u.items?.[r];
                      const st = (cell?.status ?? "empty") as ItemStatus;
                      const m = CELL[st];
                      const can = !!cell?.photo_id;
                      return (
                        <td key={u.index}>
                          <button className={`rv-cell ${m.cls}`} disabled={!can} style={stagger(r)}
                            onClick={() => can && setPhoto({ id: cell!.photo_id!, title: `${it.label} · 기기 ${u.index}` })}>
                            {m.icon && <Icon name={m.icon} size={13} stroke={2.4} className={st === "reading" ? "spin" : undefined} />}{m.text}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small rv-foot"><Icon name="info" size={14} />칸을 누르면 사진과 읽은 값을 크게 봐요. 확정 안 된 칸이 있으면 [건 완료]가 막혀요.</p>
        </>
      )}

      {photo && createPortal(
        <div className="rv-drawer-back" onClick={() => setPhoto(null)}>
          <aside className="rv-drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="사진 확인">
            <button className="rv-x rv-drawer-x" onClick={() => setPhoto(null)} aria-label="닫기"><Icon name="x" size={18} /></button>
            <PhotoPanel photoId={photo.id} title={photo.title} sub={c.receipt_no}
              onDone={(r) => { toast(r.kind === "edited" ? `값 ${r.changed}개를 고쳐서 확정했어요` : "확정했어요"); setPhoto(null); reload(); }} />
          </aside>
        </div>, document.body)}
    </div>
  );
}
