/**
 * 사진 업로드 큐 (REQ-B2-04). 찍자마자 큐에 넣고 한 장씩 보낸다 — 시험자는 기다리지 않고 다음 줄을 찍는다.
 * - 사진마다 client_upload_id(UUID): 다시 보내도 서버가 한 장만 저장한다 (409 DUPLICATE_UPLOAD + 기존 사진)
 * - 끊기면 자동 재시도 3회 (3초 → 10초 → 30초, Wi-Fi가 다시 붙으면 바로). 그래도 안 되면 "실패 · 다시 보내기"
 * - 원본 해상도 그대로 보낸다 (줄이지 않음)
 */
import { API_BASE, Photo } from "./client";

export type UploadState = "waiting" | "sending" | "failed" | "done";
export interface Upload {
  localId: string;
  caseId: string;
  unitIndex: number;
  itemKey: string;
  clientUploadId: string;
  file: Blob;
  thumbUrl: string;
  state: UploadState;
  progress: number;   // 0~100
  attempts: number;
  error: string | null;
  retryAt: number | null;   // 자동 재시도 예정 시각 (없으면 사람이 [다시 보내기])
  photo: Photo | null;
}

const RETRY_MS = [3_000, 10_000, 30_000];
const MAX_BYTES = 20 * 1024 * 1024;
let queue: Upload[] = [];
let running = false;
const subs = new Set<() => void>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function emit() {
  queue = [...queue];
  subs.forEach((f) => f());
}
export function subscribe(f: () => void) {
  subs.add(f);
  return () => subs.delete(f);
}
export const snapshot = () => queue;

function uuid(): string {
  const c: Crypto = globalThis.crypto;
  // HTTP(에그 Wi-Fi)는 보안 연결이 아니라서 randomUUID가 없는 브라우저가 있다 — 그때는 getRandomValues로 v4
  if (typeof c.randomUUID === "function" && window.isSecureContext) return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** 찍은 사진을 큐에 넣는다. 같은 칸의 이전(아직 안 보낸) 사진은 버린다 — 새 사진이 그 칸 */
export function enqueue(caseId: string, unitIndex: number, itemKey: string, file: Blob): Upload {
  for (const u of queue.filter((x) => x.caseId === caseId && x.unitIndex === unitIndex && x.itemKey === itemKey && x.state !== "done")) drop(u.localId);
  const u: Upload = {
    localId: uuid(), caseId, unitIndex, itemKey, clientUploadId: uuid(), file, thumbUrl: URL.createObjectURL(file),
    state: file.size > MAX_BYTES ? "failed" : "waiting", progress: 0, attempts: 0,
    error: file.size > MAX_BYTES ? "사진이 20 MB를 넘어요. 다시 찍어 주세요." : null, retryAt: null, photo: null,
  };
  queue.push(u);
  emit();
  pump();
  return u;
}

export function retry(localId: string) {
  const u = queue.find((x) => x.localId === localId);
  if (!u || u.state === "done" || u.file.size > MAX_BYTES) return;
  clearTimeout(timers.get(localId));
  Object.assign(u, { state: "waiting", attempts: 0, error: null, progress: 0, retryAt: null });
  emit();
  pump();
}

function drop(localId: string) {
  const u = queue.find((x) => x.localId === localId);
  if (u) URL.revokeObjectURL(u.thumbUrl);
  clearTimeout(timers.get(localId));
  queue = queue.filter((x) => x.localId !== localId);
}

/** 이 건에서 아직 끝나지 않은 업로드 (화면 아래 "업로드 대기 n · 실패 m") */
export function pending(caseId: string) {
  const mine = queue.filter((u) => u.caseId === caseId);
  return { waiting: mine.filter((u) => u.state === "waiting" || u.state === "sending" || (u.state === "failed" && u.retryAt)).length,
    failed: mine.filter((u) => u.state === "failed" && !u.retryAt).length };
}

async function pump() {
  if (running) return;
  running = true;
  try {
    for (;;) {
      const u = queue.find((x) => x.state === "waiting");
      if (!u) break;
      await send(u);
    }
  } finally {
    running = false;
  }
}

function send(u: Upload): Promise<void> {
  return new Promise((resolve) => {
    u.state = "sending";
    u.retryAt = null;
    u.progress = 0;
    u.attempts += 1;
    emit();
    const fd = new FormData();
    fd.append("file", u.file, `${u.itemKey}.jpg`);
    fd.append("unit_index", String(u.unitIndex));
    fd.append("item_key", u.itemKey);
    fd.append("client_upload_id", u.clientUploadId);
    const xhr = new XMLHttpRequest();   // fetch는 업로드 진행률을 못 준다
    xhr.open("POST", `${API_BASE}/cases/${encodeURIComponent(u.caseId)}/photos`);
    xhr.withCredentials = true;
    xhr.setRequestHeader("Accept", "application/json");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        u.progress = Math.min(99, Math.round((e.loaded / e.total) * 100));
        emit();
      }
    };
    const finish = (ok: boolean, photo: Photo | null, err: string | null, retryable: boolean) => {
      if (ok) Object.assign(u, { state: "done", progress: 100, photo, error: null });
      else if (retryable && u.attempts <= RETRY_MS.length) {
        const wait = RETRY_MS[u.attempts - 1];
        Object.assign(u, { state: "failed", error: err, retryAt: Date.now() + wait });
        timers.set(u.localId, setTimeout(() => retryIfFailed(u.localId), wait));
      } else Object.assign(u, { state: "failed", error: err, retryAt: null });
      emit();
      resolve();
    };
    xhr.onload = () => {
      let body: { error?: { code?: string; message?: string; detail?: { photo?: Photo } } } & Partial<Photo> = {};
      try {
        body = JSON.parse(xhr.responseText || "{}");
      } catch {
        /* 본문 없음 */
      }
      if (xhr.status === 202 || xhr.status === 200 || xhr.status === 201) return finish(true, body as Photo, null, false);
      if (xhr.status === 409 && body.error?.code === "DUPLICATE_UPLOAD") return finish(true, body.error.detail?.photo ?? null, null, false);   // 이미 받은 사진
      const msg = body.error?.message ?? `업로드 실패 (${xhr.status})`;
      finish(false, null, msg, xhr.status >= 500 || xhr.status === 0 || xhr.status === 408 || xhr.status === 429);
    };
    xhr.onerror = () => finish(false, null, "연결이 끊겼어요. 다시 보내는 중…", true);
    xhr.ontimeout = xhr.onerror;
    xhr.timeout = 120_000;
    xhr.send(fd);
  });
}

function retryIfFailed(localId: string) {
  const u = queue.find((x) => x.localId === localId);
  if (u && u.state === "failed") {
    u.state = "waiting";
    emit();
    pump();
  }
}

// Wi-Fi가 다시 붙으면 기다리던 재시도를 바로
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    for (const u of queue) if (u.state === "failed" && timers.has(u.localId) && u.attempts <= RETRY_MS.length) {
      clearTimeout(timers.get(u.localId));
      retryIfFailed(u.localId);
    }
  });
}
