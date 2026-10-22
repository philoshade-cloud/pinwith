// 다국어 핵심(서버·브라우저 공용). 한국어 문구 자체를 열쇠로 쓰고, 영어 사전에서 같은 문구를 찾는다.
// 사전에 없으면 한국어를 그대로 보여 준다(빠뜨린 번역이 화면을 깨지 않게).
//
// 변수: t("{n}곳", { n: 3 }) → 사전 값 "{n} places". 단수·복수: "{n} place|{n} places"(n이 1이면 앞쪽).
// 같은 한국어가 자리에 따라 영어가 다를 때: t("좋아요@@탭") — 한국어로는 "@@" 앞만 보이고, 사전은 "좋아요@@탭"을 따로 찾는다.
import { EN, TITLES } from "./en";

// 화면 언어. ko·en 사전은 기본으로 들어 있고, 나머지는 고른 언어의 사전만 내려받는다(dict/<언어>.json).
export const LANG_IDS = ["ko", "en", "ja", "zh-CN", "zh-TW", "es", "pt", "fr", "de", "it", "ru", "ar", "hi", "tr", "th", "vi", "id"] as const;
export type Lang = (typeof LANG_IDS)[number];
export const LANGS: { id: Lang; label: string }[] = [
  { id: "ko", label: "한국어" },
  { id: "en", label: "English" },
  { id: "ja", label: "日本語" },
  { id: "zh-CN", label: "简体中文" },
  { id: "zh-TW", label: "繁體中文" },
  { id: "es", label: "Español" },
  { id: "pt", label: "Português" },
  { id: "fr", label: "Français" },
  { id: "de", label: "Deutsch" },
  { id: "it", label: "Italiano" },
  { id: "ru", label: "Русский" },
  { id: "ar", label: "العربية" },
  { id: "hi", label: "हिन्दी" },
  { id: "tr", label: "Türkçe" },
  { id: "th", label: "ไทย" },
  { id: "vi", label: "Tiếng Việt" },
  { id: "id", label: "Bahasa Indonesia" },
];
export const isLang = (v: unknown): v is Lang => typeof v === "string" && (LANG_IDS as readonly string[]).includes(v);
// 오른쪽에서 왼쪽으로 쓰는 언어
export const isRtl = (lang: Lang) => lang === "ar";

// 주소에 언어가 들어 있으면(?lang=ja, /places/ja/…) 쿠키보다 앞선다. 검색엔진이 언어마다 다른 주소로 색인하게(hreflang).
export function langFromUrl(pathname: string, search: string): Lang | null {
  const q = new URLSearchParams(search).get("lang");
  if (isLang(q)) return q;
  const m = /^\/places\/([A-Za-z-]+)/.exec(pathname);
  return m && isLang(m[1]) ? m[1] : null;
}
export const LANG_COOKIE = "pw_lang";

// 내려받은 사전(ko·en 밖의 언어)
type Dict = { ui: Record<string, string>; titles: Record<string, string> };
const DICTS: Partial<Record<Lang, Dict>> = {};
export function registerDict(lang: Lang, dict: Dict) {
  DICTS[lang] = dict;
}
export const hasDict = (lang: Lang) => lang === "ko" || lang === "en" || !!DICTS[lang];

export type Vars = Record<string, string | number | null | undefined>;

function fill(s: string, vars?: Vars) {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined || vars[k] === null ? m : String(vars[k])));
}

export function translate(lang: Lang, ko: string, vars?: Vars): string {
  const at = ko.indexOf("@@");
  const plain = at < 0 ? ko : ko.slice(0, at);
  if (lang === "ko") return fill(plain, vars);
  // 그 언어 사전 → 없으면 영어 → 없으면 한국어
  const d = lang === "en" ? undefined : DICTS[lang]?.ui;
  let s = d?.[ko] ?? d?.[plain] ?? EN[ko] ?? EN[plain];
  if (s === undefined) return fill(plain, vars);
  if (s.includes("|") && vars && typeof vars.n === "number") {
    const [one, many] = s.split("|");
    let single = vars.n === 1;
    try {
      single = new Intl.PluralRules(localeOf(lang)).select(vars.n) === "one";
    } catch {
      /* 오래된 브라우저 */
    }
    s = single ? one : many;
  }
  return fill(s, vars);
}

// 브라우저·화면에 맞는 숫자·날짜 형식
const LOCALES: Record<Lang, string> = {
  ko: "ko-KR", en: "en-US", ja: "ja-JP", "zh-CN": "zh-CN", "zh-TW": "zh-TW", es: "es-ES", pt: "pt-BR", fr: "fr-FR", de: "de-DE",
  it: "it-IT", ru: "ru-RU", ar: "ar", hi: "hi-IN", tr: "tr-TR", th: "th-TH", vi: "vi-VN", id: "id-ID",
};
export const localeOf = (lang: Lang) => LOCALES[lang] ?? "en-US";

// 브라우저 언어로 처음 언어를 정한다: 맞는 언어가 있으면 그 언어, 없으면 영어
export function detect(languages: readonly string[] | undefined): Lang {
  for (const raw of languages ?? []) {
    const l = raw.toLowerCase();
    if (l.startsWith("zh")) return /tw|hk|mo|hant/.test(l) ? "zh-TW" : "zh-CN";
    const base = l.split("-")[0];
    if (base === "in") return "id"; // 옛 인도네시아어 코드
    const hit = LANG_IDS.find((id) => id.toLowerCase() === base);
    if (hit) return hit;
  }
  return (languages ?? []).length ? "en" : "ko";
}

// 브라우저 탭 제목(“내 프로필 · PinWith”, “지수의 지도 · PinWith”)을 영어로. 모르는 제목(리스트 이름 등)은 그대로.
export function translateTitle(title: string, lang: Lang = "en"): string {
  const suffix = " · PinWith";
  const head = title.endsWith(suffix) ? title.slice(0, -suffix.length) : title;
  const table = lang === "en" ? TITLES : { ...TITLES, ...(DICTS[lang]?.titles ?? {}) };
  let out = table[head];
  if (out === undefined) {
    const m = head.match(/^(.+)의 지도$/);
    out = m && table["{name}의 지도"] ? table["{name}의 지도"].replace("{name}", m[1]) : head;
  }
  return title.endsWith(suffix) ? out + suffix : out;
}
