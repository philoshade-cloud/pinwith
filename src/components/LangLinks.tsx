import Link from "next/link";
import { LANGS, type Lang } from "@/lib/i18n/core";

// 같은 페이지의 다른 언어판(사람에게도 보이는 링크 — 검색엔진도 따라간다)
export function LangLinks({ langs, current, href }: { langs: readonly Lang[]; current: Lang; href: (l: Lang) => string }) {
  if (langs.length < 2) return null;
  return (
    <p className="note">
      {LANGS.filter((x) => langs.includes(x.id)).map((x, i) => (
        <span key={x.id}>
          {i > 0 && " · "}
          {x.id === current ? <b>{x.label}</b> : <Link href={href(x.id)} hrefLang={x.id} lang={x.id}>{x.label}</Link>}
        </span>
      ))}
    </p>
  );
}
