// 다국어 핵심(서버·브라우저 공용). 한국어 문구 자체를 열쇠로 쓰고, 영어 사전에서 같은 문구를 찾는다.
// 사전에 없으면 한국어를 그대로 보여 준다(빠뜨린 번역이 화면을 깨지 않게).
//
// 변수: t("{n}곳", { n: 3 }) → 사전 값 "{n} places". 단수·복수: "{n} place|{n} places"(n이 1이면 앞쪽).
// 같은 한국어가 자리에 따라 영어가 다를 때: t("좋아요@@탭") — 한국어로는 "@@" 앞만 보이고, 사전은 "좋아요@@탭"을 따로 찾는다.
import { EN } from "./en";

export type Lang = "ko" | "en";
export const LANGS: { id: Lang; label: string }[] = [
  { id: "ko", label: "한국어" },
  { id: "en", label: "English" },
];
export const LANG_COOKIE = "pw_lang";

export type Vars = Record<string, string | number | null | undefined>;

function fill(s: string, vars?: Vars) {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined || vars[k] === null ? m : String(vars[k])));
}

export function translate(lang: Lang, ko: string, vars?: Vars): string {
  const at = ko.indexOf("@@");
  const plain = at < 0 ? ko : ko.slice(0, at);
  if (lang === "ko") return fill(plain, vars);
  let s = EN[ko] ?? EN[plain];
  if (s === undefined) return fill(plain, vars);
  if (s.includes("|") && vars && typeof vars.n === "number") {
    const [one, many] = s.split("|");
    s = vars.n === 1 ? one : many;
  }
  return fill(s, vars);
}

// 브라우저·화면에 맞는 숫자·날짜 형식
export const localeOf = (lang: Lang) => (lang === "en" ? "en-US" : "ko-KR");

// 브라우저 언어로 처음 언어를 정한다: 한국어면 한국어, 그 밖은 영어
export function detect(languages: readonly string[] | undefined): Lang {
  const first = (languages ?? []).find(Boolean)?.toLowerCase() ?? "ko";
  return first.startsWith("ko") ? "ko" : "en";
}
