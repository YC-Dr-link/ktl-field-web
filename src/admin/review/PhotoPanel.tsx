import { CSSProperties, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { api, API_BASE, ApiError, Photo, Value } from "@/api/client";
import Icon from "@/shared/Icon";
import { json } from "../ui";

/**
 * 사진 한 장 확인 (MO-06과 같은 동작, 큰 화면). 03 B-7 #3
 * 위: 사진 + 읽은 위치 상자(누르면 그 칸으로 확대) · 아래: 칸별 값 · 단위 · 신뢰도 · [맞음] [수정해서 확정] [재촬영 요청]
 */
export const REASONS = ["OCR 오인식", "흐림 · 빛 반사", "기타"] as const;

export type PanelResult = { kind: "confirmed" | "edited"; changed: number };

export const confPct = (c?: number) => Math.round((c ?? 0) * 100);
const STATUS_TEXT: Record<Value["status"], string> = { auto: "자동", needs_check: "확인 필요", confirmed: "확정", edited: "수정 확정" };
const STATUS_CLS: Record<Value["status"], string> = { auto: "", needs_check: "check", confirmed: "ok", edited: "ok" };

export default function PhotoPanel({ photoId, title, sub, onDone, onRetake, retake, hotkeys, editRef }: {
  photoId: string; title: string; sub?: string;
  onDone: (r: PanelResult) => void; onRetake?: () => void; retake?: boolean;
  hotkeys?: boolean; editRef?: React.MutableRefObject<(() => void) | null>;
}) {
  const [ph, setPh] = useState<Photo | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [reason, setReason] = useState<string>("");
  const [other, setOther] = useState("");
  const [focus, setFocus] = useState<string | null>(null);
  const [zoom, setZoom] = useState(true);
  const [busy, setBusy] = useState(false);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    let live = true;
    setPh(null);
    setErr(null);
    setEdits({});
    setReason("");
    setOther("");
    api<Photo>(`/photos/${encodeURIComponent(photoId)}`).then((p) => {
      if (!live) return;
      setPh(p);
      setFocus(p.values?.find((v) => v.status === "needs_check")?.key ?? p.values?.[0]?.key ?? null);
      setZoom(!!p.values?.length);
    }).catch((e: ApiError) => live && setErr(e.message));
    return () => { live = false; };
  }, [photoId]);

  const values = ph?.values ?? [];
  const changed = values.filter((v) => edits[v.key] !== undefined && edits[v.key] !== v.value);
  const final = values.length > 0 && values.every((v) => v.status === "confirmed" || v.status === "edited");
  const why = reason === "기타" ? other.trim() : reason;

  const submit = useCallback(async () => {
    if (!ph || busy || final) return;
    if (changed.length && !why) {
      setErr("값을 바꿨으면 사유를 골라 주세요.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api<Photo>(`/photos/${encodeURIComponent(ph.id ?? "")}/values`, json("PATCH", {
        values: values.map((v) => {
          const nv = edits[v.key];
          return nv !== undefined && nv !== v.value ? { key: v.key, value: nv, reason: why } : { key: v.key, value: v.value };
        }),
        confirm: true,
      }));
      onDone({ kind: changed.length ? "edited" : "confirmed", changed: changed.length });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [ph, busy, final, changed.length, why, values, edits, onDone]);

  // 단축키: Y/Enter 맞음 · E 값 고치기 · R 재촬영 요청
  const startEdit = useCallback(() => {
    const key = values.find((v) => v.status === "needs_check")?.key ?? values[0]?.key;
    if (!key) return;
    setFocus(key);
    setZoom(true);
    requestAnimationFrame(() => { inputs.current[key]?.focus(); inputs.current[key]?.select(); });
  }, [values]);
  useEffect(() => { if (editRef) editRef.current = startEdit; }, [editRef, startEdit]);
  useEffect(() => {
    if (!hotkeys) return;
    const on = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.tagName === "INPUT";
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (typing) {
        if (e.key === "Enter") { e.preventDefault(); submit(); }
        if (e.key === "Escape") (e.target as HTMLInputElement).blur();
        return;
      }
      const k = e.key.toLowerCase();
      if (k === "y" || e.key === "Enter") { e.preventDefault(); submit(); }
      else if (k === "e") { e.preventDefault(); startEdit(); }
      else if (k === "r" && onRetake) { e.preventDefault(); onRetake(); }
      else if (k === "z") setZoom((z) => !z);
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [hotkeys, submit, startEdit, onRetake]);

  const fbox = values.find((v) => v.key === focus)?.bbox ?? null;
  return (
    <div className="pp">
      <Stage photoId={photoId} values={values} focusBox={zoom ? fbox : null} focus={focus} onPick={(k) => { setFocus(k); setZoom(true); }}
        failed={ph?.status === "failed"} loading={!ph && !err} />
      <div className="pp-bar">
        <div className="pp-title">
          <b>{title}</b>
          {sub && <span className="muted">{sub}</span>}
        </div>
        <div className="pp-tools">
          {fbox && <button className={`pp-tool${zoom ? " on" : ""}`} onClick={() => setZoom((z) => !z)} title="Z"><Icon name={zoom ? "zoomOut" : "zoomIn"} size={16} />{zoom ? "전체 사진" : "값 위치 확대"}</button>}
          <a className="pp-tool" href={`${API_BASE}/photos/${encodeURIComponent(photoId)}/image`} target="_blank" rel="noreferrer"><Icon name="image" size={16} />원본</a>
        </div>
      </div>

      {ph?.warnings?.map((w) => (
        <div key={w.code} className="pp-warn"><Icon name="alert" size={18} /><span><b>{w.message}</b> 측정 화면이 맞는지 사진을 확인하고, 아니면 재촬영을 요청하세요.</span></div>
      ))}
      {ph?.status === "failed" && <div className="pp-warn err"><Icon name="alert" size={18} /><span><b>읽지 못함</b> — {ph.error ?? "판독에 실패했어요"}. 재촬영을 요청하세요.</span></div>}
      {retake && <div className="pp-warn info"><Icon name="camera" size={18} /><span><b>재촬영 요청함</b> — 시험자 휴대폰 체크리스트에 "다시 찍기"로 표시돼요.</span></div>}

      {!!values.length && (
        <div className="pp-values">
          {values.map((v, i) => {
            const cur = edits[v.key] ?? v.value;
            const dirty = cur !== v.value;
            const locked = v.status === "confirmed" || v.status === "edited";
            return (
              <div key={v.key} className={`pp-val ${STATUS_CLS[v.status]}${focus === v.key ? " focus" : ""}${dirty ? " dirty" : ""}`} style={{ ["--i" as string]: i } as CSSProperties}
                onClick={() => { setFocus(v.key); setZoom(true); }}>
                <span className="pp-val-label">{v.label}</span>
                <span className="pp-val-input">
                  <input ref={(el) => { inputs.current[v.key] = el; }}
                    value={cur} disabled={locked || busy} spellCheck={false} aria-label={`${v.label} 값`}
                    onChange={(e) => setEdits({ ...edits, [v.key]: e.target.value })} onFocus={() => setFocus(v.key)} />
                  {v.unit && <span className="unit">{v.unit}</span>}
                </span>
                <span className="pp-conf" title={`신뢰도 ${confPct(v.confidence)}%`}>
                  <span className="pp-conf-bar"><i style={{ transform: `scaleX(${v.confidence ?? 0})` }} /></span>
                  <span className="pp-conf-num">{confPct(v.confidence)}%</span>
                </span>
                <span className={`badge ${dirty ? "brand" : STATUS_CLS[v.status]}`}>
                  {dirty ? <><Icon name="edit" size={12} stroke={2.4} />수정됨</> : <>{v.status === "needs_check" && <Icon name="alert" size={12} stroke={2.4} />}{(v.status === "confirmed" || v.status === "edited") && <Icon name="check" size={12} stroke={2.6} />}{STATUS_TEXT[v.status]}</>}
                </span>
                {dirty && <span className="pp-was">읽은 값 <s>{v.value}</s></span>}
              </div>
            );
          })}
        </div>
      )}

      {changed.length > 0 && (
        <div className="pp-reason">
          <span className="pp-reason-label"><Icon name="edit" size={16} />바꾼 이유 <small>(확정 후 기록에 남아요)</small></span>
          <span className="seg">{REASONS.map((r) => <button key={r} type="button" className={reason === r ? "on" : ""} onClick={() => setReason(r)}>{r}</button>)}</span>
          {reason === "기타" && <input className="pp-other" placeholder="사유를 적어 주세요" value={other} onChange={(e) => setOther(e.target.value)} autoFocus />}
        </div>
      )}

      {err && <div className="card err-box" role="alert"><Icon name="alert" size={20} />{err}</div>}

      <div className="pp-actions">
        {final ? (
          <span className="badge ok pp-final"><Icon name="check" size={14} stroke={2.6} />확정된 사진이에요 · {ph?.values?.[0]?.confirmed_by === "ts_2" ? "시험자B" : "시험자A"}</span>
        ) : changed.length ? (
          <button className="btn primary" disabled={busy || !why || !ph} onClick={submit}><Icon name="check" size={18} />{busy ? "저장 중…" : `수정해서 확정 (${changed.length})`}<span className="kbd on-dark">Enter</span></button>
        ) : (
          <button className="btn primary ok" disabled={busy || !ph || !values.length} onClick={submit}><Icon name="check" size={18} />{busy ? "저장 중…" : "맞음 · 확정"}<span className="kbd on-dark">Y</span></button>
        )}
        {!final && !!values.length && !changed.length && <button className="btn" onClick={startEdit}><Icon name="edit" size={18} />값 고치기<span className="kbd">E</span></button>}
        {onRetake && !final && <button className={`btn${retake ? " retake-on" : ""}`} onClick={onRetake} disabled={retake}><Icon name="camera" size={18} />{retake ? "재촬영 요청됨" : "재촬영 요청"}{!retake && <span className="kbd">R</span>}</button>}
        <span className="pp-meta muted">
          <Icon name="user" size={14} />{ph?.uploaded_by === "ts_2" ? "시험자B" : "시험자A"} · {ph?.uploaded_at ? new Date(ph.uploaded_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }) : "—"}
          {ph?.read_ms ? <> · 판독 {(ph.read_ms / 1000).toFixed(1)}초</> : null}
        </span>
      </div>
    </div>
  );
}

/** 사진 + 값 위치 상자. 고른 상자로 부드럽게 확대 (transform만) */
function Stage({ photoId, values, focusBox, focus, onPick, failed, loading }: {
  photoId: string; values: Value[]; focusBox: number[] | null; focus: string | null; onPick: (k: string) => void; failed?: boolean; loading?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 640, h: 330 });
  const [nat, setNat] = useState({ w: 960, h: 720 });
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => setReady(false), [photoId]);

  const t = useMemo(() => {
    if (focusBox) {
      const [x1, y1, x2, y2] = focusBox;
      const bw = (x2 - x1) * 1.7;
      const bh = (y2 - y1) * 1.9;
      const s = Math.min(size.w / bw, size.h / bh, 3);
      return { s, x: size.w / 2 - ((x1 + x2) / 2) * s, y: size.h / 2 - ((y1 + y2) / 2) * s };
    }
    const s = Math.min(size.w / nat.w, size.h / nat.h);
    return { s, x: (size.w - nat.w * s) / 2, y: (size.h - nat.h * s) / 2 };
  }, [focusBox, size, nat]);

  return (
    <div ref={ref} className={`pp-stage${ready ? " ready" : ""}`}>
      <div className="pp-canvas" style={{ width: nat.w, height: nat.h, transform: `translate(${t.x}px, ${t.y}px) scale(${t.s})` }}>
        <img src={`${API_BASE}/photos/${encodeURIComponent(photoId)}/image`} alt="현장 사진" draggable={false}
          onLoad={(e) => { const im = e.currentTarget; if (im.naturalWidth) setNat({ w: im.naturalWidth, h: im.naturalHeight }); setReady(true); }} />
        <svg className="pp-boxes" viewBox={`0 0 ${nat.w} ${nat.h}`} width={nat.w} height={nat.h}>
          {values.filter((v) => v.bbox?.length === 4).map((v) => {
            const [x1, y1, x2, y2] = v.bbox!;
            return (
              <g key={v.key} className={`pp-box ${v.status}${focus === v.key ? " on" : ""}`} onClick={() => onPick(v.key)}>
                <rect x={x1 - 6} y={y1 - 6} width={x2 - x1 + 12} height={y2 - y1 + 12} rx="10" />
                {focus === v.key && <text x={x1 - 4} y={y1 - 16}>{v.label}</text>}
              </g>
            );
          })}
        </svg>
      </div>
      {(loading || !ready) && !failed && <div className="pp-stage-load"><span className="sk" /></div>}
      {failed && <span className="pp-stage-tag err"><Icon name="alert" size={14} />판독 실패</span>}
    </div>
  );
}

/** 작은 잘라 보기: 값 위치(bbox) 둘레만 */
export function Crop({ photoId, bbox, w = 116, h = 74 }: { photoId: string; bbox?: number[] | null; w?: number; h?: number }) {
  const [nat, setNat] = useState({ w: 960, h: 720 });
  const [ok, setOk] = useState(false);
  let s: number, x: number, y: number;
  if (bbox?.length === 4) {
    const [x1, y1, x2, y2] = bbox;
    const bw = x2 - x1;
    const bh = y2 - y1;
    s = Math.min(Math.max(w / bw, h / bh), w / (bw * 0.92));   // 값 상자를 꽉 채우되 가로는 다 보이게
    x = w / 2 - ((x1 + x2) / 2) * s;
    y = h / 2 - ((y1 + y2) / 2) * s;
  } else {
    s = Math.max(w / nat.w, h / nat.h);
    x = (w - nat.w * s) / 2;
    y = (h - nat.h * s) / 2;
  }
  return (
    <span className={`crop${ok ? " ok" : ""}`} style={{ width: w, height: h }}>
      <img src={`${API_BASE}/photos/${encodeURIComponent(photoId)}/image`} alt="" draggable={false} loading="lazy"
        style={{ width: nat.w, height: nat.h, transform: `translate(${x}px, ${y}px) scale(${s})` }}
        onLoad={(e) => { const im = e.currentTarget; if (im.naturalWidth && im.naturalWidth !== nat.w) setNat({ w: im.naturalWidth, h: im.naturalHeight }); setOk(true); }} />
    </span>
  );
}
