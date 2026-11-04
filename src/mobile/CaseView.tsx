import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { api, API_BASE, ApiError, Case, Photo } from "@/api/client";
import { useServerEvents } from "@/api/events";
import { enqueue, pending, retry, snapshot, subscribe, Upload } from "@/api/upload";
import Icon from "@/shared/Icon";
import { Skeleton, stagger } from "@/shared/motion";
import { TopBar } from "./Chrome";
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

  // 이 기기에서 찍은 칸 수 (모양용 진행률)
  const its = cur?.items ?? [];
  const shot = its.filter((it) => (it.status ?? "empty") !== "empty" || !!mine(it.key ?? "")).length;
  const conf = its.filter((it) => it.status === "confirmed").length;
  const chk = its.filter((it) => it.status === "needs_check").length;

  return (
    <div className="m-screen">
      <TopBar onBack={leave} backAria="목록으로" title={c?.receipt_no ?? "…"} sub={units.length > 0 ? `기기 ${cur?.index}/${units.length} · 촬영 체크리스트` : "불러오는 중"}
        right={
          <span className="unit-nav">
            <button className="bar-icon" disabled={unit <= 1} onClick={() => setUnit((u) => u - 1)} aria-label="앞 기기"><Icon name="left" /></button>
            <button className="bar-icon" disabled={unit >= units.length} onClick={() => setUnit((u) => u + 1)} aria-label="다음 기기"><Icon name="right" /></button>
          </span>
        } />
      <main className="m-body">
        {err && <div className="card err-box" role="alert"><div className="err-row"><Icon name="wifiOff" /><p>{err}</p></div><button className="btn" onClick={load}><Icon name="refresh" size={18} />다시 시도</button></div>}
        {!c && !err && <Skeleton rows={5} />}
        {c && its.length > 0 && (
          <div className="card progress-card enter">
            <Ring value={shot} total={its.length} />
            <div className="progress-info">
              <b>기기 {cur?.index} 촬영 {shot}/{its.length}</b>
              <div className="chips">
                <span className="badge ok"><Icon name="check" size={13} stroke={3} />확정 {conf}</span>
                {chk > 0 && <span className="badge check"><Icon name="alert" size={13} stroke={2.4} />확인 필요 {chk}</span>}
                {its.length - shot > 0 && <span className="badge"><Icon name="camera" size={14} />남음 {its.length - shot}</span>}
              </div>
            </div>
          </div>
        )}
        {units.length > 1 && (
          <div className="unit-tabs" role="tablist" aria-label="기기 고르기">
            {units.map((u) => (
              <button key={u.index} role="tab" aria-selected={u.index === cur?.index} className={`unit-tab${u.index === cur?.index ? " on" : ""}`} onClick={() => setUnit(u.index ?? 1)}>기기 {u.index}</button>
            ))}
          </div>
        )}
        <ul key={cur?.index} className="check-list stagger">
          {cur?.items?.map((it, i) => (
            <Row key={it.key} item={it} up={mine(it.key ?? "")} photo={it.photo_id ? photos[it.photo_id] : undefined} style={stagger(i)}
              onShoot={() => shoot(it.key ?? "")} onOpen={() => it.photo_id && go(`/photos/${encodeURIComponent(it.photo_id)}`)} />
          ))}
        </ul>
      </main>
      {c && (
        <footer className={`m-foot${q.failed ? " bad" : ""}`}>
          <Icon name="upload" size={18} />
          업로드 대기 {q.waiting} · 실패 {q.failed}
          {!navigator.onLine ? <span className="off"><Icon name="wifiOff" size={16} />Wi-Fi 끊김 — 다시 붙으면 자동으로 보내요</span> : <span className="live" title="노트북 서버와 연결됨" />}
        </footer>
      )}
      {/* 휴대폰 기본 카메라 (HTTP에서도 동작) */}
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
    </div>
  );
}

/** 진행 링 (모양만) */
function Ring({ value, total }: { value: number; total: number }) {
  const r = 32, len = 2 * Math.PI * r;
  return (
    <div className="ring" role="img" aria-label={`촬영 ${value}/${total}`}>
      <svg width="76" height="76" viewBox="0 0 76 76">
        <defs><linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1A73D1" /><stop offset="1" stopColor="#0A4A97" /></linearGradient></defs>
        <circle className="track" cx="38" cy="38" r={r} />
        <circle className="val" cx="38" cy="38" r={r} strokeDasharray={len} strokeDashoffset={len * (1 - (total ? value / total : 0))} />
      </svg>
      <span>{total ? Math.round((value / total) * 100) : 0}%</span>
    </div>
  );
}

function Row({ item, up, photo, style, onShoot, onOpen }: { item: Item; up?: Upload; photo?: Photo; style?: React.CSSProperties; onShoot: () => void; onOpen: () => void }) {
  // 새로 보낸 사진이 있는데 아직 판독 알림이 안 온 사이에는 "읽는 중"으로 (서버는 202 queued로 받았다).
  // 다시 찍은 경우에도 이전 사진의 상태(읽지 못함 등)를 보여 주지 않는다
  const fresh = up?.state === "done" && (!item.photo_id || (up.photo?.id && up.photo.id !== item.photo_id));
  const st: ItemStatus = fresh ? "queued" : item.status ?? "empty";
  const main = photo?.values?.[0];
  const thumb = up?.thumbUrl ?? (item.photo_id ? `${API_BASE}/photos/${encodeURIComponent(item.photo_id)}/image?variant=thumb` : null);
  const sending = up && up.state !== "done";
  const hasValue = !sending && ["done", "needs_check", "confirmed"].includes(st) && !!item.photo_id;
  const reading = !sending && (st === "queued" || st === "reading");
  const moving = up?.state === "sending" || up?.state === "waiting";

  let right: React.ReactNode;
  let state = "촬영 전";
  if (up?.state === "sending" || up?.state === "waiting") { right = <span className="badge brand"><span className="spinner" />{up.progress}%</span>; state = "보내는 중"; }
  else if (up?.state === "failed" && up.retryAt) { right = <span className="badge check"><Icon name="wifiOff" size={14} />끊김 · 곧 다시 보내요</span>; state = "다시 보낼 예정"; }
  else if (up?.state === "failed") { right = <button className="btn small bad" onClick={(e) => { e.stopPropagation(); retry(up.localId); }}><Icon name="refresh" size={16} />실패 · 다시 보내기</button>; state = "보내지 못함"; }
  else if (reading) { right = <span className="badge brand"><span className="spinner" />읽는 중…</span>; state = "판독 중"; }
  else if (st === "failed") {
    state = "읽지 못함";
    right = (
      <span className="row-actions">
        <span className="badge err">읽지 못함</span>
        <button className="btn small" onClick={(e) => { e.stopPropagation(); onShoot(); }}><Icon name="camera" size={16} />다시 찍기</button>
      </span>
    );
  }
  else if (st === "confirmed") { right = <span className="badge ok pop"><Icon name="check" size={13} stroke={3} />{main ? `${main.value}${main.unit ? ` ${main.unit}` : ""}` : "확정"}</span>; state = "확정"; }
  else if (st === "needs_check") { right = <span className="badge check pop">{main ? `${main.value} ` : ""}<Icon name="alert" size={13} stroke={2.4} />확인</span>; state = "눌러서 값 확인"; }
  else if (st === "done") { right = <span className="value">{main ? `${main.value}${main.unit ? ` ${main.unit}` : ""}` : "✓ 찍음"}</span>; state = "눌러서 확정"; }
  else right = <span className="shoot"><Icon name="camera" size={18} />촬영</span>;

  const dot = st === "confirmed" ? <span className="st-dot"><Icon name="check" size={12} stroke={3.4} /></span>
    : st === "needs_check" ? <span className="st-dot warn"><Icon name="alert" size={11} stroke={3} /></span>
    : st === "failed" ? <span className="st-dot bad"><Icon name="x" size={11} stroke={3.4} /></span> : null;

  return (
    <li className={`card check-item st-${st}`} role="button" tabIndex={0} style={style}
      onClick={() => (hasValue ? onOpen() : sending || st === "queued" || st === "reading" ? undefined : onShoot())}>
      <span className={`thumb-box${thumb ? " has" : ""}${!thumb && st === "confirmed" ? " done" : ""}${reading || moving ? " scan" : ""}`}>
        {thumb ? <img className="thumb" src={thumb} alt="" /> : <Icon name={st === "empty" ? "camera" : "image"} size={22} />}
        {dot}
      </span>
      <span className="grow">
        <span className="label">{item.label}{item.required && <span className="req" aria-label="필수">*</span>}</span>
        <span className="state">{state}</span>
      </span>
      {right}
      {moving && <span className={`up-bar${up?.state === "waiting" ? " indet" : ""}`} aria-hidden="true"><i style={up?.state === "sending" ? { transform: `scaleX(${(up.progress ?? 0) / 100})` } : undefined} /></span>}
    </li>
  );
}

function patchItem(c: Case, unitIndex: number, key: string, patch: Partial<Item>): Case {
  return { ...c, units: c.units?.map((u) => u.index !== unitIndex ? u : { ...u, items: u.items?.map((it) => (it.key === key ? { ...it, ...patch } : it)) }) };
}
