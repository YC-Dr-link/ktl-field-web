import { useEffect, useState } from "react";
import { api, ApiError, Me } from "@/api/client";
import CaseList from "./CaseList";

/** 휴대폰 웹 (MO-01~06). 지금은 MO-03 접수 건 목록까지 — 단말 등록 · PIN(MO-01·02)은 #3에서. */
export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<Me>("/sessions/me").then(setMe).catch((e: ApiError) => setErr(e.message));
  }, []);

  return (
    <div className="m-screen">
      <header className="m-bar">
        <b>{me?.tester?.name ?? "현장 사진"}</b>
        <button className="btn primary" disabled title="다음 작업(MO-03 새 건)에서 연결">+ 새 건</button>
      </header>
      <main className="m-body">
        {err && <div className="card err-box">{err}</div>}
        <CaseList />
      </main>
    </div>
  );
}
