/**
 * 목업 서버의 상태 (단말 · 시험자 · PIN · 접수 건 · 설정). 새로고침해도 이어지게 localStorage에 둔다.
 * 처음 상태로 돌리려면 주소 뒤에 ?mock=reset (페이지를 열 때 한 번만 지운다)
 */
import type { CaseSummary, Client, Schemas, Tester } from "@/api/client";
import { PINS, testers as TESTERS } from "./data";

export interface MockState {
  client: Client | null;          // 이 휴대폰 (ktl_client)
  revoked: boolean;               // 노트북에서 해제됨 → 403 CLIENT_REVOKED
  otherClients: Client[];         // 관리 화면 목록에만 보이는 다른 단말 (가짜)
  testerId: string | null;        // 로그인한 시험자 (ktl_session)
  testers: Tester[];
  pins: Record<string, string>;
  fails: Record<string, number>;
  lockedUntil: Record<string, number>;
  created: (CaseSummary & { options: Record<string, string> })[];   // 목업에서 새로 만든 접수 건
  settings: Schemas["Settings"];
}
const KEY = "ktl_mock_state";
const fresh = (): MockState => ({
  client: null, revoked: false, testerId: null, fails: {}, lockedUntil: {}, created: [],
  otherClients: [{ client_id: "cl_2", device_name: "현장폰-2", paired_at: new Date(Date.now() - 86400_000 * 3).toISOString(), last_seen_at: new Date(Date.now() - 3600_000).toISOString() }],
  testers: TESTERS.map((t) => ({ ...t })), pins: { ...PINS },
  settings: { export_encoding: "cp949", photo_retention_days: null, confidence_threshold: 0.8, read_timeout_s: 10 },
});

let resetDone = false;
export function load(): MockState {
  try {
    if (!resetDone && new URLSearchParams(location.search).get("mock") === "reset") localStorage.removeItem(KEY);
    resetDone = true;
    return { ...fresh(), ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return fresh();
  }
}

export function save(s: MockState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* 저장소 없음 — 이번 화면에서만 유지 */
  }
}

/** 잠김 = 처음부터 잠긴 시험자 또는 5회 실패로 잠긴 시간 안 */
export function isLocked(s: MockState, t: Tester) {
  return !!t.locked || (s.lockedUntil[t.id ?? ""] ?? 0) > Date.now();
}
