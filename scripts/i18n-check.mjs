// 사용법: node scripts/i18n-check.mjs <파일...>
// 1) t("…")/tr("…")/tRich("…") 안의 한국어 열쇠가 영어 사전에 있는지
// 2) 주석이 아닌 줄에 감싸지 않은 한국어가 남았는지(참고용)
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dictDir = "src/lib/i18n/en";
const keys = new Set();
for (const f of readdirSync(dictDir)) {
  if (!f.endsWith(".ts") || f === "index.ts") continue;
  const src = readFileSync(join(dictDir, f), "utf8");
  for (const m of src.matchAll(/^\s*("(?:[^"\\]|\\.)*")\s*:/gm)) keys.add(JSON.parse(m[1]));
}
let missing = 0, raw = 0;
for (const file of process.argv.slice(2)) {
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(/\b(?:t|tr|tRich)\(\s*("(?:[^"\\]|\\.)*"|`[^`$]*`)/g)) {
    const k = m[1].startsWith("`") ? m[1].slice(1, -1) : JSON.parse(m[1]);
    if (/[가-힣]/.test(k) && !keys.has(k) && !keys.has(k.split("@@")[0])) {
      missing++;
      console.log(`MISSING  ${file}: ${k}`);
    }
  }
  src.split("\n").forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, "").replace(/\{\/\*.*?\*\/\}/g, "");
    if (/^\s*\*/.test(line) || !/[가-힣]/.test(code)) return;
    // 감싼 문자열은 빼고 본다
    const stripped = code.replace(/\b(?:t|tr|tRich)\(\s*("(?:[^"\\]|\\.)*"|`[^`$]*`)/g, "");
    if (/[가-힣]/.test(stripped)) {
      raw++;
      console.log(`RAW      ${file}:${i + 1}: ${line.trim().slice(0, 140)}`);
    }
  });
}
console.log(`\n${missing} missing keys, ${raw} lines with unwrapped Korean`);
process.exit(missing ? 1 : 0);
