/**
 * 현장 서버 API 호출. 타입은 OpenAPI(ktl-hub docs/api/field-server.openapi.yaml)에서 만든 schema.d.ts를 쓴다.
 * 명세가 바뀌면 `npm run gen:api`로 다시 만든다 — 직접 고치지 않는다.
 */
import type { components, paths } from "./schema";

export type Schemas = components["schemas"];
export type CaseSummary = Schemas["CaseSummary"];
export type Category = Schemas["Category"];
export type Tester = Schemas["Tester"];
export type Client = Schemas["Client"];
export type ApiErrorBody = Schemas["Error"];

type Get<P extends keyof paths> = paths[P] extends { get: { responses: { 200: { content: { "application/json": infer R } } } } } ? R : never;
export type CaseList = Get<"/cases">;
export type CategoryList = Get<"/categories">;
export type Me = Get<"/sessions/me">;
export type TesterList = Get<"/testers">;

/** 휴대폰 화면은 /api/v1, 관리 화면은 /api/admin/v1 (같은 경로 · 같은 형식) */
export const API_BASE = import.meta.env.MODE === "admin" ? "/api/admin/v1" : "/api/v1";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

/** 서버 오류는 `{ error: { code, message } }` — message는 화면에 그대로 보여 줄 한국어 (03 공통 규칙) */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API_BASE + path, { credentials: "same-origin", ...init, headers: { Accept: "application/json", ...init?.headers } });
  } catch {
    throw new ApiError(0, "NETWORK", "노트북 서버에 연결할 수 없어요. Wi-Fi(에그)에 연결됐는지 확인하세요.");
  }
  if (!res.ok) {
    let body: Partial<ApiErrorBody> | null = null;
    try {
      body = await res.json();
    } catch {
      /* 본문 없음 */
    }
    throw new ApiError(res.status, body?.error?.code ?? "INTERNAL", body?.error?.message ?? `요청 실패 (${res.status})`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}
