import { useEffect, useRef, useState } from "react";
import { api, API_BASE, ApiError, CaseList, CaseSummary, Schemas } from "@/api/client";

type Export = Schemas["Export"];
const FORMATS = [["csv", "CSV"], ["txt", "TXT (탭)"], ["xlsx", "Excel"]] as const;

/** AD-04 내보내기 (03 시나리오 B-8, REQ-B2-07): 건 선택 → 형식 · 인코딩 · 사진 묶음 → [미리보기] → [파일 받기]
 *  확정된 값만 나간다. 미확정 칸은 빨간 빈칸 + "미확정 n개 제외" */
export default function ExportScreen() {
  const [cases, setCases] = useState<CaseSummary[] | null>(null);
  const [caseId, setCaseId] = useState("");
  const [format, setFormat] = useState<"csv" | "txt" | "xlsx">("csv");
  const [encoding, setEncoding] = useState<"cp949" | "utf-8">("cp949");
  const [photos, setPhotos] = useState(false);
  const [ex, setEx] = useState<Export | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const poll = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    api<CaseList>("/cases").then((r) => setCases(r.items ?? [])).catch((e: ApiError) => setErr(e.message));
    api<Schemas["Settings"]>("/settings").then((s) => s.export_encoding && setEncoding(s.export_encoding)).catch(() => {});
    return () => clearTimeout(poll.current);
  }, []);

  const preview = async () => {
    if (!caseId) return;
    clearTimeout(poll.current);
    setBusy(true);
    setErr(null);
    setEx(null);
    try {
      const first = await api<Export>(`/cases/${encodeURIComponent(caseId)}/exports`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "photo_values", format, encoding, include_photos: photos }),
      });
      const wait = async (id: string, tries = 0): Promise<void> => {
        const cur = await api<Export>(`/exports/${encodeURIComponent(id)}`);
        setEx(cur);
        if ((cur.status === "queued" || cur.status === "running") && tries < 60) {
          await new Promise((r) => (poll.current = setTimeout(r, 700)));
          return wait(id, tries + 1);
        }
        if (cur.status === "failed") setErr("내보내기를 만들지 못했어요. 다시 시도해 주세요.");
      };
      await wait(first.id ?? "");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const cur = cases?.find((c) => c.id === caseId);
  const done = ex?.status === "done";
  return (
    <div className="a-stack">
      <section className="card">
        <div className="a-form">
          <label>접수 건
            <select value={caseId} onChange={(e) => { setCaseId(e.target.value); setEx(null); }}>
              <option value="">— 고르세요 —</option>
              {cases?.map((c) => <option key={c.id} value={c.id}>{c.receipt_no} · {c.category} · 기기 {c.unit_count}대{c.status === "completed" ? " · 완료" : ""}</option>)}
            </select>
          </label>
          <label>형식
            <span className="seg">{FORMATS.map(([k, l]) => <button key={k} type="button" className={format === k ? "on" : ""} onClick={() => setFormat(k)}>{l}</button>)}</span>
          </label>
          <label>인코딩
            <select value={encoding} onChange={(e) => setEncoding(e.target.value as "cp949" | "utf-8")}><option value="cp949">cp949 (엑셀 기본)</option><option value="utf-8">UTF-8</option></select>
          </label>
          <label className="check"><input type="checkbox" checked={photos} onChange={(e) => setPhotos(e.target.checked)} /> 사진 묶음 포함 (zip — 워터마크 사본)</label>
        </div>
        <div className="a-actions">
          <button className="btn primary" disabled={!caseId || busy} onClick={preview}>{busy ? (ex?.status === "running" ? "만드는 중…" : "준비 중…") : "미리보기"}</button>
          {done && ex?.id && <a className="btn primary" href={`${API_BASE}/exports/${encodeURIComponent(ex.id)}/download`} download={ex.file_name ?? undefined}>⬇ 파일 받기</a>}
        </div>
        {err && <div className="card err-box" role="alert">{err}</div>}
      </section>

      {done && ex?.preview && (
        <section className="card">
          <div className="a-head">
            <h2>미리보기 <span className="muted">{cur?.receipt_no} · 기기 1대 = 1행</span></h2>
            {!!ex.skipped_unconfirmed && <span className="badge err">미확정 {ex.skipped_unconfirmed}개 제외</span>}
          </div>
          <div className="a-scroll">
            <table className="a-table preview">
              <thead><tr><th>#</th>{ex.preview.columns?.map((c) => <th key={c}>{c}</th>)}</tr></thead>
              <tbody>
                {ex.preview.rows?.map((r, i) => (
                  <tr key={i}><td>{i + 1}</td>{(r as unknown[]).map((v, j) => <td key={j} className={v == null || v === "" ? "missing" : ""} title={v == null ? "미확정 — 빠짐" : undefined}>{v == null ? "" : String(v)}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small">파일 이름: {ex.file_name} · 업무 PC로 옮기는 방법은 KTL 규정을 따르세요 (확인 필요)</p>
        </section>
      )}
    </div>
  );
}
