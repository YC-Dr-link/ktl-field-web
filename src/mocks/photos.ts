/**
 * 목업 판독 흐름: 업로드 → queued → (1초) reading → (2.5초) done / failed. 값은 전부 가짜.
 * SSE `/events`로 photo.status · photo.values를 보낸다 (서버 02 §2.4와 같은 이름 · 모양).
 *
 * 시험용 규칙 (항목 key 기준)
 *   prec_1 → 신뢰도 낮음(확인 필요) · flow_3 → 판독 실패 · span_film → 측정 전 화면 경고 · reader none → 값 없이 done
 */
import type { Photo, Value } from "@/api/client";
import type { EventName, ServerEvent } from "@/api/events";
import { categories } from "./data";

export const photos = new Map<string, Photo & { blob?: Blob }>();
let seq = 300;

type Listener = (name: EventName, data: ServerEvent) => void;
const listeners = new Set<Listener>();
export function onEvent(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}
function emit(name: EventName, data: ServerEvent) {
  listeners.forEach((l) => l(name, data));
}

/** 값이 바뀌었다 (확정 · 수정) — 화면은 GET /photos/{id}로 다시 받는다 */
export function emitValues(photoId: string, caseId: string) {
  emit("photo.values", { photo_id: photoId, case_id: caseId });
}

const v = (key: string, label: string, value: string, unit: string | null, confidence: number, bbox: number[]): Value =>
  ({ key, label, value, unit, confidence, bbox, status: confidence < 0.8 ? "needs_check" : "auto", confirmed_by: null, confirmed_at: null });

function fakeValues(reader: string, itemKey: string): { values: Value[]; warnings: Photo["warnings"] } {
  if (reader === "flowmeter") {
    const conf = itemKey === "prec_1" ? 0.71 : 0.93;
    return { values: [v("flow", "유량", (1 + ((itemKey.length * 7) % 9) / 1000).toFixed(3), "L/min", conf, [412, 220, 690, 310]),
      v("reading_no", "측정 번호", "01 of 003", null, 0.88, [400, 120, 560, 160])], warnings: [] };
  }
  if (reader === "cert")
    return { values: [v("prev_receipt", "직전접수번호", "25-000101-01", null, 0.95, [120, 80, 420, 120]),
      v("approval_no", "형식승인번호", "ABCD-2020-3", null, 0.9, [120, 140, 420, 180]),
      v("maker", "제조사", "가나다테크(주)", null, 0.86, [120, 200, 420, 240]),
      v("serial", "제조번호", "A100-0007", null, 0.92, [120, 260, 420, 300])], warnings: [] };
  if (reader === "dust") {
    const pre = itemKey === "span_film";
    return { values: [v("value", "측정값", pre ? "0.000" : "0.512", "mg/m³", pre ? 0.6 : 0.9, [300, 200, 600, 280])],
      warnings: pre ? [{ code: "PRE_MEASURE_SCREEN", message: "측정 전 화면(0.000)일 수 있습니다." }] : [] };
  }
  return { values: [], warnings: [] };
}

export function addPhoto(caseId: string, category: string, unitIndex: number, itemKey: string, blob: Blob): Photo {
  // 같은 칸의 이전 사진은 지워진다 (다시 찍기)
  for (const p of photos.values()) if (p.case_id === caseId && p.unit_index === unitIndex && p.item_key === itemKey && p.status !== "deleted") p.status = "deleted";
  const reader = categories.find((c) => c.category === category)?.items?.find((i) => i.key === itemKey)?.reader ?? "none";
  const id = `ph_${++seq}`;
  const p: Photo & { blob?: Blob } = {
    id, case_id: caseId, unit_index: unitIndex, item_key: itemKey, reader, status: "queued", sha256: "fake",
    stored_name: `${itemKey}.jpg`, uploaded_by: "ts_1", uploaded_at: new Date().toISOString(), values: [], warnings: [], error: null, read_ms: null, blob,
  };
  photos.set(id, p);
  const ev = (status: string): ServerEvent => ({ photo_id: id, case_id: caseId, unit_index: unitIndex, item_key: itemKey, status });
  setTimeout(() => {
    if (p.status === "deleted") return;
    p.status = "reading";
    emit("photo.status", ev("reading"));
  }, 1000);
  setTimeout(() => {
    if (p.status === "deleted") return;
    if (itemKey === "flow_3") {
      Object.assign(p, { status: "failed", error: "화면을 찾지 못했습니다" });
      emit("photo.status", ev("failed"));
      return;
    }
    Object.assign(p, { status: "done", read_ms: 2140, ...fakeValues(reader, itemKey) });
    emit("photo.status", ev("done"));
    emit("photo.values", { photo_id: id, case_id: caseId });
  }, 2500);
  return p;
}

/** 항목 칸의 상태 — 그 칸의 마지막 사진으로 (Case.units[].items[].status) */
export function itemStatus(caseId: string, unitIndex: number, itemKey: string): { status: string; photo_id: string | null } | null {
  let last: Photo | null = null;
  for (const p of photos.values()) if (p.case_id === caseId && p.unit_index === unitIndex && p.item_key === itemKey && p.status !== "deleted") last = p;
  if (!last) return null;
  if (last.status !== "done") return { status: last.status ?? "queued", photo_id: last.id ?? null };
  const vals = last.values ?? [];
  const status = vals.length && vals.every((x) => x.status === "confirmed" || x.status === "edited") ? "confirmed"
    : vals.some((x) => x.status === "needs_check") ? "needs_check" : "done";
  return { status, photo_id: last.id ?? null };
}
