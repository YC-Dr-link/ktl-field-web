/**
 * 목업: 가스 · 라돈 데이터 파일 (AD-02 · AD-03). 02 §2.5
 *   POST /cases/{id}/files  → 파일 이름으로 형식을 흉내 판별 (진짜 서버는 B-4 detect())
 *   GET  /files/{id}/series → 그래프용 시계열 (가짜 값 — gas.ts · radon.ts가 만든다)
 *   POST /cases/{id}/merges → 202, 1초 뒤 done (gas_select · radon_merge)
 *   GET  /merges/{id}
 * 값은 전부 가짜. 진짜 계산은 B-4 모듈(탁 · 다운)이 한다.
 */
import { delay, http, HttpResponse } from "msw";
import type { Schemas } from "@/api/client";
import { detectGas, gasSeries, runGas } from "./gas";
import { detectRadon, radonSeries, runRadon } from "./radon";

type DataFile = Schemas["DataFile"];
type Merge = Schemas["Merge"];
export type MergeResult = Pick<Merge, "table" | "meta" | "warnings">;

const ADMIN = "/api/admin/v1";
export const files = new Map<string, DataFile>();
export const merges = new Map<string, Merge>();
let fileSeq = 40;
let mergeSeq = 10;

const fail = (status: number, code: string, message: string) => HttpResponse.json({ error: { code, message } }, { status });

/** 접수 건의 마지막 병합 결과 (내보내기 merge_raw 용) */
export function lastMerge(caseId: string): Merge | undefined {
  return [...merges.values()].filter((m) => m.case_id === caseId && m.status === "done").at(-1);
}

export const dataFileHandlers = [
  http.post(`${ADMIN}/cases/:id/files`, async ({ request, params }) => {
    await delay(450 + Math.random() * 300);
    const fd = await request.formData();
    const file = fd.get("file");
    const name = file instanceof File ? file.name : String(fd.get("name") ?? "file");
    const detected = detectGas(name) ?? detectRadon(name) ?? null;
    const f: DataFile = { id: `file_${++fileSeq}`, case_id: String(params.id), name, sha256: "fake", detected };
    files.set(f.id!, f);
    return HttpResponse.json<DataFile>(f, { status: 201 });
  }),

  http.get(`${ADMIN}/files/:id/series`, async ({ params }) => {
    await delay(350);
    const f = files.get(String(params.id));
    if (!f) return fail(404, "NOT_FOUND", "파일을 찾지 못했습니다.");
    if (!f.detected) return fail(400, "VALIDATION", "형식을 알 수 없는 파일입니다.");
    return HttpResponse.json(f.detected.kind === "gas_gl240" ? gasSeries(f) : radonSeries(f));
  }),

  http.post(`${ADMIN}/cases/:id/merges`, async ({ request, params }) => {
    const b = (await request.json()) as { selector?: string; file_ids?: string[]; options?: Record<string, unknown> };
    const list = (b.file_ids ?? []).map((id) => files.get(id)).filter((x): x is DataFile => !!x);
    if (!list.length) return fail(400, "VALIDATION", "파일을 먼저 넣어 주세요.");
    const m: Merge = { id: `mg_${++mergeSeq}`, case_id: String(params.id), selector: b.selector, status: "queued", table: null, warnings: [], error: null };
    merges.set(m.id!, m);
    setTimeout(() => Object.assign(m, { status: "running" }), 300);
    setTimeout(() => {
      try {
        const r = b.selector === "radon_merge" ? runRadon(list, b.options ?? {}) : runGas(list, b.options ?? {});
        Object.assign(m, { status: "done" }, r);
      } catch (e) {
        Object.assign(m, { status: "failed", error: e instanceof Error ? e.message : "병합하지 못했습니다." });
      }
    }, 1100);
    return HttpResponse.json<Merge>(m, { status: 202 });
  }),

  http.get(`${ADMIN}/merges/:id`, ({ params }) => {
    const m = merges.get(String(params.id));
    return m ? HttpResponse.json<Merge>(m) : fail(404, "NOT_FOUND", "병합 결과를 찾지 못했습니다.");
  }),
];
