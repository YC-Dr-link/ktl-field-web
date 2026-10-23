import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { api, API_BASE, ApiError, Case, Photo } from "@/api/client";
import { useServerEvents } from "@/api/events";
import { enqueue, pending, retry, snapshot, subscribe, Upload } from "@/api/upload";
import { go } from "./router";

type Item = NonNullable<NonNullable<NonNullable<Case["units"]>[number]["items"]>[number]>;
type ItemStatus = NonNullable<Item["status"]>;

/** MO-05 촬영 체크리스트 (03 시나리오 B-5). 줄을 누르면 카메라 → 찍자마자 큐에 넣고 다음 줄을 바로 찍을 수 있다. */
export default function CaseView({ id }: { id: string }) {
  const [c, setC] = useState<Case | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [unit, setUnit] = useState(1);
  const [photos, setPhotos] = useState<Record<string, Photo>>({});   // photo_id → 판독 결과 (주 값 표시용)
  const uploads = useSyncExternalStore(subscribe, snapshot);
  const camera = useRef<HTMLInputElement>(null);
  const target = useRef<{ unit: number; key: string } | null>(null);

  const load = useCallback(() => {
    api<Case>(`/cases/${encodeURIComponent(id)}`).then((x) => {
      setC(x);
      setErr(null);
    }).catch((e: ApiError) => setErr(e.message));
  }, [id]);
  useEffect(load, [load]);

  const fetchPhoto = useCallback((pid: string) => {
    api<Photo>(`/photos/${encodeURIComponent(pid)}`).then((p) => setPhotos((x) => ({ ...x, [pid]: p }))).catch(() => {});
  }, []);

  // 판독 상태가 바뀌면 그 줄만 고친다. 값이 나오면 사진을 다시 받아 주 값을 보여 준다
  useServerEvents((name, e) => {
    if (e.case_id !== id) return;
    if (name === "photo.status" && e.unit_index && e.item_key) {
      setC((x) => x && patchItem(x, e.unit_index!, e.item_key!, { status: (e.status as ItemStatus) ?? "queued", photo_id: e.photo_id ?? null }));
      if (e.status === "done" || e.status === "failed") load();
    }
    if (name === "photo.values" && e.photo_id) {
      fetchPhoto(e.photo_id);
      load();
    }
    if (name === "case.updated") load();
  }, load);   // 다시 붙으면 놓친 것을 채우려고 전체를 다시

  // 화면에 보이는 칸 중 값이 있는데 아직 안 받은 사진은 받아 둔다
  useEffect(() => {
    for (const u of c?.units ?? []) for (const it of u.items ?? [])
      if (it.photo_id && !photos[it.photo_id] && ["done", "needs_check", "confirmed"].includes(it.status ?? "")) fetchPhoto(it.photo_id);
  }, [c, photos, fetchPhoto]);

  const shoot = (key: string) => {
    target.current = { unit, key };
    camera.current?.click();
  };
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";   // 같은 줄을 다시 찍어도 change가 오게
    if (!f || !target.current) return;
    enqueue(id, target.current.unit, target.current.key, f);
  };

  const units = c?.units ?? [];
  const cur = units.find((u) => u.index === unit) ?? units[0];
  const mine = (key: string) => [...uploads].reverse().find((u) => u.caseId === id && u.unitIndex === cur?.index && u.itemKey === key);
  const q = pending(id);
  const missing = units.flatMap((u) => (u.items ?? []).filter((it) => it.required && (it.status ?? "empty") === "empty" && !uploads.some((x) => x.caseId === id && x.unitIndex === u.index && x.itemKey === it.key)).map((it) => ({ u: u.index, label: it.label })));

  const leave = () => {
    if (missing.length && !confirm(`${missing[0].label}${missing.length > 1 ? ` 외 ${missing.length - 1}개` : ""}을(를) 아직 찍지 않았습니다. 나갈까요?`)) return;
    history.back();
  };

  return (
    <div className="m-screen">
      <header className="m-bar">
        <button className="btn ghost" onClick={leave} aria-label="목록으로">‹</button>
        <b>{c?.receipt_no ?? "…"}{units.length > 0 && ` · 기기 ${cur?.index}/${units.length}`}</b>
        <span className="unit-nav">
          <button className="btn ghost" disabled={unit <= 1} onClick={() => setUnit((u) => u - 1)} aria-label="앞 기기">◂</button>
          <button className="btn ghost" disabled={unit >= units.length} onClick={() => setUnit((u) => u + 1)} aria-label="다음 기기">▸</button>
        </span>
      </header>
      <main className="m-body">
        {err && <div className="card err-box" role="alert"><p>{err}</p><button className="btn" onClick={load}>다시 시도</button></div>}
        {!c && !err && <div className="card muted loading">불러오는 중…</div>}
        <ul className="check-list">
          {cur?.items?.map((it) => (
            <Row key={it.key} item={it} up={mine(it.key ?? "")} photo={it.photo_id ? photos[it.photo_id] : undefined}
              onShoot={() => shoot(it.key ?? "")} onOpen={() => it.photo_id && go(`/photos/${encodeURIComponent(it.photo_id)}`)} />
          ))}
        </ul>
      </main>
      {c && (
        <footer className={`m-foot${q.failed ? " bad" : ""}`}>
          업로드 대기 {q.waiting} · 실패 {q.failed}
          {!navigator.onLine && <span> · Wi-Fi 끊김 — 다시 붙으면 자동으로 보내요</span>}
        </footer>
      )}
      {/* 휴대폰 기본 카메라 (HTTP에서도 동작) */}
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
    </div>
  );
}

function Row({ item, up, photo, onShoot, onOpen }: { item: Item; up?: Upload; photo?: Photo; onShoot: () => void; onOpen: () => void }) {
  // 새로 보낸 사진이 있는데 아직 판독 알림이 안 온 사이에는 "읽는 중"으로 (서버는 202 queued로 받았다).
  // 다시 찍은 경우에도 이전 사진의 상태(읽지 못함 등)를 보여 주지 않는다
  const fresh = up?.state === "done" && (!item.photo_id || (up.photo?.id && up.photo.id !== item.photo_id));
  const st: ItemStatus = fresh ? "queued" : item.status ?? "empty";
  const main = photo?.values?.[0];
  const thumb = up?.thumbUrl ?? (item.photo_id ? `${API_BASE}/photos/${encodeURIComponent(item.photo_id)}/image?variant=thumb` : null);
  const sending = up && up.state !== "done";
  const hasValue = !sending && ["done", "needs_check", "confirmed"].includes(st) && !!item.photo_id;

  let right: React.ReactNode;
  if (up?.state === "sending" || up?.state === "waiting") right = <span className="badge">보내는 중 {up.progress}%</span>;
  else if (up?.state === "failed" && up.retryAt) right = <span className="badge check">끊김 · 곧 다시 보내요</span>;
  else if (up?.state === "failed") right = <button className="btn small bad" onClick={(e) => { e.stopPropagation(); retry(up.localId); }}>실패 · 다시 보내기</button>;
  else if (st === "queued" || st === "reading") right = <span className="badge">읽는 중…</span>;
  else if (st === "failed")
    right = (
      <span className="row-actions">
        <span className="badge err">읽지 못함</span>
        <button className="btn small" onClick={(e) => { e.stopPropagation(); onShoot(); }}>다시 찍기</button>
      </span>
    );
  else if (st === "confirmed") right = <span className="badge ok">✓ {main ? `${main.value}${main.unit ? ` ${main.unit}` : ""}` : "확정"}</span>;
  else if (st === "needs_check") right = <span className="badge check">{main ? `${main.value} ` : ""}⚠ 확인</span>;
  else if (st === "done") right = <span className="value">{main ? `${main.value}${main.unit ? ` ${main.unit}` : ""}` : "✓ 찍음"}</span>;
  else right = <span className="shoot">촬영</span>;

  return (
    <li className={`card check-item st-${st}`} role="button" tabIndex={0}
      onClick={() => (hasValue ? onOpen() : sending || st === "queued" || st === "reading" ? undefined : onShoot())}>
      {thumb ? <img className="thumb" src={thumb} alt="" /> : <span className={`dot${st !== "empty" ? " on" : ""}`} aria-hidden />}
      <span className="grow">{item.label}{item.required && <span className="req" aria-label="필수">*</span>}</span>
      {right}
    </li>
  );
}

function patchItem(c: Case, unitIndex: number, key: string, patch: Partial<Item>): Case {
  return { ...c, units: c.units?.map((u) => u.index !== unitIndex ? u : { ...u, items: u.items?.map((it) => (it.key === key ? { ...it, ...patch } : it)) }) };
}
