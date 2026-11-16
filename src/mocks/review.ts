/**
 * 목업: AD-01 "확인 필요" 모아 보기 (GET /review-queue). 확인 필요(needs_check) 값을 한 줄씩 준다.
 * 시연용 사진 · 값은 seed.ts가 미리 넣어 둔다.
 */
import { http, HttpResponse } from "msw";
import { cases } from "./data";
import { photos } from "./photos";
import { seed } from "./seed";
import { load } from "./state";

const ADMIN = "/api/admin/v1";
seed();

export const reviewHandlers = [
  http.get(`${ADMIN}/review-queue`, () => {
    const all = [...load().created, ...cases];
    const items = [...photos.values()]
      .filter((p) => p.status === "done")
      .sort((a, b) => (b.uploaded_at ?? "").localeCompare(a.uploaded_at ?? ""))
      .flatMap((p) => (p.values ?? []).filter((v) => v.status === "needs_check").map((value) => ({
        case_id: p.case_id, receipt_no: all.find((c) => c.id === p.case_id)?.receipt_no, photo_id: p.id, unit_index: p.unit_index, item_key: p.item_key, value,
      })));
    return HttpResponse.json({ items });
  }),
];
