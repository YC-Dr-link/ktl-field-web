/**
 * MSW 목업 — 서버(B-1) 완성 전 개발용. 개발 서버에서만 켜진다 (빌드 결과에는 안 들어감).
 * 오류는 서버 형식 `{ error: { code, message } }` 그대로 흉내 낸다 (02 §1.1).
 *
 * 시험용 값 (전부 가짜)
 *   등록 코드: 483920 = 성공 · 000000 = 만료(410) · 그 밖 = 틀림(400). 관리 화면에서 발급하면 483920
 *   PIN: 시험자A 1234 · 시험자B 5678 · 시험자C는 처음부터 잠김. 5회 틀리면 10분 잠김
 *   ?mock=flaky : 사진 업로드의 20%를 일부러 끊는다 (재시도 확인용)
 */
import { delay, http, HttpResponse } from "msw";
import type { Case, CaseList, CategoryList, CaseSummary, Client, Me, Photo, Schemas, Tester, TesterList } from "@/api/client";
import { caseDetail, cases, categories } from "./data";
import { addPhoto, emitValues, itemStatus, onEvent, photos } from "./photos";
import { isLocked, load, MockState, save } from "./state";

const PHONE = "/api/v1";
const ADMIN = "/api/admin/v1";
const both = (path: string) => [PHONE + path, ADMIN + path];
const LOCK_MIN = 10;
const MAX_FAILS = 5;
const PAIR_CODE = "483920";

const fail = (status: number, code: string, message: string, detail?: object) =>
  HttpResponse.json({ error: { code, message, ...(detail ? { detail } : {}) } }, { status });

/** 휴대폰 API는 등록된 단말(ktl_client) + 로그인(ktl_session)이 있어야 한다. 관리 API(127.0.0.1)는 로그인 없음 */
function guard(url: string, needSession = true) {
  if (new URL(url, location.origin).pathname.startsWith(ADMIN)) return null;
  const s = load();
  if (s.revoked) return fail(403, "CLIENT_REVOKED", "노트북에서 해제된 휴대폰입니다. 등록 코드를 받아 다시 등록하세요.");
  if (!s.client) return fail(401, "CLIENT_UNKNOWN", "등록되지 않은 휴대폰입니다. 노트북에서 등록 코드를 받아 등록하세요.");
  if (needSession && !s.testerId) return fail(401, "SESSION_REQUIRED", "시험자를 선택하고 PIN을 입력하세요.");
  return null;
}

const findCase = (s: MockState, id: string) => s.created.find((x) => x.id === id) ?? cases.find((x) => x.id === id);
const publicTester = (s: MockState, t: Tester): Tester => ({ ...t, locked: isLocked(s, t) });

export const handlers = [
  // ───────── 단말 · 로그인 (휴대폰) ─────────
  http.post(`${PHONE}/clients/pair`, async ({ request }) => {
    await delay(300);
    const b = (await request.json()) as { pair_code?: string; device_name?: string };
    if (b.pair_code === "000000") return fail(410, "PAIR_CODE_EXPIRED", "코드가 만료되었습니다. 노트북에서 새 코드를 받으세요");
    if (b.pair_code !== PAIR_CODE) return fail(400, "VALIDATION", "등록 코드가 맞지 않습니다. 노트북 화면의 6자리를 다시 확인하세요.");
    const client: Client = { client_id: "cl_1", device_name: b.device_name || "현장폰", paired_at: new Date().toISOString(), last_seen_at: new Date().toISOString() };
    save({ ...load(), client, revoked: false });
    return HttpResponse.json<Client>(client);
  }),

  ...both("/testers").map((p) => http.get(p, ({ request }) => {
    const g = guard(request.url, false);
    if (g) return g;
    const s = load();
    const admin = p.startsWith(ADMIN);   // 관리 화면은 비활성까지 모두
    return HttpResponse.json<TesterList>({ items: s.testers.filter((t) => admin || t.active !== false).map((t) => publicTester(s, t)) });
  })),

  http.post(`${PHONE}/sessions`, async ({ request }) => {
    await delay(250);
    const g = guard(request.url, false);
    if (g) return g;
    const s = load();
    const b = (await request.json()) as { tester_id: string; pin: string };
    const t = s.testers.find((x) => x.id === b.tester_id && x.active !== false);
    if (!t) return fail(404, "NOT_FOUND", "시험자를 찾지 못했습니다.");
    if (isLocked(s, t))
      return fail(423, "PIN_LOCKED", `PIN ${MAX_FAILS}회 실패로 ${LOCK_MIN}분간 잠겼습니다. 노트북 담당에게 잠금 해제를 요청하세요`,
        { retry_after: Math.max(0, Math.round(((s.lockedUntil[t.id!] ?? 0) - Date.now()) / 1000)) });
    if (s.pins[t.id!] !== b.pin) {
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
    return HttpResponse.json({ tester: publicTester(s, t), expires_at: new Date(Date.now() + 12 * 3600_000).toISOString() });
  }),

  http.delete(`${PHONE}/sessions`, () => {
    save({ ...load(), testerId: null });
    return new HttpResponse(null, { status: 204 });
  }),

  ...both("/sessions/me").map((p) => http.get(p, ({ request }) => {
    const s = load();
    if (p.startsWith(ADMIN)) return HttpResponse.json<Me>({ tester: s.testers[0] });
    const g = guard(request.url);
    if (g) return g;
    return HttpResponse.json<Me>({ client: s.client!, tester: s.testers.find((t) => t.id === s.testerId) });
  })),

  // ───────── 분류 · 접수 건 ─────────
  ...both("/categories").map((p) => http.get(p, () => HttpResponse.json<CategoryList>({ items: categories }))),

  ...both("/cases").map((p) => http.get(p, async ({ request }) => {
    const g = guard(request.url);
    if (g) return g;
    await delay(300);   // 진행 표시가 보이도록 약간 늦게
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const q = url.searchParams.get("q") ?? "";
    const all: CaseSummary[] = [...load().created, ...cases];
    const items = all.filter((c) => (!status || c.status === status) && (!q || c.receipt_no?.includes(q)));
    return HttpResponse.json<CaseList>({ items, next_cursor: null });
  })),

  http.post(`${PHONE}/cases`, async ({ request }) => {
    const g = guard(request.url);
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

  ...both("/cases/:id").map((p) => http.get(p, async ({ params, request }) => {
    const g = guard(request.url);
    if (g) return g;
    await delay(200);
    const c = findCase(load(), String(params.id));
    if (!c) return fail(404, "NOT_FOUND", "접수 건을 찾지 못했습니다.");
    return HttpResponse.json<Case>(withPhotos(caseDetail(c, (c as { options?: Record<string, string> }).options ?? {})));
  })),

  // ───────── 사진 ─────────
  http.post(`${PHONE}/cases/:id/photos`, async ({ request, params }) => {
    const g = guard(request.url);
    if (g) return g;
    if (flaky() && Math.random() < 0.2) return HttpResponse.error();   // 연결 끊김 흉내
    const fd = await request.formData();
    const uid = String(fd.get("client_upload_id") ?? "");
    const dup = [...photos.values()].find((x) => (x as { uid?: string }).uid === uid);
    if (dup) return fail(409, "DUPLICATE_UPLOAD", "이미 받은 사진입니다.", { photo: dup });
    const c = findCase(load(), String(params.id));
    if (!c) return fail(404, "NOT_FOUND", "접수 건을 찾지 못했습니다.");
    const file = fd.get("file");
    if (file instanceof Blob && file.size > 20 * 1024 * 1024) return fail(413, "FILE_TOO_LARGE", "사진이 20 MB를 넘습니다.");
    const ph = addPhoto(String(params.id), c.category ?? "", Number(fd.get("unit_index")), String(fd.get("item_key")), file instanceof Blob ? file : new Blob());
    Object.assign(ph, { uid });
    return HttpResponse.json<Photo>(strip(ph), { status: 202 });
  }),

  ...both("/photos/:id").map((p) => http.get(p, ({ params }) => {
    const ph = photos.get(String(params.id));
    return ph ? HttpResponse.json<Photo>(strip(ph)) : fail(404, "NOT_FOUND", "사진을 찾지 못했습니다.");
  })),

  ...both("/photos/:id/values").map((p) => http.patch(p, async ({ request, params }) => {
    await delay(300);
    const ph = photos.get(String(params.id));
    if (!ph) return fail(404, "NOT_FOUND", "사진을 찾지 못했습니다.");
    const b = (await request.json()) as { values?: { key: string; value: string; reason?: string }[]; confirm?: boolean };
    const sent = new Map((b.values ?? []).map((v) => [v.key, v]));
    const vals = ph.values ?? [];
    if (b.confirm && vals.every((v) => v.status === "confirmed" || v.status === "edited")) return fail(409, "ALREADY_CONFIRMED", "이미 확정된 값입니다.");
    for (const v of vals) {
      const n = sent.get(v.key);
      if (b.confirm && v.status === "needs_check" && !n) return fail(400, "VALIDATION", `${v.label} 값을 확인해 주세요.`);
      if (n && n.value !== v.value && !n.reason?.trim()) return fail(400, "VALIDATION", `${v.label}: 값을 바꾸면 사유가 필요합니다.`);
    }
    const now = new Date().toISOString();
    ph.values = vals.map((v) => {
      const n = sent.get(v.key);
      const edited = !!n && n.value !== v.value;
      return { ...v, value: n?.value ?? v.value, status: b.confirm ? (edited ? "edited" : "confirmed") : edited ? "edited" : v.status,
        confirmed_by: b.confirm ? "ts_1" : v.confirmed_by, confirmed_at: b.confirm ? now : v.confirmed_at };
    });
    emitValues(ph.id ?? "", ph.case_id ?? "");
    return HttpResponse.json<Photo>(strip(ph));
  })),

  ...both("/photos/:id/image").map((p) => http.get(p, ({ params }) => {
    const ph = photos.get(String(params.id));
    if (!ph?.blob) return fail(404, "NOT_FOUND", "사진을 찾지 못했습니다.");
    return new HttpResponse(ph.blob, { headers: { "Content-Type": ph.blob.type || "image/jpeg" } });
  })),

  ...both("/events").map((p) => http.get(p, () => {
    // SSE 흉내: 판독 상태가 바뀔 때마다 "event: 이름 / data: JSON / 빈 줄"
    const enc = new TextEncoder();
    let off = () => {};
    const stream = new ReadableStream({
      start(ctl) {
        ctl.enqueue(enc.encode(": connected\n\n"));
        off = onEvent((name, data) => ctl.enqueue(enc.encode(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`)));
      },
      cancel() {
        off();
      },
    });
    return new HttpResponse(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
  })),

  // ───────── 관리 전용 (127.0.0.1:8766) ─────────
  http.post(`${ADMIN}/pair-codes`, async () => {
    await delay(200);
    const url = `http://192.168.8.10:8765/pair?code=${PAIR_CODE}`;
    return HttpResponse.json({ code: PAIR_CODE, expires_at: new Date(Date.now() + 5 * 60_000).toISOString(), qr_svg: fakeQr(url) }, { status: 201 });
  }),

  http.get(`${ADMIN}/clients`, () => {
    const s = load();
    return HttpResponse.json({ items: [...(s.client ? [s.client] : []), ...s.otherClients] });
  }),

  http.delete(`${ADMIN}/clients/:id`, ({ params }) => {
    const s = load();
    if (s.client?.client_id === params.id) save({ ...s, client: null, revoked: true, testerId: null });
    else save({ ...s, otherClients: s.otherClients.filter((c) => c.client_id !== params.id) });
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${ADMIN}/testers`, async ({ request }) => {
    const b = (await request.json()) as { name?: string; pin?: string };
    if (!b.name?.trim()) return fail(400, "VALIDATION", "이름을 적어 주세요.");
    if (!/^\d{4,6}$/.test(b.pin ?? "")) return fail(400, "VALIDATION", "PIN은 숫자 4~6자리입니다.");
    const s = load();
    const t: Tester = { id: `ts_${10 + s.testers.length}`, name: b.name.trim(), locked: false, active: true };
    save({ ...s, testers: [...s.testers, t], pins: { ...s.pins, [t.id!]: b.pin! } });
    return HttpResponse.json<Tester>(t, { status: 201 });
  }),

  http.patch(`${ADMIN}/testers/:id`, async ({ request, params }) => {
    const b = (await request.json()) as { name?: string; pin?: string; unlock?: boolean; active?: boolean };
    const s = load();
    const t = s.testers.find((x) => x.id === params.id);
    if (!t) return fail(404, "NOT_FOUND", "시험자를 찾지 못했습니다.");
    if (b.pin !== undefined && !/^\d{4,6}$/.test(b.pin)) return fail(400, "VALIDATION", "PIN은 숫자 4~6자리입니다.");
    const next: Tester = { ...t, ...(b.name ? { name: b.name } : {}), ...(b.active !== undefined ? { active: b.active } : {}), ...(b.unlock ? { locked: false } : {}) };
    save({ ...s, testers: s.testers.map((x) => (x.id === t.id ? next : x)), pins: b.pin ? { ...s.pins, [t.id!]: b.pin } : s.pins,
      lockedUntil: b.unlock ? { ...s.lockedUntil, [t.id!]: 0 } : s.lockedUntil, fails: b.unlock || b.pin ? { ...s.fails, [t.id!]: 0 } : s.fails });
    return HttpResponse.json<Tester>(publicTester(load(), next));
  }),

  http.get(`${ADMIN}/settings`, () => HttpResponse.json<Schemas["Settings"]>(load().settings)),
  http.put(`${ADMIN}/settings`, async ({ request }) => {
    const b = (await request.json()) as Schemas["Settings"];
    const s = load();
    save({ ...s, settings: { ...s.settings, ...b } });
    return HttpResponse.json<Schemas["Settings"]>(load().settings);
  }),

  http.post(`${ADMIN}/cases/:id/exports`, async ({ request, params }) => {
    const b = (await request.json()) as { kind?: string; format?: string; encoding?: string; include_photos?: boolean };
    const c = findCase(load(), String(params.id));
    if (!c) return fail(404, "NOT_FOUND", "접수 건을 찾지 못했습니다.");
    const id = `ex_${exports.size + 1}`;
    const ex: Schemas["Export"] & { encoding?: string; include_photos?: boolean } = { id, case_id: c.id, kind: b.kind, format: b.format, status: "queued", file_name: null, preview: null, skipped_unconfirmed: 0, encoding: b.encoding, include_photos: b.include_photos };
    exports.set(id, ex);
    setTimeout(() => Object.assign(ex, { status: "running" }), 300);
    setTimeout(() => Object.assign(ex, buildExport(c, b.format ?? "csv", !!b.include_photos)), 1200);
    return HttpResponse.json<Schemas["Export"]>(ex, { status: 202 });
  }),

  http.get(`${ADMIN}/exports/:id`, ({ params }) => {
    const ex = exports.get(String(params.id));
    return ex ? HttpResponse.json<Schemas["Export"]>(ex) : fail(404, "NOT_FOUND", "내보내기를 찾지 못했습니다.");
  }),

  http.get(`${ADMIN}/exports/:id/download`, ({ params }) => {
    const ex = exports.get(String(params.id));
    if (!ex || ex.status !== "done" || !ex.preview) return fail(404, "NOT_FOUND", "아직 파일이 없습니다.");
    const sep = ex.format === "txt" ? "\t" : ",";
    const lines = [ex.preview.columns ?? [], ...(ex.preview.rows ?? [])].map((r) => (r as unknown[]).map((x) => (x == null ? "" : String(x))).join(sep));
    // 목업은 UTF-8(BOM)로 준다 — 진짜 서버는 설정한 인코딩(cp949 기본)으로
    return new HttpResponse("﻿" + lines.join("\r\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${ex.file_name}"` } });
  }),
];

const exports = new Map<string, Schemas["Export"] & { encoding?: string; include_photos?: boolean }>();

/** 미리보기: 기기 1대 = 1행, 칼럼 = categories.yaml export. 확정되지 않은 칸은 null(빈칸)로 빼고 개수를 센다 */
function buildExport(c: CaseSummary, format: string, includePhotos: boolean): Partial<Schemas["Export"]> {
  const cols = categories.find((x) => x.category === c.category)?.export ?? [];
  let skipped = 0;
  const rows = Array.from({ length: c.unit_count ?? 1 }, (_, i) => cols.map((col) => {
    const [item, key] = col.split(".");
    const list = [...photos.values()].filter((p) => p.case_id === c.id && p.unit_index === i + 1 && p.status !== "deleted");
    if (col === "photo_first") return list[0]?.stored_name ?? null;
    const v = list.filter((p) => p.item_key === item).at(-1)?.values?.find((x) => x.key === key);
    if (v && (v.status === "confirmed" || v.status === "edited")) return v.value;
    skipped++;
    return null;
  }));
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15).replace("T", "-");
  const ext = includePhotos ? "zip" : format;
  return { status: "done", preview: { columns: cols, rows }, skipped_unconfirmed: skipped, file_name: `${c.receipt_no}_${c.category}_${stamp}.${ext}` };
}

/** 목업 QR 그림 (진짜 QR이 아니다 — 서버는 진짜 QR SVG를 준다). 화면 자리 · 크기 확인용 */
function fakeQr(text: string): string {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const n = 25;
  let cells = "";
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const corner = (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
    const on = corner ? (x % 6 === 0 || y % 6 === 0 || (x % 6 >= 2 && x % 6 <= 4 && y % 6 >= 2 && y % 6 <= 4)) : ((h >> ((x * 7 + y * 13) % 31)) & 1) === 1;
    if (on) cells += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
    h = (h * 1103515245 + 12345) >>> 0;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 ${n + 4} ${n + 4}" shape-rendering="crispEdges"><rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="#fff"/><g fill="#000">${cells}</g></svg>`;
}

function strip(ph: Photo & { blob?: Blob }): Photo {
  const { blob: _b, ...out } = ph;
  void _b;
  return out;
}

function flaky() {
  try {
    return new URLSearchParams(location.search).get("mock") === "flaky" || sessionStorage.getItem("ktl_mock_flaky") === "1";
  } catch {
    return false;
  }
}

/** 업로드한 사진의 판독 상태를 접수 건 항목에 덮어쓴다 */
function withPhotos(c: Case): Case {
  return {
    ...c,
    units: c.units?.map((u) => ({
      ...u,
      items: u.items?.map((it) => {
        const st = itemStatus(c.id ?? "", u.index ?? 0, it.key ?? "");
        return st ? { ...it, status: st.status as NonNullable<typeof it.status>, photo_id: st.photo_id } : it;
      }),
    })),
  };
}
