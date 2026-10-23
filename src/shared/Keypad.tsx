/** 큰 숫자 키패드 (PIN · 접수번호). 한 손으로 누르기 좋게 버튼 높이 64px. */
export default function Keypad({ onKey, disabled }: { onKey: (k: string) => void; disabled?: boolean }) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"];
  return (
    <div className="keypad">
      {keys.map((k) => (
        <button key={k} type="button" className="btn key" disabled={disabled} onClick={() => onKey(k)}
          aria-label={k === "⌫" ? "한 글자 지우기" : k === "C" ? "모두 지우기" : k}>
          {k}
        </button>
      ))}
    </div>
  );
}

/** 키패드 입력을 숫자 문자열에 반영 */
export function applyKey(value: string, k: string, max: number): string {
  if (k === "⌫") return value.slice(0, -1);
  if (k === "C") return "";
  return (value + k).slice(0, max);
}
