/**
 * 실시간 알림 (SSE `GET /events`, REQ-B1-07). EventSource는 끊기면 스스로 다시 붙는다.
 * 다시 붙었을 때는 그 사이 놓친 알림이 있을 수 있으니 onReconnect로 화면이 전체를 다시 받게 한다.
 */
import { useEffect, useRef } from "react";
import { API_BASE, type Schemas } from "./client";

export type ServerEvent = Schemas["Event"];
export type EventName = "photo.status" | "photo.values" | "case.updated" | "merge.status" | "export.done";

export function useServerEvents(on: (name: EventName, e: ServerEvent) => void, onReconnect?: () => void) {
  const cb = useRef(on);
  const re = useRef(onReconnect);
  cb.current = on;
  re.current = onReconnect;
  useEffect(() => {
    const es = new EventSource(`${API_BASE}/events`, { withCredentials: true });
    let broken = false;
    const names: EventName[] = ["photo.status", "photo.values", "case.updated", "merge.status", "export.done"];
    const handlers = names.map((n) => {
      const h = (m: MessageEvent) => {
        try {
          cb.current(n, JSON.parse(m.data));
        } catch {
          /* 형식이 다른 알림은 무시 */
        }
      };
      es.addEventListener(n, h as EventListener);
      return [n, h] as const;
    });
    es.onerror = () => {
      broken = true;
    };
    es.onopen = () => {
      if (broken) re.current?.();
      broken = false;
    };
    return () => {
      handlers.forEach(([n, h]) => es.removeEventListener(n, h as EventListener));
      es.close();
    };
  }, []);
}
