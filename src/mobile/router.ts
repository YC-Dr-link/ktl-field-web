import { useEffect, useState } from "react";

/**
 * 아주 작은 주소 라우터. 휴대폰 [뒤로] 버튼이 앱을 닫지 않고 앞 화면으로 가게 history를 쓴다.
 *   /            MO-03 접수 건 목록
 *   /new         MO-03 새 건 → MO-04 분류
 *   /cases/:id   MO-05 촬영 체크리스트
 * 서버(B-1)는 이 주소들로 바로 들어와도 index.html을 줘야 한다.
 */
export type Route = { name: "list" } | { name: "new" } | { name: "case"; id: string };

export function parse(path: string): Route {
  const m = /^\/cases\/([^/]+)\/?$/.exec(path);
  if (m) return { name: "case", id: decodeURIComponent(m[1]) };
  if (path === "/new") return { name: "new" };
  return { name: "list" };
}

export function go(path: string, replace = false) {
  if (replace) history.replaceState(null, "", path);
  else history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(location.pathname));
  useEffect(() => {
    const on = () => {
      setRoute(parse(location.pathname));
      window.scrollTo(0, 0);
    };
    window.addEventListener("popstate", on);
    return () => window.removeEventListener("popstate", on);
  }, []);
  return route;
}
