/** 목업: 라돈 파일 (AD-03). 값은 전부 가짜 — (작업 중) */
import type { Schemas } from "@/api/client";
import type { MergeResult } from "./datafiles";

type DataFile = Schemas["DataFile"];

export function detectRadon(name: string): DataFile["detected"] | null {
  if (/chamber|챔버/i.test(name)) return { kind: "radon_chamber", serial: "CH-0001", interval_s: 3600, unit: "Bq/m³", rows: 23 };
  return null;
}

export function radonSeries(_f: DataFile): { columns: string[]; unit: string | null; rows: unknown[][] } {
  return { columns: ["t", "Rn"], unit: "Bq/m³", rows: [] };
}

export function runRadon(_files: DataFile[], _options: Record<string, unknown>): MergeResult {
  return { table: { columns: ["seq"], rows: [] }, warnings: [] };
}
