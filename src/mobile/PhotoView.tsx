import { useEffect, useRef, useState } from "react";
import { api, API_BASE, ApiError, Photo, Value } from "@/api/client";
import { enqueue } from "@/api/upload";
import ZoomImage, { Box } from "./ZoomImage";

const REASONS = ["OCR 오인식", "흐림", "기타"] as const;
type Edit = { value: string; reason: string; other: string };

/** MO-06 판독 결과 확인 · 수정 · 확정 (03 시나리오 B-6, REQ-B2-05 · 11).
 *  노란 칸(needs_check)은 [맞음] 또는 고친 뒤(사유 필수)에야 [확정]이 켜진다. */
export default function PhotoView({ id }: { id: string }) {
  const [p, setP] = useState<Photo | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [ok, setOk] = useState<Record<string, boolean>>({});        // 노란 칸 [맞음]
  const [edits, setEdits] = useState<Record<string, Edit>>({});     // 고친 칸
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const camera = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<Photo>(`/photos/${encodeURIComponent(id)}`).then(setP).catch((e: ApiError) => setErr(e.message));
  }, [id]);

  if (err) return <Shell><div className="card err-box" role="alert">{err}</div></Shell>;
  if (!p) return <Shell><div className="card muted loading">불러오는 중…</div></Shell>;

  const values = p.values ?? [];
  const confirmed = values.length > 0 && values.every((v) => v.status === "confirmed" || v.status === "edited");
  const changed = (v: Value) => edits[v.key] !== undefined && edits[v.key].value !== v.value;
  const reasonOf = (v: Value) => (edits[v.key]?.reason === "기타" ? edits[v.key].other.trim() : edits[v.key]?.reason ?? "");
  const handled = (v: Value) => v.status !== "needs_check" || ok[v.key] || changed(v);
  const reasonsOk = values.every((v) => !changed(v) || reasonOf(v).length > 0);
  const canConfirm = values.length > 0 && values.every(handled) && reasonsOk && !busy;
  const left = values.filter((v) => !handled(v)).length;
  const pre = (p.warnings ?? []).find((w) => w.code === "PRE_MEASURE_SCREEN");
  const others = (p.warnings ?? []).filter((w) => w.code !== "PRE_MEASURE_SCREEN");
  const boxes: Box[] = values.filter((v) => v.bbox?.length === 4).map((v) => ({ key: v.key, bbox: v.bbox as number[], tone: v.status === "needs_check" && !handled(v) ? "check" : "auto" }));

  const confirm = async () => {
    if (!canConfirm) return;
    setBusy(true);
    setErr(null);
    try {
      const body = { confirm: true, values: values.map((v) => (changed(v) ? { key: v.key, value: edits[v.key].value.trim(), reason: reasonOf(v) } : { key: v.key, value: v.value })) };
      await api<Photo>(`/photos/${encodeURIComponent(id)}/values`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      history.back();   // MO-05로 — 줄에 ✓
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const reshoot = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !p.case_id || !p.unit_index || !p.item_key) return;
    enqueue(p.case_id, p.unit_index, p.item_key, f);   // 같은 칸에 새 사진 — 이전 사진은 서버가 지운다
    history.back();
  };

  return (
    <Shell>
      {pre && (
        <div className="warn-band" role="alert">
          ⚠ {pre.message ?? "측정 전 화면(0.000)일 수 있습니다"}
          <button className="btn small primary" onClick={() => camera.current?.click()}>다시 찍기</button>
        </div>
      )}
      {others.map((w, i) => <div key={i} className="card note-box">{w.message}</div>)}
      <ZoomImage src={`${API_BASE}/photos/${encodeURIComponent(id)}/image?variant=rotated`} boxes={boxes} focus={focus} onClearFocus={() => setFocus(null)} />

      <ul className="value-list">
        {values.map((v) => {
          const ed = edits[v.key];
          const isChanged = changed(v);
          const yellow = v.status === "needs_check" && !handled(v);
          return (
            <li key={v.key} className={`card value-row${yellow ? " yellow" : ""}${focus === v.key ? " focused" : ""}`} onClick={() => setFocus(v.key)}>
              <div className="value-top">
                <span className="muted">{v.label}</span>
                {isChanged ? <span className="badge">수정됨</span> : v.status === "needs_check" ? (ok[v.key] ? <span className="badge ok">✓ 맞음</span> : <span className="badge check">⚠ 확인 필요</span>)
                  : v.status === "confirmed" || v.status === "edited" ? <span className="badge ok">✓ 확정</span> : <span className="badge">자동</span>}
              </div>
              {editing === v.key ? (
                <div className="edit" onClick={(e) => e.stopPropagation()}>
                  <input className="edit-input" autoFocus inputMode="decimal" value={ed?.value ?? v.value}
                    onChange={(e) => setEdits((x) => ({ ...x, [v.key]: { value: e.target.value, reason: x[v.key]?.reason ?? "", other: x[v.key]?.other ?? "" } }))} />
                  <div className="choice-row">
                    {REASONS.map((r) => (
                      <button key={r} className={`btn choice${ed?.reason === r ? " on" : ""}`}
                        onClick={() => setEdits((x) => ({ ...x, [v.key]: { value: x[v.key]?.value ?? v.value, reason: r, other: x[v.key]?.other ?? "" } }))}>{r}</button>
                    ))}
                  </div>
                  {ed?.reason === "기타" && <input className="edit-input small" placeholder="사유를 적어 주세요" value={ed.other} onChange={(e) => setEdits((x) => ({ ...x, [v.key]: { ...x[v.key], other: e.target.value } }))} />}
                  {isChanged && !reasonOf(v) && <div className="err-text small">값을 바꾸면 사유를 골라야 해요</div>}
                  <button className="btn" onClick={() => setEditing(null)}>닫기</button>
                </div>
              ) : (
                <>
                  <div className="value-big">{isChanged ? ed.value : v.value}{v.unit && <span className="unit"> {v.unit}</span>}</div>
                  <div className="conf" title={`신뢰도 ${Math.round((v.confidence ?? 0) * 100)}%`}><i style={{ width: `${Math.round((v.confidence ?? 0) * 100)}%` }} className={(v.confidence ?? 0) < 0.8 ? "low" : ""} /></div>
                  {!confirmed && (
                    <div className="value-actions" onClick={(e) => e.stopPropagation()}>
                      {v.status === "needs_check" && !isChanged && !ok[v.key] && <button className="btn small" onClick={() => setOk((x) => ({ ...x, [v.key]: true }))}>맞음</button>}
                      <button className="btn small" onClick={() => { setEditing(v.key); setFocus(v.key); }}>고치기</button>
                    </div>
                  )}
                </>
              )}
            </li>
          );
        })}
        {!values.length && <li className="card muted">읽은 값이 없어요 (판독하지 않는 항목이거나 아직 읽는 중)</li>}
      </ul>

      {err && <div className="card err-box" role="alert">{err}</div>}
      <div className="photo-actions">
        <button className="btn" onClick={() => camera.current?.click()}>다시 찍기</button>
        {!confirmed && <button className="btn primary big" disabled={!canConfirm} onClick={confirm}>{busy ? "확정 중…" : left ? `확정 (확인 남음 ${left})` : "확정"}</button>}
        {confirmed && <span className="badge ok">✓ 확정된 사진</span>}
      </div>
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={reshoot} />
    </Shell>
  );
}

function Shell({ title = "판독 결과", children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="m-screen">
      <header className="m-bar"><button className="btn ghost" onClick={() => history.back()} aria-label="체크리스트로">‹</button><b>{title}</b><span /></header>
      <main className="m-body">{children}</main>
    </div>
  );
}
