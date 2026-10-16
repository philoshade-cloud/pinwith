"use client";
// 화면에서 쓰는 다국어 도구.
// - 서버에서 그린 HTML은 한국어다. 브라우저가 이어받은 직후(LangBoot) 정해진 언어로 다시 그린다.
// - 영어 사용자에게 한국어가 잠깐 비치지 않도록, <head>의 짧은 스크립트가 그동안 화면을 가린다(LangHeadScript).
// - 언어를 바꾸면 쿠키에 저장하고 새로 불러온다(모든 화면·날짜 형식이 한 번에 바뀌게).
import { useCallback, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { LANG_COOKIE, detect, localeOf, translate, type Lang, type Vars } from "./core";

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
    if (data.session) await supabase.from("profiles").update({ lang }).eq("id", data.session.user.id);
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
    // 다시 그린 다음 화면을 보여 준다
    requestAnimationFrame(() => document.documentElement.classList.remove("i18n-wait"));
  }, []);
  return null;
}

// 언어 바꾸기 버튼(로그인 화면, My 화면 맨 위)
export function LangSwitch({ className = "" }: { className?: string }) {
  const lang = useLang();
  return (
    <div role="group" aria-label="Language / 언어" className={`inline-flex items-center gap-1 rounded-full bg-surface p-1 text-[13px] font-semibold ${className}`}>
      <span aria-hidden className="pl-2 pr-1 text-muted">🌐</span>
      {(["ko", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => l !== lang && setLang(l)}
          aria-pressed={l === lang}
          className={`rounded-full px-3 py-1 ${l === lang ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"}`}
        >
          {l === "ko" ? "한국어" : "English"}
        </button>
      ))}
    </div>
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
