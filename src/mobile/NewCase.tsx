import { useEffect, useState } from "react";
import { api, ApiError, Case, Category, CategoryList } from "@/api/client";
import Keypad, { applyKey } from "@/shared/Keypad";
import { go } from "./router";

/** 숫자만 받아 NN-NNNNNN-NN 모양으로 (`-` 자동) */
export function formatReceipt(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 10);
  return [d.slice(0, 2), d.slice(2, 8), d.slice(8, 10)].filter(Boolean).join("-");
}
const RECEIPT = /^\d{2}-\d{6}-\d{2}$/;
const MAX_UNITS = 50;

/** categories.yaml의 phone: false(가스 · 라돈)는 휴대폰에서 고르지 않는다.
 *  TODO(확인 필요): OpenAPI Category 스키마에 phone 칸이 없다 — 없으면 보여 준다 */
const onPhone = (c: Category) => (c as Category & { phone?: boolean }).phone !== false;

/** MO-03 새 건(접수번호 · 기기 대수) → MO-04 분류 · 옵션 → [만들기] → MO-05 (03 시나리오 B-3 · B-4) */
export default function NewCase() {
  const [step, setStep] = useState<1 | 2>(1);
  const [digits, setDigits] = useState("");
  const [units, setUnits] = useState(1);
  const [cats, setCats] = useState<Category[] | null>(null);
  const [cat, setCat] = useState<Category | null>(null);
  const [opts, setOpts] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const receipt = formatReceipt(digits);
  const receiptOk = RECEIPT.test(receipt);
  const optsOk = !!cat && (cat.options ?? []).every((o) => !!opts[o.key ?? ""]);

  useEffect(() => {
    if (step === 2 && !cats) api<CategoryList>("/categories").then((r) => setCats((r.items ?? []).filter(onPhone))).catch((e: ApiError) => setErr(e.message));
  }, [step, cats]);

  const pickCat = (c: Category) => {
    setCat(c);
    // 선택지가 하나뿐이면 미리 골라 둔다
    setOpts(Object.fromEntries((c.options ?? []).filter((o) => o.choices?.length === 1).map((o) => [o.key, o.choices![0]])));
  };

  const create = async () => {
    if (!cat || !optsOk || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const c = await api<Case>("/cases", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receipt_no: receipt, category: cat.category, unit_count: units, options: opts }) });
      go(`/cases/${encodeURIComponent(c.id ?? "")}`, true);   // 뒤로 가기로 이 화면에 돌아오지 않게
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (step === 1)
    return (
      <div className="m-screen">
        <header className="m-bar">
          <button className="btn ghost" onClick={() => history.back()}>‹ 목록</button>
          <b>새 건</b>
          <span />
        </header>
        <main className="m-body">
          <div className="field">
            <span>접수번호</span>
            <div className={`receipt${receipt ? "" : " empty"}`}>{receipt || "26-000123-01"}</div>
            <span className="field-msg">{receipt && !receiptOk ? <span className="err-text">접수번호 형식은 26-000123-01 입니다</span> : " "}</span>
          </div>
          <Keypad onKey={(k) => setDigits((d) => applyKey(d, k, 10))} />
          <div className="field">
            <span>기기 대수</span>
            <div className="stepper">
              <button className="btn key" onClick={() => setUnits((u) => Math.max(1, u - 1))} aria-label="한 대 줄이기">−</button>
              <b>{units}대</b>
              <button className="btn key" onClick={() => setUnits((u) => Math.min(MAX_UNITS, u + 1))} aria-label="한 대 늘리기">＋</button>
            </div>
          </div>
          <button className="btn primary big" disabled={!receiptOk} onClick={() => setStep(2)}>다음 ›</button>
        </main>
      </div>
    );

  return (
    <div className="m-screen">
      <header className="m-bar">
        <button className="btn ghost" onClick={() => setStep(1)}>‹ 접수번호</button>
        <b>{receipt} · {units}대</b>
        <span />
      </header>
      <main className="m-body">
        <div className="muted">분류</div>
        {!cats && !err && <div className="card muted loading">불러오는 중…</div>}
        <div className="cat-grid">
          {cats?.map((c) => (
            <button key={c.category} className={`btn cat${cat?.category === c.category ? " on" : ""}`} onClick={() => pickCat(c)}>{c.label}</button>
          ))}
        </div>
        {cat?.options?.map((o) => (
          <div key={o.key} className="field">
            <span>{o.label}</span>
            <div className="choice-row">
              {o.choices?.map((ch) => (
                <button key={ch} className={`btn choice${opts[o.key ?? ""] === ch ? " on" : ""}`} onClick={() => setOpts((x) => ({ ...x, [o.key ?? ""]: ch }))}>{ch}</button>
              ))}
            </div>
          </div>
        ))}
        {err && <div className="card err-box" role="alert">{err}</div>}
        <button className="btn primary big" disabled={!optsOk || busy} onClick={create}>{busy ? "만드는 중…" : "만들기"}</button>
      </main>
    </div>
  );
}
