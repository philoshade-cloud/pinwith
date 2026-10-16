"use client";
// 화면에서 쓰는 다국어 도구.
// - 서버에서 그린 HTML은 한국어다. 브라우저가 이어받은 직후(LangBoot) 정해진 언어로 다시 그린다.
// - 영어 사용자에게 한국어가 잠깐 비치지 않도록, <head>의 짧은 스크립트가 그동안 화면을 가린다(LangHeadScript).
// - 언어를 바꾸면 쿠키에 저장하고 새로 불러온다(모든 화면·날짜 형식이 한 번에 바뀌게).
import { useCallback, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { LANG_COOKIE, LANGS, detect, localeOf, translate, translateTitle, type Lang, type Vars } from "./core";

let active: Lang = "ko";
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

function readCookie(): Lang | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${LANG_COOKIE}=(ko|en)`));
  return (m?.[1] as Lang | undefined) ?? null;
}

// 지금 화면 언어(훅을 못 쓰는 도우미 함수용)
export const currentLang = () => active;
// 훅 없이 번역(도우미 함수용). 화면 안에서는 useT를 쓴다.
export const tr = (ko: string, vars?: Vars) => translate(active, ko, vars);
export const currentLocale = () => localeOf(active);

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, () => active, () => "ko");
}

// 언어가 바뀔 때만 새 함수가 된다(의존성 목록에 넣어도 안전)
export function useT() {
  const lang = useLang();
  return useCallback((ko: string, vars?: Vars) => translate(lang, ko, vars), [lang]);
}

// 문구 안에 링크 등이 섞일 때: tRich("<a>약관</a>을 확인하세요", { a: (s) => <Link …>{s}</Link> })
export function useTRich() {
  const lang = useLang();
  return (ko: string, parts: Record<string, (chunk: string) => ReactNode>, vars?: Vars): ReactNode[] => {
    const text = translate(lang, ko, vars);
    const out: ReactNode[] = [];
    const re = /<(\w+)>(.*?)<\/\1>/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let k = 0;
    while ((m = re.exec(text))) {
      if (m.index > last) out.push(text.slice(last, m.index));
      const render = parts[m[1]];
      out.push(render ? <span key={k++}>{render(m[2])}</span> : m[2]);
      last = re.lastIndex;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
  };
}

export async function setLang(lang: Lang) {
  document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`;
  // 로그인한 사람은 계정에도 저장(휴대폰 알림 문구를 그 언어로 보내기 위해)
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const { error } = await supabase.from("profiles").update({ lang }).eq("id", data.session.user.id);
      if (!error) localStorage.setItem("pw_lang_synced", lang);
    }
  } catch {
    /* 저장 실패는 무시 */
  }
  window.location.reload();
}

// 루트 레이아웃에 한 번: 언어를 정하고(쿠키 → 브라우저 언어) 화면을 그 언어로 바꾼다
export function LangBoot() {
  useEffect(() => {
    let lang = readCookie();
    if (!lang) {
      lang = detect(navigator.languages?.length ? navigator.languages : [navigator.language]);
      document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`;
    }
    document.documentElement.lang = lang;
    if (lang !== active) {
      active = lang;
      listeners.forEach((l) => l());
    }
    // 브라우저 탭 제목: 서버는 한국어로 정하므로, 영어면 바뀔 때마다 옮긴다(화면 이동 포함)
    let stopTitle = () => {};
    if (lang === "en") {
      const fix = () => {
        const next = translateTitle(document.title);
        if (next !== document.title) document.title = next;
      };
      fix();
      const obs = new MutationObserver(fix);
      obs.observe(document.head, { childList: true, subtree: true, characterData: true });
      stopTitle = () => obs.disconnect();
    }
    // 다시 그린 다음 화면을 보여 준다
    requestAnimationFrame(() => document.documentElement.classList.remove("i18n-wait"));
    // 로그인한 사람의 계정 언어를 화면 언어와 맞춘다(휴대폰 알림 언어). 기기마다 한 번만.
    try {
      if (localStorage.getItem("pw_lang_synced") !== lang) {
        const l = lang;
        const supabase = createClient();
        supabase.auth.getSession().then(async ({ data }) => {
          if (!data.session) return;
          const { error } = await supabase.from("profiles").update({ lang: l }).eq("id", data.session.user.id);
          if (!error) localStorage.setItem("pw_lang_synced", l);
        });
      }
    } catch {
      /* 저장이 막힌 브라우저 */
    }
    return () => stopTitle();
  }, []);
  return null;
}

// 언어 바꾸기: 눌러서 고르는 방식(언어가 늘어나도 그대로). 글자 위에 기기 기본 선택 창을 투명하게 덮는다.
export function LangSwitch({ className = "" }: { className?: string }) {
  const lang = useLang();
  const current = LANGS.find((l) => l.id === lang)?.label ?? lang;
  return (
    <label className={`relative inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-[12px] font-semibold text-ink ${className}`}>
      {/* 언어 바꾸기 표시: 흔히 쓰는 '文A' 번역 모양 */}
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden className="shrink-0">
        <path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0 0 14.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z" />
      </svg>
      <span>{current}</span>
      <span aria-hidden className="text-muted">▾</span>
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
        aria-label="Language / 언어"
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      >
        {LANGS.map((l) => (
          <option key={l.id} value={l.id}>{l.label}</option>
        ))}
      </select>
    </label>
  );
}

// 숫자 형식(언어에 맞게)
export function useFormat() {
  const lang = useLang();
  const loc = localeOf(lang);
  return {
    num: (v: number, opts?: Intl.NumberFormatOptions) => v.toLocaleString(loc, opts),
    date: (v: string | number | Date, opts?: Intl.DateTimeFormatOptions) => new Date(v).toLocaleDateString(loc, opts),
    dateTime: (v: string | number | Date, opts?: Intl.DateTimeFormatOptions) => new Date(v).toLocaleString(loc, opts),
    locale: loc,
  };
}
