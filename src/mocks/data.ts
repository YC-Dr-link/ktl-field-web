/**
 * 목업 데이터 — 전부 가짜 값. 실제 견본 · 접수번호 · 업체명 · 이름을 넣지 않는다 (가짜 접수번호는 NN-000xxx-NN).
 * 타입을 OpenAPI 스키마로 묶어 두어서 명세가 바뀌면 여기서 컴파일 에러가 난다.
 */
import type { CaseSummary, Category, Tester } from "@/api/client";

export const testers: Tester[] = [
  { id: "ts_1", name: "시험자A", locked: false, active: true },
  { id: "ts_2", name: "시험자B", locked: false, active: true },
  { id: "ts_3", name: "시험자C", locked: true, active: true },
  { id: "ts_9", name: "퇴사자", locked: false, active: false },   // active=false는 목록에 안 나와야 한다
];

/** 목업 PIN (가짜). 진짜 서버는 PIN을 돌려주지 않는다 */
export const PINS: Record<string, string> = { ts_1: "1234", ts_2: "5678", ts_3: "0000" };

// categories.yaml 요약 (시료채취 · 먼지). 전체 항목은 ktl-field-modules/categories.yaml
export const categories: Category[] = [
  {
    category: "sampling", label: "시료채취",
    options: [{ key: "flowmeter_type", label: "기준 유량계", choices: ["defender", "alicat"] }],
    items: [
      { key: "cert", label: "필증 (정도검사 증명서)", reader: "cert", required: true },
      { key: "plate", label: "형식승인표", reader: "none", required: true },
      { key: "prec_1", label: "정밀오차 1", reader: "flowmeter", required: true },
      { key: "prec_2", label: "정밀오차 2", reader: "flowmeter", required: true },
      { key: "prec_3", label: "정밀오차 3", reader: "flowmeter", required: true },
      { key: "flow_1", label: "유량변동 1", reader: "flowmeter", required: true },
      { key: "flow_2", label: "유량변동 2", reader: "flowmeter", required: true },
      { key: "flow_3", label: "유량변동 3", reader: "flowmeter", required: true },
    ],
    export: [],
  },
  { category: "dust", label: "먼지", options: [], items: [], export: [] },
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
