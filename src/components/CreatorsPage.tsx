"use client";

import Link from "next/link";
import { useLang } from "@/lib/i18n/client";
import { CREATORS } from "@/lib/creatorsText";

const CONTACT = "adrian@pinwith.me";

// 크리에이터 소개 페이지 본문. 보는 사람의 언어로 바로 보여 준다.
export function CreatorsPage() {
  const c = CREATORS[useLang()] ?? CREATORS.en;
  const ask = `mailto:${CONTACT}?subject=${encodeURIComponent(c.askSubject)}`;
  return (
    <>
      <h1>{c.title}</h1>
      <p>{c.lead}</p>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/login?next=/" className="btn-primary">{c.ctaStart}</Link>
        <a href={ask} className="btn-quiet">{c.ctaAsk}</a>
      </div>

      {/* 시청자가 보는 장소 카드 예시(실제 카드와 같은 모양으로 그린 그림) */}
      <figure className="mt-8 rounded-2xl bg-surface p-4">
        <figcaption className="text-[13px] font-semibold text-teal">{c.exampleTitle}</figcaption>
        <div className="mt-3 rounded-2xl bg-white p-4 shadow-[0_8px_30px_rgba(24,34,47,0.12)]">
          <p className="text-[12px] font-semibold text-teal">{c.exampleSection}</p>
          <p className="mt-1 text-[17px] font-semibold text-ink">
            <span className="mr-2 text-pin">5</span>Gwangjang Market
          </p>
          <p className="mt-1 text-[14px] text-ink/80">{c.exampleNote}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="btn-primary !bg-teal !px-3 !py-1.5 !text-[13px]">▶ {c.watch} 4:12</span>
            <span className="btn-primary !px-3 !py-1.5 !text-[13px]">{c.directions}</span>
            <span className="btn-quiet !px-3 !py-1.5 !text-[13px]">Google Maps</span>
          </div>
        </div>
        <p className="mt-3 text-[12px] text-muted">{c.exampleCaption}</p>
      </figure>

      <h2>{c.audienceH}</h2>
      <ul>{c.audience.map((s) => <li key={s}>{s}</li>)}</ul>

      <h2>{c.youH}</h2>
      <ul>{c.you.map((s) => <li key={s}>{s}</li>)}</ul>

      <h2>{c.startH}</h2>
      <ol className="mt-1 list-decimal pl-[1.2em]">{c.start.map((s) => <li key={s}>{s}</li>)}</ol>

      <h2 id="earn">{c.earnH}</h2>
      <p className="note">{c.earnNote}</p>
      <ul>{c.earn.map((s) => <li key={s}>{s}</li>)}</ul>
      <p><Link href="/terms" className="underline">{c.termsLink}</Link></p>

      <h2>{c.faqH}</h2>
      {c.faq.map(([q, a]) => (
        <div key={q}>
          <p className="!mt-4 font-semibold !text-ink">{q}</p>
          <p className="!mt-1">{a}</p>
        </div>
      ))}

      <div className="mt-10 flex flex-wrap gap-2">
        <Link href="/login?next=/" className="btn-primary">{c.ctaStart}</Link>
        <a href={ask} className="btn-quiet">{c.ctaAsk}</a>
      </div>
      <p className="note mt-3">{CONTACT}</p>
    </>
  );
}
