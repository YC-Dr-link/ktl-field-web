/** 목업: 가스 GL240 로거 파일 (AD-02). 값은 전부 가짜 — (작업 중) */
import type { Schemas } from "@/api/client";
import type { MergeResult } from "./datafiles";

type DataFile = Schemas["DataFile"];

export function detectGas(name: string): DataFile["detected"] | null {
  if (!/gl240/i.test(name)) return null;
  const sec = /1s|1sec|1초/i.test(name);
  return { kind: "gas_gl240", interval_s: sec ? 1 : 60, unit: "PPB", rows: sec ? 1200 : 1440 };
}

export function gasSeries(_f: DataFile): { columns: string[]; unit: string | null; rows: unknown[][] } {
  return { columns: ["t", "CH1"], unit: "PPB", rows: [] };
}

export function runGas(_files: DataFile[], _options: Record<string, unknown>): MergeResult {
  return { table: { columns: ["code"], rows: [] }, warnings: [] };
}
