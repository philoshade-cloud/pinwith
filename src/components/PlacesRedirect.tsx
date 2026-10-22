"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LANGS, LANG_COOKIE, detect, isLang } from "@/lib/i18n/core";

// /places → 화면 언어의 도시 목록(/places/<언어>)으로. 언어는 쿠키 → 브라우저 언어.
export function PlacesRedirect() {
  const router = useRouter();
  useEffect(() => {
    const m = document.cookie.match(new RegExp(`(?:^|; )${LANG_COOKIE}=([A-Za-z-]+)`));
    const lang = isLang(m?.[1]) ? m[1] : detect(navigator.languages?.length ? navigator.languages : [navigator.language]);
    router.replace(`/places/${lang}`);
  }, [router]);
  return (
    <ul>
      {LANGS.map((l) => (
        <li key={l.id}>
          <Link href={`/places/${l.id}`} hrefLang={l.id} lang={l.id}>{l.label}</Link>
        </li>
      ))}
    </ul>
  );
}
