import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);

/** 개발 서버에서만 목업을 켠다. 진짜 서버로 붙여 보려면 VITE_MOCK=0 npm run dev */
export async function startMock() {
  await worker.start({ onUnhandledRequest: "bypass", quiet: true });
  console.info("[목업] MSW 켜짐 — /api 응답은 src/mocks 의 가짜 데이터예요");
}
