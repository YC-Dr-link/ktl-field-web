import { rmSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * 화면 두 개를 따로 빌드한다 (서버가 각자 다른 주소에서 준다).
 *   --mode mobile → dist/mobile  (휴대폰 :8765/)
 *   --mode admin  → dist/admin   (노트북 127.0.0.1:8766/)
 * 개발 서버는 각 API로 요청을 넘긴다.
 */
const APPS = {
  mobile: { port: 5173, api: "/api/v1", target: "http://127.0.0.1:8765" },
  admin: { port: 5174, api: "/api/admin/v1", target: "http://127.0.0.1:8766" },
} as const;

export default defineConfig(({ mode }) => {
  const name = mode === "admin" ? "admin" : "mobile";
  const app = APPS[name];
  return {
    plugins: [
      react(),
      // MSW 목업 워커는 개발 서버에서만 쓴다 — 빌드 결과(현장 배포)에서는 뺀다
      { name: "drop-mock-worker", apply: "build", closeBundle: () => rmSync(resolve(__dirname, "dist", name, "mockServiceWorker.js"), { force: true }) },
    ],
    root: resolve(__dirname, "src", name),
    publicDir: resolve(__dirname, "public"),
    envDir: __dirname,
    resolve: { alias: { "@": resolve(__dirname, "src") } },
    build: { outDir: resolve(__dirname, "dist", name), emptyOutDir: true },
    server: { host: "127.0.0.1", port: app.port, strictPort: true, proxy: { [app.api]: app.target } },
  };
});
