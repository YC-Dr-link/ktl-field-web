// 빌드 결과에 외부 주소(CDN · 외부 폰트 · 외부 API)가 없는지 확인한다. 현장은 인터넷이 없다 (REQ-COM-01).
// 라이브러리 안의 문서 링크 · XML 네임스페이스처럼 요청하지 않는 문자열만 허용한다.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ALLOW = [/^https?:\/\/www\.w3\.org\//, /^https:\/\/react\.dev\//, /^https:\/\/reactjs\.org\//, /^https?:\/\/127\.0\.0\.1[:/]/, /^https?:\/\/localhost[:/]/];
const URL_RE = /https?:\/\/[^\s"'`)<>]+/g;

function* files(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (/\.(html|js|css|svg|json|webmanifest)$/.test(f)) yield p;
  }
}

const bad = [];
for (const app of ["mobile", "admin"]) {
  for (const f of files(join("dist", app))) {
    for (const url of readFileSync(f, "utf8").match(URL_RE) ?? []) {
      if (!ALLOW.some((re) => re.test(url))) bad.push(`${f}: ${url}`);
    }
  }
}
if (bad.length) {
  console.error("check-offline: 빌드 결과에 외부 주소가 있습니다 (CDN 금지)\n" + bad.map((b) => " - " + b).join("\n"));
  process.exit(1);
}
console.log("check-offline: 외부 주소 0건 (dist/mobile, dist/admin)");
