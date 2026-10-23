/**
 * 목업 데이터 — 전부 가짜 값. 실제 견본 · 접수번호 · 업체명 · 이름을 넣지 않는다 (가짜 접수번호는 NN-000xxx-NN).
 * 타입을 OpenAPI 스키마로 묶어 두어서 명세가 바뀌면 여기서 컴파일 에러가 난다.
 */
import type { Case, CaseSummary, Category, Tester } from "@/api/client";

export const testers: Tester[] = [
  { id: "ts_1", name: "시험자A", locked: false, active: true },
  { id: "ts_2", name: "시험자B", locked: false, active: true },
  { id: "ts_3", name: "시험자C", locked: true, active: true },
  { id: "ts_9", name: "퇴사자", locked: false, active: false },   // active=false는 목록에 안 나와야 한다
];

/** 목업 PIN (가짜). 진짜 서버는 PIN을 돌려주지 않는다 */
export const PINS: Record<string, string> = { ts_1: "1234", ts_2: "5678", ts_3: "0000" };

// categories.yaml과 같은 모양 (ktl-field-modules/categories.yaml). phone: false는 휴대폰에서 안 고른다 — OpenAPI 스키마에는 아직 없는 칸
type Cat = Category & { phone?: boolean };
const item = (key: string, label: string, reader: string) => ({ key, label, reader, required: true });
export const categories: Cat[] = [
  {
    category: "sampling", label: "시료채취", phone: true,
    options: [{ key: "flowmeter_type", label: "기준 유량계", choices: ["defender", "alicat"] }],
    items: [
      item("cert", "필증 (정도검사 증명서)", "cert"), item("plate", "형식승인표", "none"),
      item("prec_1", "정밀오차 1", "flowmeter"), item("prec_2", "정밀오차 2", "flowmeter"), item("prec_3", "정밀오차 3", "flowmeter"),
      item("flow_1", "유량변동 1", "flowmeter"), item("flow_2", "유량변동 2", "flowmeter"), item("flow_3", "유량변동 3", "flowmeter"),
    ],
    export: [],
  },
  {
    category: "dust", label: "먼지", phone: true,
    options: [{ key: "dust_model", label: "측정기 종류", choices: ["bam1020", "mezus610"] }],
    items: [
      item("cert", "필증 (정도검사 증명서)", "cert"), item("plate", "형식승인표", "none"),
      item("span_film", "스팬필름", "dust"), item("span_1", "스팬 1", "dust"), item("span_2", "스팬 2", "dust"),
      item("mid_film", "중간필름", "dust"), item("linearity", "직선성", "dust"), item("meas_flow", "측정유량", "dust"),
      item("rep_1", "반복성 1", "dust"), item("rep_2", "반복성 2", "dust"),
    ],
    export: [],
  },
  { category: "gas", label: "가스", phone: false, options: [], items: [], export: [] },
  { category: "radon", label: "라돈", phone: false, options: [], items: [], export: [] },
];

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

export const cases: CaseSummary[] = [
  { id: "case_12", receipt_no: "26-000123-01", category: "sampling", unit_count: 2, status: "open",
    progress: { total: 16, confirmed: 5, needs_check: 1 }, updated_at: ago(3) },
  { id: "case_13", receipt_no: "26-000124-02", category: "sampling", unit_count: 1, status: "open",
    progress: { total: 8, confirmed: 0, needs_check: 0 }, updated_at: ago(40) },
  { id: "case_10", receipt_no: "26-000120-03", category: "dust", unit_count: 1, status: "completed",
    progress: { total: 6, confirmed: 6, needs_check: 0 }, updated_at: ago(60 * 26) },
];

/** 접수 건 상세 — 기기마다 그 분류의 촬영 항목. 목업은 상태를 몇 개 섞어 둔다 */
export function caseDetail(c: CaseSummary, options: Record<string, string> = {}): Case {
  const cat = categories.find((x) => x.category === c.category);
  const demo = c.id === "case_12";
  return {
    ...c, options, created_by: "ts_1", created_at: c.updated_at,
    units: Array.from({ length: c.unit_count ?? 1 }, (_, u) => ({
      index: u + 1,
      items: (cat?.items ?? []).map((it, i) => ({
        key: it.key, label: it.label, required: it.required, photo_id: null,
        status: demo && u === 0 ? (["confirmed", "confirmed", "needs_check", "reading"] as const)[i] ?? "empty" : "empty",
      })),
    })),
  };
}
