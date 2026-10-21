// 사용: npx tsx scripts/i18n-dicts-check.ts
// 영어 사전(src/lib/i18n/en)에 있는데 다른 언어 사전(src/lib/i18n/dict/*.json)에 없는 문구를 언어별로 센다.
// 빠진 문구는 화면에서 영어로 나온다(깨지지는 않음). 새 문구를 넣은 뒤 번역을 채울 때 쓴다.
import { readdirSync, readFileSync } from "node:fs";
import { EN, TITLES } from "../src/lib/i18n/en";

const dir = "src/lib/i18n/dict";
let total = 0;
for (const f of readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) {
  const d = JSON.parse(readFileSync(`${dir}/${f}`, "utf8")) as { ui: Record<string, string>; titles: Record<string, string> };
  const missing = Object.keys(EN).filter((k) => !(k in d.ui));
  const missingT = Object.keys(TITLES).filter((k) => !(k in d.titles));
  total += missing.length + missingT.length;
  console.log(`${f.replace(".json", "").padEnd(6)} 빠진 문구 ${missing.length}, 빠진 제목 ${missingT.length}`);
  if (process.argv.includes("-v")) for (const k of [...missing, ...missingT]) console.log("   ", k);
}
process.exit(total ? 1 : 0);
