/**
 * MSW 목업 — 서버(B-1) 완성 전 개발용. 개발 서버에서만 켜진다 (빌드 결과에는 안 들어감).
 * 오류는 서버 형식 `{ error: { code, message } }` 그대로 흉내 낸다 (02 §1.1).
 *
 * 시험용 값 (전부 가짜)
 *   등록 코드: 483920 = 성공 · 000000 = 만료(410) · 그 밖 = 틀림(400)
 *   PIN: 시험자A 1234 · 시험자B 5678 · 시험자C는 처음부터 잠김. 5회 틀리면 10분 잠김
 */
import { delay, http, HttpResponse } from "msw";
import type { Case, CaseList, CategoryList, CaseSummary, Client, Me, TesterList } from "@/api/client";
import { caseDetail, cases, categories, PINS, testers } from "./data";
import { load, save } from "./state";

const BASES = ["/api/v1", "/api/admin/v1"];
const both = (path: string) => BASES.map((b) => b + path);
const LOCK_MIN = 10;
const MAX_FAILS = 5;

const fail = (status: number, code: string, message: string, detail?: object) =>
  HttpResponse.json({ error: { code, message, ...(detail ? { detail } : {}) } }, { status });

/** 휴대폰 API는 등록된 단말(ktl_client) + 로그인(ktl_session)이 있어야 한다 */
function guard(needSession = true) {
  const s = load();
  if (!s.client) return fail(401, "CLIENT_UNKNOWN", "등록되지 않은 휴대폰입니다. 노트북에서 등록 코드를 받아 등록하세요.");
  if (needSession && !s.testerId) return fail(401, "SESSION_REQUIRED", "시험자를 선택하고 PIN을 입력하세요.");
  return null;
}

export const handlers = [
  http.post("/api/v1/clients/pair", async ({ request }) => {
    await delay(300);
    const b = (await request.json()) as { pair_code?: string; device_name?: string };
    if (b.pair_code === "000000") return fail(410, "PAIR_CODE_EXPIRED", "코드가 만료되었습니다. 노트북에서 새 코드를 받으세요");
    if (b.pair_code !== "483920") return fail(400, "VALIDATION", "등록 코드가 맞지 않습니다. 노트북 화면의 6자리를 다시 확인하세요.");
    const client: Client = { client_id: "cl_1", device_name: b.device_name || "현장폰", paired_at: new Date().toISOString(), last_seen_at: null };
    save({ ...load(), client });
    return HttpResponse.json<Client>(client);
  }),

  http.get("/api/v1/testers", () => {
    const g = guard(false);
    if (g) return g;
    const s = load();
    return HttpResponse.json<TesterList>({ items: testers.map((t) => ({ ...t, locked: t.locked || (s.lockedUntil[t.id!] ?? 0) > Date.now() })) });
  }),

  http.post("/api/v1/sessions", async ({ request }) => {
    await delay(250);
    const g = guard(false);
    if (g) return g;
    const s = load();
    const b = (await request.json()) as { tester_id: string; pin: string };
    const t = testers.find((x) => x.id === b.tester_id);
    if (!t) return fail(404, "NOT_FOUND", "시험자를 찾지 못했습니다.");
    const until = s.lockedUntil[t.id!] ?? 0;
    if (t.locked || until > Date.now())
      return fail(423, "PIN_LOCKED", `PIN ${MAX_FAILS}회 실패로 ${LOCK_MIN}분간 잠겼습니다. 노트북 담당에게 잠금 해제를 요청하세요`, { retry_after: Math.max(0, Math.round((until - Date.now()) / 1000)) });
    if (PINS[t.id!] !== b.pin) {
      const n = (s.fails[t.id!] ?? 0) + 1;
      if (n >= MAX_FAILS) {
        save({ ...s, fails: { ...s.fails, [t.id!]: 0 }, lockedUntil: { ...s.lockedUntil, [t.id!]: Date.now() + LOCK_MIN * 60_000 } });
        return fail(423, "PIN_LOCKED", `PIN ${MAX_FAILS}회 실패로 ${LOCK_MIN}분간 잠겼습니다. 노트북 담당에게 잠금 해제를 요청하세요`, { retry_after: LOCK_MIN * 60 });
      }
      save({ ...s, fails: { ...s.fails, [t.id!]: n } });
      // TODO(확인 필요): PIN이 틀렸을 때의 오류 code가 02 §1.1 표에 없다 — B-1(여준)과 맞추기. 화면은 message만 쓴다
      return fail(401, "SESSION_REQUIRED", `PIN이 맞지 않습니다 (남은 횟수 ${MAX_FAILS - n})`, { remaining: MAX_FAILS - n });
    }
    save({ ...s, testerId: t.id!, fails: { ...s.fails, [t.id!]: 0 } });
    return HttpResponse.json({ tester: t, expires_at: new Date(Date.now() + 12 * 3600_000).toISOString() });
  }),

  http.delete("/api/v1/sessions", () => {
    save({ ...load(), testerId: null });
    return new HttpResponse(null, { status: 204 });
  }),

  ...both("/sessions/me").map((p) => http.get(p, () => {
    if (p.startsWith("/api/admin")) return HttpResponse.json<Me>({ tester: testers[0] });
    const g = guard();
    if (g) return g;
    const s = load();
    return HttpResponse.json<Me>({ client: s.client!, tester: testers.find((t) => t.id === s.testerId) });
  })),

  ...both("/categories").map((p) => http.get(p, () => HttpResponse.json<CategoryList>({ items: categories }))),

  ...both("/cases").map((p) => http.get(p, async ({ request }) => {
    if (!p.startsWith("/api/admin")) {
      const g = guard();
      if (g) return g;
    }
    await delay(300);   // 진행 표시가 보이도록 약간 늦게
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const q = url.searchParams.get("q") ?? "";
    const all: CaseSummary[] = [...load().created, ...cases];
    const items = all.filter((c) => (!status || c.status === status) && (!q || c.receipt_no?.includes(q)));
    return HttpResponse.json<CaseList>({ items, next_cursor: null });
  })),

  http.post("/api/v1/cases", async ({ request }) => {
    const g = guard();
    if (g) return g;
    await delay(300);
    const b = (await request.json()) as { receipt_no?: string; category?: string; unit_count?: number; options?: Record<string, string> };
    if (!/^\d{2}-\d{6}-\d{2}$/.test(b.receipt_no ?? "")) return fail(400, "VALIDATION", "접수번호 형식은 26-000123-01 입니다", { fields: { receipt_no: "형식" } });
    const cat = categories.find((c) => c.category === b.category);
    if (!cat) return fail(400, "VALIDATION", "분류를 골라 주세요.");
    const n = Math.min(50, Math.max(1, b.unit_count ?? 1));
    const s = load();
    const c = { id: `case_${100 + s.created.length}`, receipt_no: b.receipt_no, category: b.category, unit_count: n, status: "open" as const,
      progress: { total: n * (cat.items?.length ?? 0), confirmed: 0, needs_check: 0 }, updated_at: new Date().toISOString(), options: b.options ?? {} };
    save({ ...s, created: [c, ...s.created] });
    return HttpResponse.json<Case>(caseDetail(c, c.options), { status: 201 });
  }),

  ...both("/cases/:id").map((p) => http.get(p, async ({ params }) => {
    await delay(200);
    const s = load();
    const c = s.created.find((x) => x.id === params.id) ?? cases.find((x) => x.id === params.id);
    if (!c) return fail(404, "NOT_FOUND", "접수 건을 찾지 못했습니다.");
    return HttpResponse.json<Case>(caseDetail(c, (c as { options?: Record<string, string> }).options ?? {}));
  })),
];
