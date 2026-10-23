import { useEffect, useRef, useState } from "react";

export interface Box { key: string; bbox: number[]; tone: "auto" | "check" }
interface View { s: number; x: number; y: number }   // 확대 배율 · 이동(px)

/** 판독 사진: 읽은 위치에 박스, 두 손가락 확대 · 한 손가락 이동, 값을 누르면 그 박스로 확대 (03 시나리오 B-6) */
export default function ZoomImage({ src, boxes, focus, onClearFocus }: { src: string; boxes: Box[]; focus: string | null; onClearFocus: () => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [view, setView] = useState<View>({ s: 1, x: 0, y: 0 });
  const [failed, setFailed] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; view: View; mid: { x: number; y: number } } | null>(null);

  // 사진이 칸 안에 다 들어가는 기본 배율
  const fit = () => {
    const el = wrap.current;
    if (!el || !nat) return 1;
    return Math.min(el.clientWidth / nat.w, el.clientHeight / nat.h);
  };
  const centered = (s: number): View => {
    const el = wrap.current!;
    return { s, x: (el.clientWidth - nat!.w * s) / 2, y: (el.clientHeight - nat!.h * s) / 2 };
  };

  useEffect(() => {
    if (!nat || !wrap.current) return;
    const b = boxes.find((x) => x.key === focus);
    if (!b) return setView(centered(fit()));
    const [x0, y0, x1, y1] = b.bbox;
    const el = wrap.current;
    const s = Math.min(el.clientWidth / ((x1 - x0) * 1.6), el.clientHeight / ((y1 - y0) * 1.6), fit() * 6);
    setView({ s, x: el.clientWidth / 2 - ((x0 + x1) / 2) * s, y: el.clientHeight / 2 - ((y0 + y1) / 2) * s });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, nat]);

  const down = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    start();
  };
  const start = () => {
    const ps = [...pointers.current.values()];
    const mid = ps.length === 2 ? { x: (ps[0].x + ps[1].x) / 2, y: (ps[0].y + ps[1].y) / 2 } : ps[0];
    gesture.current = { dist: ps.length === 2 ? Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y) : 0, view, mid };
  };
  const move = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const ps = [...pointers.current.values()];
    const g = gesture.current;
    const rect = wrap.current!.getBoundingClientRect();
    if (ps.length === 2 && g.dist > 0) {
      const dist = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
      const s = Math.max(fit(), Math.min(fit() * 8, g.view.s * (dist / g.dist)));
      const mx = g.mid.x - rect.left, my = g.mid.y - rect.top;
      setView({ s, x: mx - ((mx - g.view.x) / g.view.s) * s, y: my - ((my - g.view.y) / g.view.s) * s });
    } else if (ps.length === 1) {
      setView({ ...g.view, x: g.view.x + (ps[0].x - g.mid.x), y: g.view.y + (ps[0].y - g.mid.y) });
    }
  };
  const up = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size) start();
    else gesture.current = null;
  };

  return (
    <div className="zoom" ref={wrap} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      {failed ? <div className="muted zoom-msg">사진을 불러오지 못했어요</div> : !nat && <div className="muted zoom-msg">사진 불러오는 중…</div>}
      <div className="zoom-layer" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})`, visibility: nat ? "visible" : "hidden" }}>
        <img src={src} alt="판독한 사진" draggable={false}
          onLoad={(e) => {
            const i = e.currentTarget;
            setNat({ w: i.naturalWidth, h: i.naturalHeight });
            requestAnimationFrame(() => setView((v) => (v.s === 1 && v.x === 0 ? viewFit(wrap.current, i) : v)));
          }}
          onError={() => setFailed(true)} />
        {nat && (
          <svg className="boxes" viewBox={`0 0 ${nat.w} ${nat.h}`} width={nat.w} height={nat.h}>
            {boxes.map((b) => {
              const [x0, y0, x1, y1] = b.bbox;
              return <rect key={b.key} x={x0} y={y0} width={x1 - x0} height={y1 - y0} className={`${b.tone}${b.key === focus ? " on" : ""}`} vectorEffect="non-scaling-stroke" />;
            })}
          </svg>
        )}
      </div>
      {(focus || view.s > fit() * 1.05) && <button className="btn small zoom-reset" onPointerDown={(e) => e.stopPropagation()} onClick={() => { onClearFocus(); setView(centered(fit())); }}>전체 보기</button>}
    </div>
  );
}

function viewFit(el: HTMLDivElement | null, img: HTMLImageElement): View {
  if (!el) return { s: 1, x: 0, y: 0 };
  const s = Math.min(el.clientWidth / img.naturalWidth, el.clientHeight / img.naturalHeight);
  return { s, x: (el.clientWidth - img.naturalWidth * s) / 2, y: (el.clientHeight - img.naturalHeight * s) / 2 };
}
