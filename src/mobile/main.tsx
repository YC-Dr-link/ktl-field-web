import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "@/shared/base.css";
import "./mobile.css";

async function boot() {
  // 서버 완성 전: 개발 서버에서는 MSW 목업으로 돌린다 (빌드 결과에는 이 코드가 빠진다)
  if (import.meta.env.DEV && import.meta.env.VITE_MOCK !== "0") {
    const { startMock } = await import("@/mocks/browser");
    await startMock();
  }
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

boot();
