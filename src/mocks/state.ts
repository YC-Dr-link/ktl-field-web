/**
 * 목업 서버의 상태 (단말 등록 · 로그인 · PIN 실패 횟수). 새로고침해도 이어지게 localStorage에 둔다.
 * 처음 상태로 돌리려면 주소 뒤에 ?mock=reset
 */
import type { CaseSummary, Client } from "@/api/client";

interface MockState {
  client: Client | null; testerId: string | null; fails: Record<string, number>; lockedUntil: Record<string, number>;
  created: (CaseSummary & { options: Record<string, string> })[];   // 목업에서 새로 만든 접수 건
}
const KEY = "ktl_mock_state";
const EMPTY: MockState = { client: null, testerId: null, fails: {}, lockedUntil: {}, created: [] };

export function load(): MockState {
  try {
    if (new URLSearchParams(location.search).get("mock") === "reset") localStorage.removeItem(KEY);
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return { ...EMPTY };
  }
}

export function save(s: MockState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* 저장소 없음 — 이번 화면에서만 유지 */
  }
}
