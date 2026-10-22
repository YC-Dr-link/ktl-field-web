# ktl-field-web — B-2 휴대폰 웹 · 관리 화면 (프론트)

담당 **희승** · 리뷰 짝 여준 · 과제 B(현장 사진·데이터)

현장에서 한 손으로: 분류 고르고 → 항목 누르고 → 찍고 → 확인. 노트북에서는 확인 필요 값 정리, 가스 구간 선택, 라돈 병합, 내보내기.

| 기준 문서 | |
|---|---|
| 요구사항 | [REQ-B2-01~12](https://github.com/YC-Dr-link/ktl-hub/blob/main/docs/01-요구사항명세.md#5-b-2-휴대폰-웹--관리-화면-프론트--희승) |
| 화면 대본 | [MO-01~06 · AD-01~05](https://github.com/YC-Dr-link/ktl-hub/blob/main/docs/03-UI시나리오.md) |
| API | [field-server.openapi.yaml](https://github.com/YC-Dr-link/ktl-hub/blob/main/docs/api/field-server.openapi.yaml) |

## 구성 (제안)

```
src/
  mobile/     MO-01~06 (모바일 우선, 큰 버튼)
  admin/      AD-01~05
  api/        OpenAPI에서 생성한 타입 + fetch 래퍼 + SSE
  mocks/      MSW 목업 (서버 완성 전 개발용)
vite.config.ts   빌드: dist/mobile, dist/admin → ktl-field-server/static
```

- 촬영: `<input type="file" accept="image/*" capture="environment">` — HTTP에서도 동작
- 차트·아이콘·폰트는 번들에 포함 (CDN 금지)

## 실행

(뼈대 PR에서 채운다)
