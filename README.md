# ktl-field-web — B-2 휴대폰 웹 · 관리 화면 (프론트)

담당 **희승** · 리뷰 짝 여준 · 과제 B(현장 사진·데이터)

현장에서 한 손으로: 분류 고르고 → 항목 누르고 → 찍고 → 확인. 노트북에서는 확인 필요 값 정리, 가스 구간 선택, 라돈 병합, 내보내기.

| 기준 문서 | |
|---|---|
| 요구사항 | [REQ-B2-01~12](https://github.com/YC-Dr-link/ktl-hub/blob/main/docs/01-요구사항명세.md#5-b-2-휴대폰-웹--관리-화면-프론트--희승) |
| 화면 대본 | [MO-01~06 · AD-01~05](https://github.com/YC-Dr-link/ktl-hub/blob/main/docs/03-UI시나리오.md) |
| API | [field-server.openapi.yaml](https://github.com/YC-Dr-link/ktl-hub/blob/main/docs/api/field-server.openapi.yaml) |

## 구성

```
src/
  mobile/     MO-01~06 (모바일 우선, 큰 버튼)
  admin/      AD-01~05
  shared/     두 화면 공통 스타일
  api/        OpenAPI에서 생성한 타입(schema.d.ts) + fetch 래퍼
  mocks/      MSW 목업 (서버 완성 전 개발용)
vite.config.ts   빌드: dist/mobile, dist/admin → ktl-field-server/static
```

- 촬영: `<input type="file" accept="image/*" capture="environment">` — HTTP에서도 동작
- 차트·아이콘·폰트는 번들에 포함 (CDN 금지)

## 실행

```bash
npm install
npm run dev          # 휴대폰 화면 http://127.0.0.1:5173 (/api/v1 → :8765) · 관리 화면은 npm run dev:admin (:5174, /api/admin/v1 → :8766)
npm run build        # dist/mobile · dist/admin + 외부 주소 0건 검사
```

서버(B-1) 완성 전에는 개발 서버가 **MSW 목업**(`src/mocks`, 가짜 데이터)으로 돌아요. 진짜 서버에 붙이려면 `VITE_MOCK=0 npm run dev`. 빌드 결과에는 목업이 들어가지 않아요.
API 타입(`src/api/schema.d.ts`)은 OpenAPI에서 만든 것 — 명세가 바뀌면 `npm run gen:api` (직접 고치지 않기).

휴대폰으로 개발 화면을 보려면 `npm run dev -- --host` (같은 Wi-Fi). 빌드 결과는 B-1 서버가 각 주소에서 정적 파일로 준다.
