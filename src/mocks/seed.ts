/**
 * 목업: 관리 화면(AD-01) 시연용으로 미리 올라와 있는 사진 · 판독 값. 전부 가짜.
 * 사진은 진짜 촬영본이 아니라 SVG로 그린 합성 그림 (LCD 화면 · 견본 증명서 · 형식승인표). "견본" 표시를 꼭 넣는다.
 * 값의 bbox는 그림(960×720) 좌표 그대로라 화면에서 그 위치를 잘라 보여 줄 수 있다.
 */
import type { Photo, Value } from "@/api/client";
import { categories } from "./data";
import { photos } from "./photos";

const W = 960;
const H = 720;
type St = "confirmed" | "edited" | "needs_check" | "done" | "failed" | "reading";
type Slot = { case_id: string; unit: number; item: string; st: St; truth?: string; read?: string; conf?: number; by?: string; min: number };

/* ───────── 합성 그림 ───────── */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const svg = (body: string, defs = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${defs}` +
  `<radialGradient id="vig" cx="50%" cy="45%" r="75%"><stop offset="60%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".45"/></radialGradient>` +
  `<filter id="soft"><feGaussianBlur stdDeviation="1.6"/></filter><filter id="shadow" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="14" stdDeviation="14" flood-opacity=".45"/></filter>` +
  `</defs>${body}<rect width="${W}" height="${H}" fill="url(#vig)"/>` +
  `<text x="${W - 18}" y="${H - 16}" text-anchor="end" font-family="sans-serif" font-size="15" fill="#fff" fill-opacity=".55">합성 견본 이미지 · 실제 촬영본 아님</text></svg>`;

const bench = (hue: string) =>
  `<rect width="${W}" height="${H}" fill="${hue}"/>` +
  Array.from({ length: 14 }, (_, i) => `<rect x="0" y="${i * 52}" width="${W}" height="2" fill="#000" fill-opacity=".05"/>`).join("");

/** 유량계 · 먼지측정기 LCD 화면 */
function meterSvg(o: { title: string; main: string; unit: string; sub: string; glare: boolean; blur: boolean; theme: "flow" | "dust" }) {
  const lcd = o.theme === "flow" ? { bg: "#b9d3a0", ink: "#1d2a16" } : { bg: "#0d1f2b", ink: "#7fe0ff" };
  const body = o.theme === "flow" ? "#3b4350" : "#e7e9ec";
  const label = o.theme === "flow" ? "#d6dde6" : "#3b4350";
  const digits = `<text x="676" y="300" text-anchor="end" font-family="'Consolas','DejaVu Sans Mono',monospace" font-weight="700" font-size="92" letter-spacing="4" fill="${lcd.ink}"${o.blur ? ' filter="url(#soft)"' : ""}>${esc(o.main)}</text>`;
  return svg(
    bench(o.theme === "flow" ? "#5b4a3a" : "#4a5560") +
    `<g filter="url(#shadow)" transform="rotate(-1.2 480 360)"><rect x="250" y="70" width="470" height="560" rx="34" fill="${body}"/>` +
    `<rect x="250" y="70" width="470" height="560" rx="34" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="3"/></g>` +
    `<text x="485" y="112" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="22" letter-spacing="3" fill="${label}">${esc(o.title)}</text>` +
    `<rect x="392" y="122" width="186" height="44" rx="6" fill="${lcd.bg}"/>` +
    `<text x="485" y="153" text-anchor="middle" font-family="monospace" font-weight="700" font-size="24" fill="${lcd.ink}">${esc(o.sub)}</text>` +
    `<rect x="300" y="190" width="400" height="140" rx="12" fill="${lcd.bg}" stroke="#000" stroke-opacity=".35" stroke-width="5"/>` +
    digits +
    `<text x="690" y="324" text-anchor="end" font-family="sans-serif" font-weight="700" font-size="20" fill="${lcd.ink}" fill-opacity=".8">${esc(o.unit)}</text>` +
    [0, 1, 2].map((i) => `<circle cx="${370 + i * 115}" cy="430" r="34" fill="${o.theme === "flow" ? "#262c35" : "#c9cdd3"}" stroke="#000" stroke-opacity=".3" stroke-width="3"/>`).join("") +
    ["MODE", "ENTER", "RUN"].map((t, i) => `<text x="${370 + i * 115}" y="490" text-anchor="middle" font-family="sans-serif" font-size="15" font-weight="700" fill="${label}">${t}</text>`).join("") +
    `<rect x="330" y="540" width="310" height="44" rx="8" fill="#000" fill-opacity=".18"/><text x="485" y="569" text-anchor="middle" font-family="sans-serif" font-size="17" fill="${label}">MODEL X-000 · 견본 장비</text>` +
    (o.glare ? `<polygon points="440,170 560,170 420,360 300,360" fill="#fff" fill-opacity=".55"/><polygon points="575,170 610,170 470,360 435,360" fill="#fff" fill-opacity=".35"/>` : `<polygon points="560,190 600,190 520,330 480,330" fill="#fff" fill-opacity=".12"/>`),
  );
}

/** 견본 정도검사 증명서 (필증) */
function certSvg(rows: [string, string][], blurRow: number) {
  const lines = rows.map(([k, v], i) => {
    const y = 250 + i * 70;
    return `<line x1="130" y1="${y + 22}" x2="830" y2="${y + 22}" stroke="#c9ced6" stroke-width="2"/>` +
      `<text x="140" y="${y}" font-family="sans-serif" font-size="26" fill="#4a5361">${esc(k)}</text>` +
      `<text x="380" y="${y}" font-family="'Batang','Noto Serif KR',serif" font-weight="700" font-size="32" fill="#1b2230"${i === blurRow ? ' filter="url(#soft)"' : ""}>${esc(v)}</text>`;
  }).join("");
  return svg(
    bench("#33404f") +
    `<g transform="rotate(-1.5 480 380)" filter="url(#shadow)"><rect x="90" y="40" width="780" height="660" rx="6" fill="#fbfaf6"/></g>` +
    `<rect x="110" y="62" width="740" height="616" fill="none" stroke="#2b5b9b" stroke-width="3"/>` +
    `<text x="480" y="132" text-anchor="middle" font-family="'Batang','Noto Serif KR',serif" font-weight="700" font-size="44" letter-spacing="10" fill="#1b2230">정도검사 증명서</text>` +
    `<text x="480" y="172" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#6b7482">(견본 서식 · 실제 문서 아님)</text>` +
    lines +
    `<text x="140" y="600" font-family="sans-serif" font-size="22" fill="#4a5361">발급일 2025. 10. 00.</text>` +
    `<circle cx="760" cy="585" r="52" fill="none" stroke="#d33" stroke-width="5" stroke-opacity=".75"/><text x="760" y="594" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="26" fill="#d33" fill-opacity=".8">견본</text>` +
    `<text x="480" y="470" text-anchor="middle" transform="rotate(-22 480 470)" font-family="sans-serif" font-weight="800" font-size="120" fill="#d33" fill-opacity=".08">SAMPLE</text>` +
    `<polygon points="600,40 700,40 520,700 420,700" fill="#fff" fill-opacity=".18"/>`,
  );
}

function plateSvg() {
  return svg(
    bench("#4b5563") +
    `<g filter="url(#shadow)"><rect x="200" y="170" width="560" height="380" rx="18" fill="#c4cbd3"/></g>` +
    `<rect x="220" y="190" width="520" height="340" rx="10" fill="none" stroke="#7d8793" stroke-width="3"/>` +
    [[230, 210], [710, 210], [230, 510], [710, 510]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="#8d96a1"/>`).join("") +
    `<text x="480" y="262" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="36" fill="#2b323b">형식승인표 (견본)</text>` +
    ["형식승인번호  ABCD-2020-3", "제 조 사  가나다테크(주)", "제조번호  A100-00xx", "제조연월  2020. 00."].map((t, i) =>
      `<text x="270" y="${330 + i * 50}" font-family="sans-serif" font-size="27" fill="#2b323b">${t}</text>`).join(""),
  );
}

/* ───────── 값 ───────── */
const val = (key: string, label: string, value: string, unit: string | null, confidence: number, bbox: number[], status: Value["status"], by: string | null, at: string | null): Value =>
  ({ key, label, value, unit, confidence, bbox, status, confirmed_by: by, confirmed_at: at });

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
let n = 0;
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

function build(s: Slot): Photo & { blob?: Blob } {
  const cat = categories.find((c) => c.category === caseCat[s.case_id]);
  const reader = cat?.items?.find((i) => i.key === s.item)?.reader ?? "none";
  const h = hash(`${s.case_id}${s.unit}${s.item}`);
  const final = s.st === "confirmed" || s.st === "edited";
  const at = final ? ago(s.min - 2) : null;
  const by = final ? (s.by ?? "ts_1") : null;
  const st = (low: boolean): Value["status"] => (final ? (s.st === "edited" && low ? "edited" : "confirmed") : low ? "needs_check" : "auto");
  const low = s.st === "needs_check" || s.st === "edited";
  let values: Value[] = [];
  let warnings: Photo["warnings"] = [];
  let image = "";

  if (reader === "flowmeter") {
    const truth = s.truth ?? (1 + (h % 13) / 1000).toFixed(3);
    const read = final ? truth : (s.read ?? truth);
    const no = `0${(h % 3) + 1} of 003`;
    values = [val("flow", "유량", read, "L/min", low ? (s.conf ?? 0.68) : 0.94 + (h % 5) / 100, [300, 190, 700, 330], st(low), by, at),
      val("reading_no", "측정 번호", no, null, 0.91, [392, 122, 578, 166], final ? "confirmed" : "auto", by, at)];
    image = meterSvg({ title: "FLOW CALIBRATOR", main: truth, unit: "L/min", sub: no, glare: low, blur: low && !!s.read, theme: "flow" });
  } else if (reader === "cert") {
    const serial = `A100-00${String(10 + (h % 80)).padStart(2, "0")}`;
    const truthRows: [string, string][] = [["직전접수번호", `25-000${100 + (h % 400)}-01`], ["형식승인번호", "ABCD-2020-3"], ["제 조 사", "가나다테크(주)"], ["제조번호", serial]];
    const keys = [["prev_receipt", "직전접수번호"], ["approval_no", "형식승인번호"], ["maker", "제조사"], ["serial", "제조번호"]];
    values = truthRows.map(([, v], i) => {
      const isLow = low && i === 3;
      const shown = isLow && !final ? (s.read ?? v.replace(/0/g, "O").replace("A1OO", "A100")) : v;
      return val(keys[i][0], keys[i][1], shown, null, isLow ? (s.conf ?? 0.64) : 0.9 + (i % 3) / 30, [370, 214 + i * 70, 840, 262 + i * 70], st(isLow), by, at);
    });
    image = certSvg(truthRows, low ? 3 : -1);
  } else if (reader === "dust") {
    const pre = s.item === "span_film" && !final;
    const flow = s.item === "meas_flow";
    const truth = s.truth ?? (flow ? (16.6 + (h % 9) / 100).toFixed(2) : (0.49 + (h % 40) / 1000).toFixed(3));
    const read = final ? truth : (s.read ?? truth);
    values = [val("value", "측정값", pre ? "0.000" : read, flow ? "L/min" : "mg/m³", pre ? 0.6 : low ? (s.conf ?? 0.7) : 0.93, [300, 190, 700, 330], pre ? "needs_check" : st(low), by, at)];
    if (pre) warnings = [{ code: "PRE_MEASURE_SCREEN", message: "측정 전 화면(0.000)일 수 있습니다." }];
    image = meterSvg({ title: flow ? "FLOW · 견본" : "BETA DUST · 견본", main: pre ? "0.000" : truth, unit: flow ? "L/min" : "mg/m3", sub: pre ? "STANDBY" : "CONC", glare: low && !pre, blur: low && !!s.read, theme: "dust" });
  } else {
    image = plateSvg();
  }

  const id = `ph_s${++n}`;
  const failed = s.st === "failed";
  const reading = s.st === "reading";
  return {
    id, case_id: s.case_id, unit_index: s.unit, item_key: s.item, reader, sha256: "fake",
    status: failed ? "failed" : reading ? "reading" : "done",
    stored_name: `20261104_${String(900 + n).padStart(4, "0")}_${s.item}.jpg`, uploaded_by: s.by ?? (n % 3 ? "ts_1" : "ts_2"), uploaded_at: ago(s.min),
    values: failed || reading ? [] : values, warnings, error: failed ? "화면을 찾지 못했습니다" : null, read_ms: failed || reading ? null : 1800 + (h % 900),
    blob: new Blob([image], { type: "image/svg+xml" }),
  };
}

const caseCat: Record<string, string> = { case_12: "sampling", case_14: "sampling", case_16: "sampling", case_15: "dust", case_17: "dust", case_10: "dust" };
const SAMPLING = ["cert", "plate", "prec_1", "prec_2", "prec_3", "flow_1", "flow_2", "flow_3"];
const DUST = ["cert", "plate", "span_film", "span_1", "span_2", "mid_film", "linearity", "meas_flow", "rep_1", "rep_2"];
const row = (case_id: string, unit: number, keys: string[], sts: (St | null)[], min: number, extra: Record<string, Partial<Slot>> = {}): Slot[] =>
  keys.flatMap((item, i) => (sts[i] ? [{ case_id, unit, item, st: sts[i]!, min: min - i * 2, ...extra[item] }] : []));

const C = "confirmed";
const SLOTS: Slot[] = [
  // 26-000125-01 시료채취 3대 — 확인 필요 섞임
  ...row("case_14", 1, SAMPLING, [C, C, C, "needs_check", C, C, "edited", "done"], 58, { prec_2: { truth: "1.007", read: "1.087", conf: 0.62 }, flow_2: { truth: "1.004" } }),
  ...row("case_14", 2, SAMPLING, ["needs_check", "done", C, C, "needs_check", "reading", null, null], 34, { cert: { conf: 0.58 }, prec_3: { truth: "1.011", conf: 0.74, by: "ts_2" } }),
  ...row("case_14", 3, SAMPLING, ["done", "done", "failed", null, null, null, null, null], 14),
  // 26-000126-01 먼지 2대
  ...row("case_15", 1, DUST, [C, C, "needs_check", C, "needs_check", "done", "done", "needs_check", null, null], 46, { span_2: { truth: "0.512", read: "0.572", conf: 0.66 }, meas_flow: { truth: "16.67", read: "16.57", conf: 0.71 } }),
  ...row("case_15", 2, DUST, ["done", "done", null, null, null, null, null, null, null, null], 22),
  // 26-000128-01 먼지 1대 — 확정만 남음
  ...row("case_17", 1, DUST, ["done", "done", "done", "done", "done", "done", "done", "done", "done", "needs_check"], 120, { rep_2: { truth: "0.498", conf: 0.77 } }),
  // 26-000123-01 2번 기기 (1번 기기는 휴대폰 시연용으로 비워 둔다)
  ...row("case_12", 2, SAMPLING, [C, C, "needs_check", null, null, null, null, null], 9, { prec_1: { truth: "1.002", read: "1.802", conf: 0.55, by: "ts_2" } }),
  // 완료 건
  ...row("case_16", 1, SAMPLING, [C, C, C, C, "edited", C, C, C], 60 * 21),
  ...row("case_10", 1, DUST, [C, C, C, C, C, C, C, C, C, C], 60 * 27),
];

let seeded = false;
export function seed() {
  if (seeded) return;
  seeded = true;
  for (const s of SLOTS) {
    const p = build(s);
    photos.set(p.id!, p);
  }
}
