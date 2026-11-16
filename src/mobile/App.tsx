import { useCallback, useEffect, useState } from "react";
import { api, ApiError, Me } from "@/api/client";
import CaseList from "./CaseList";
import CaseView from "./CaseView";
import NewCase from "./NewCase";
import PhotoView from "./PhotoView";
import { go, useRoute } from "./router";
import Login from "./Login";
import Pair from "./Pair";
import { Hero } from "./Chrome";
import { LogoMark } from "@/shared/brand/Logo";
import Icon from "@/shared/Icon";

type View = { name: "loading" } | { name: "pair"; notice?: string } | { name: "login" } | { name: "cases"; me: Me } | { name: "error"; message: string };

/** 휴대폰 웹 흐름: 미등록 단말 → MO-01 등록 · 로그인 전 → MO-02 시험자 + PIN · 로그인됨 → MO-03 목록 */
export default function App() {
  const [view, setView] = useState<View>({ name: "loading" });
  const route = useRoute();
  const pairCode = new URLSearchParams(location.search).get("code") ?? "";

  const check = useCallback(() => {
    api<Me>("/sessions/me")
      .then((me) => setView({ name: "cases", me }))
      .catch((e: ApiError) => {
        if (e.code === "CLIENT_UNKNOWN") setView({ name: "pair" });
        else if (e.code === "CLIENT_REVOKED") setView({ name: "pair", notice: e.message });   // 노트북에서 해제된 단말: 다시 등록
        else if (e.code === "SESSION_REQUIRED") setView({ name: "login" });
        else setView({ name: "error", message: e.message });
      });
  }, []);
  useEffect(check, [check]);

  const afterPair = () => {
    if (location.pathname !== "/" || location.search) history.replaceState(null, "", "/");   // QR 링크의 코드는 주소창에서 지운다
    check();
  };
  const logout = async () => {
    await api("/sessions", { method: "DELETE" }).catch(() => {});
    setView({ name: "login" });
  };

  switch (view.name) {
    case "loading":
      return (
        <div className="m-screen">
          <main className="m-body boot" role="status"><LogoMark size={72} spin /><span>연결 중…</span></main>
        </div>
      );
    case "error":
      return (
        <div className="m-screen">
          <Hero />
          <main className="m-body">
            <div className="card err-box" role="alert">
              <div className="err-row"><Icon name="wifiOff" /><p>{view.message}</p></div>
              <button className="btn" onClick={check}><Icon name="refresh" size={18} />다시 시도</button>
            </div>
          </main>
        </div>
      );
    case "pair":
      return <Pair initialCode={pairCode} notice={view.notice} onDone={afterPair} />;
    case "login":
      return <Login onDone={check} />;
    case "cases":
      if (route.name === "new") return <NewCase />;
      if (route.name === "case") return <CaseView id={route.id} />;
      if (route.name === "photo") return <PhotoView id={route.id} />;
      return (
        <div className="m-screen">
          <Hero right={
            <details className="who">
              <summary><span className="avatar sm"><Icon name="user" size={18} /></span><b>{view.me.tester?.name ?? "시험자"}</b> ▾</summary>
              <div className="who-menu card">
                <div className="muted small dev"><Icon name="phone" size={16} />{view.me.client?.device_name}</div>
                <button className="btn" onClick={logout}><Icon name="logout" size={18} />로그아웃 (다른 시험자)</button>
              </div>
            </details>
          }>
            <div className="hero-split">
              <div>
                <h2>접수 건</h2>
                <p>건을 눌러 항목별로 사진을 찍으세요</p>
              </div>
              <button className="btn on-hero" onClick={() => go("/new")}><Icon name="plus" size={20} stroke={2.6} />새 건</button>
            </div>
          </Hero>
          <main className="m-body">
            <CaseList />
          </main>
        </div>
      );
  }
}
