/**
 * 관리 화면 공통 조각 (AD-01~03): 요청 도우미 · 접수 건 목록 · 파일 넣기 · 알림 띠 · 숫자 칸.
 * 애니메이션은 transform · opacity만 (admin.css).
 */
import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api, CaseList, CaseSummary } from "@/api/client";
import Icon, { IconName } from "@/shared/Icon";

export const json = (method: string, body?: unknown): RequestInit =>
  ({ method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

/** 상태가 queued · running이 아닐 때까지 다시 받는다 (merges · exports) */
export async function pollUntilDone<T extends { status?: string }>(path: string, onStep?: (t: T) => void, every = 500, max = 60): Promise<T> {
  for (let i = 0; ; i++) {
    const cur = await api<T>(path);
    onStep?.(cur);
    if ((cur.status !== "queued" && cur.status !== "running") || i >= max) return cur;
    await new Promise((r) => setTimeout(r, every));
  }
}

/** 접수 건 목록 (분류로 거르기) */
export function useCases(category?: string) {
  const [items, setItems] = useState<CaseSummary[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const reload = useCallback(() => api<CaseList>("/cases")
    .then((r) => setItems((r.items ?? []).filter((c) => !category || c.category === category)))
    .catch((e: Error) => setErr(e.message)), [category]);
  useEffect(() => { reload(); }, [reload]);
  return { items, err, reload };
}

export const CATEGORY_LABEL: Record<string, string> = { sampling: "시료채취", dust: "먼지", gas: "가스", radon: "라돈" };
export const CATEGORY_ICON: Record<string, IconName> = { sampling: "flow", dust: "dust", gas: "gas", radon: "radon" };

export const fmtTime = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }) : "—");
export const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) : "—");
export function ago(iso?: string | null) {
  if (!iso) return "—";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  if (m < 60 * 24) return `${Math.floor(m / 60)}시간 전`;
  return `${Math.floor(m / 1440)}일 전`;
}

/** 파일 끌어 넣기 + [파일 고르기]. children은 안내 문구 */
export function FileDrop({ onFiles, accept, busy, children, compact, extra }: { onFiles: (f: File[]) => void; accept?: string; busy?: boolean; children?: ReactNode; compact?: boolean; extra?: ReactNode }) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className={`a-drop${over ? " over" : ""}${compact ? " compact" : ""}${busy ? " busy" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files.length) onFiles([...e.dataTransfer.files]); }}>
      <span className="a-drop-ico"><Icon name="upload" size={compact ? 20 : 26} /></span>
      <div className="a-drop-text">{children ?? <><b>파일을 여기로 끌어 놓으세요</b><span>또는 [파일 고르기]</span></>}</div>
      {extra}
      <button type="button" className="btn" disabled={busy} onClick={() => input.current?.click()}><Icon name="file" size={18} />파일 고르기</button>
      <input ref={input} type="file" multiple accept={accept} hidden onChange={(e) => { if (e.target.files?.length) onFiles([...e.target.files]); e.target.value = ""; }} />
    </div>
  );
}

/** 화면 아래 잠깐 뜨는 알림 */
export function useToast() {
  const [t, setT] = useState<{ id: number; text: string; kind: "ok" | "err" | "info" } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const show = useCallback((text: string, kind: "ok" | "err" | "info" = "ok") => {
    clearTimeout(timer.current);
    setT({ id: Date.now(), text, kind });
    timer.current = setTimeout(() => setT(null), kind === "err" ? 5000 : 2800);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  // 화면 전환 애니메이션(transform) 안에서는 position: fixed가 어긋나서 body에 붙인다
  const node = t ? createPortal(
    <div key={t.id} className={`a-toast ${t.kind}`} role="status">
      <Icon name={t.kind === "err" ? "alert" : t.kind === "info" ? "info" : "check"} size={18} stroke={2.4} />{t.text}
    </div>, document.body) : null;
  return { show, node };
}

/** 위쪽 숫자 칸 */
export function Stat({ icon, label, value, sub, tone, i = 0, onClick, active }: { icon: IconName; label: string; value: ReactNode; sub?: ReactNode; tone?: "check" | "ok" | "err" | "brand"; i?: number; onClick?: () => void; active?: boolean }) {
  const cls = `a-stat${tone ? ` ${tone}` : ""}${active ? " on" : ""}`;
  const body = (
    <>
      <span className="a-stat-ico"><Icon name={icon} size={20} /></span>
      <span className="a-stat-body">
        <span className="a-stat-label">{label}</span>
        <span className="a-stat-value">{value}</span>
        {sub && <span className="a-stat-sub">{sub}</span>}
      </span>
    </>
  );
  const style = { ["--i" as string]: i };
  return onClick
    ? <button type="button" className={cls} style={style} onClick={onClick}>{body}</button>
    : <div className={cls} style={style}>{body}</div>;
}
