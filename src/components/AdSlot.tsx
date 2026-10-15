"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { LogoMark } from "./Logo";
import { useConsent } from "./Consent";
import { useShell } from "./shell/context";

// 광고 자리. 광고 계정(AdSense)을 연결하기 전에는 PinWith 자체 홍보를 보여준다.
// 연결하려면 환경 변수 NEXT_PUBLIC_ADSENSE_CLIENT(ca-pub-…)와 각 자리의 slot id를 넣는다.
const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "";

const HOUSE = [
  { title: "아는 곳을 핀으로 꽂아 보세요", body: "내 단골집, 여행 코스를 지도에 모아 링크 하나로 건네요.", cta: "내 지도 만들기", href: "/login?next=/" },
  { title: "다른 사람의 지도 구경하기", body: "여행 가기 전, 그 동네를 잘 아는 사람의 리스트부터.", cta: "타인의 핀", href: "/explore" },
  { title: "받은 사람은 로그인 없이", body: "링크를 열면 바로 지도. 길찾기는 구글·네이버·카카오로.", cta: "예시 보기", href: "/demo" },
];

// 리스트 화면의 광고 자리가 화면에 절반 이상 1초 넘게 보이면 '노출'로 센다(리스트별·하루 단위).
// 나중에 광고 수익을 큐레이터와 나눌 때 근거가 된다. 주인 본인의 열람은 DB에서 뺀다.
// 로그인하지 않은 사람은 브라우저마다 무작위 번호로 구분해 30분 안의 반복 노출을 한 번으로 센다
function viewerId() {
  try {
    let v = localStorage.getItem("pw-viewer");
    if (!v) {
      v = crypto.randomUUID();
      localStorage.setItem("pw-viewer", v);
    }
    return v;
  } catch {
    return "";
  }
}

// 자체 홍보 자리는 'house:'를 붙여 기록한다(수익화 자격에는 들어가고, 광고 수익 정산에서는 빠진다)
function useAdView(listId: string | undefined, slot: string) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !listId || !("IntersectionObserver" in window)) return;
    let timer: number | undefined;
    let done = false;
    const io = new IntersectionObserver(
      ([e]) => {
        if (done) return;
        if (e.isIntersecting && e.intersectionRatio >= 0.5) {
          timer = window.setTimeout(() => {
            done = true;
            io.disconnect();
            createClient().rpc("record_ad_view", { p_list: listId, p_slot: slot, p_viewer: viewerId() }).then(() => {});
          }, 1000);
        } else window.clearTimeout(timer);
      },
      { threshold: [0, 0.5, 1] },
    );
    io.observe(el);
    return () => {
      window.clearTimeout(timer);
      io.disconnect();
    };
  }, [listId, slot]);
  return ref;
}

export function AdSlot({ slot, variant = 0, listId }: { slot: string; variant?: number; listId?: string }) {
  const consent = useConsent();
  const { me } = useShell();
  const paid = !!(ADSENSE_CLIENT && consent);
  const viewRef = useAdView(listId, paid ? slot : `house:${slot}`);
  if (paid)
    return (
      <div ref={viewRef}>
        <AdSenseUnit slot={slot} personalized={consent === "all"} />
      </div>
    );
  const base = HOUSE[variant % HOUSE.length];
  // 로그인한 사람에게 '내 지도 만들기'는 내 리스트로
  const h = base.href.startsWith("/login") && me ? { ...base, cta: "내 리스트로", href: `/@${me.handle}` } : base;
  return (
    <aside ref={viewRef} aria-label="PinWith 소개" className="mx-5 my-3 flex items-center gap-3 rounded-xl border border-rule bg-[#fff7fb] p-3.5">
      <LogoMark size={36} />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-ink">{h.title}</p>
        <p className="mt-0.5 text-[12px] leading-snug text-muted">{h.body}</p>
      </div>
      <Link href={h.href} className="shrink-0 rounded-full bg-pin px-3 py-1.5 text-[12px] font-semibold text-white">
        {h.cta}
      </Link>
    </aside>
  );
}

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

function AdSenseUnit({ slot, personalized }: { slot: string; personalized: boolean }) {
  const ref = useRef<HTMLModElement>(null);
  useEffect(() => {
    if (!document.querySelector("script[data-adsense]")) {
      const s = document.createElement("script");
      s.async = true;
      s.dataset.adsense = "1";
      s.crossOrigin = "anonymous";
      s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
      document.head.append(s);
    }
    try {
      const q = (window.adsbygoogle = window.adsbygoogle || []) as unknown[] & { requestNonPersonalizedAds?: number };
      // 맞춤 광고에 동의하지 않았으면 비맞춤 광고만
      q.requestNonPersonalizedAds = personalized ? 0 : 1;
      q.push({});
    } catch {
      /* 광고 실패는 무시 */
    }
  }, [personalized]);
  return (
    <div className="mx-5 my-3">
      <p className="mb-1 text-[11px] text-muted">광고</p>
      <ins
        ref={ref}
        className="adsbygoogle block"
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
        data-ad-format="fluid"
        data-ad-layout-key="-fb+5w+4e-db+86"
      />
    </div>
  );
}
