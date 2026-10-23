/** MSW 목업 — 서버(B-1) 완성 전 개발용. 개발 서버에서만 켜진다 (빌드 결과에는 안 들어감). */
import { delay, http, HttpResponse } from "msw";
import type { CaseList, CategoryList, Me } from "@/api/client";
import { cases, categories, testers } from "./data";

const BASES = ["/api/v1", "/api/admin/v1"];
const both = (path: string) => BASES.map((b) => b + path);

export const handlers = [
  ...both("/sessions/me").map((p) => http.get(p, () =>
    HttpResponse.json<Me>({ client: { client_id: "cl_1", device_name: "현장폰-1", paired_at: new Date().toISOString(), last_seen_at: null }, tester: testers[0] }))),

  ...both("/categories").map((p) => http.get(p, () => HttpResponse.json<CategoryList>({ items: categories }))),

  ...both("/cases").map((p) => http.get(p, async ({ request }) => {
    await delay(300);   // 진행 표시가 보이도록 약간 늦게
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const q = url.searchParams.get("q") ?? "";
    const items = cases.filter((c) => (!status || c.status === status) && (!q || c.receipt_no?.includes(q)));
    return HttpResponse.json<CaseList>({ items, next_cursor: null });
  })),
];
