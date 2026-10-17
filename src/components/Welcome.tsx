"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CuratedList, ListItem } from "@/lib/types";
import { loadExamplePins, useExampleLists } from "@/lib/examples";
import { OfficialBadge } from "./OfficialBadge";
import { ExampleBadge } from "./ExampleBadge";
import { Panel } from "./shell/Panel";
import { useMapScene, useShell, type Scene } from "./shell/context";
import { LangSwitch, useT } from "@/lib/i18n/client";

// 로그인 전 홈: 지도에는 화면 언어의 첫 번째 예시 리스트(못 읽으면 내장 예시 코스), 패널에는 서비스 소개와 예시 3개.
export function Welcome({ sample }: { sample: CuratedList }) {
  const t = useT();
  const examples = useExampleLists();
  const first = examples?.[0];
  const [pins, setPins] = useState<{ id: string; items: ListItem[] } | null>(null);
  useEffect(() => {
    if (!first) return;
    let cancelled = false;
    loadExamplePins(first.id).then((items) => {
      if (!cancelled && items.some((i) => i.lat != null)) setPins({ id: first.id, items });
    });
    return () => {
      cancelled = true;
    };
  }, [first]);
  const hasPins = pins && first && pins.id === first.id;
  const href = hasPins ? first.href : "/demo";
  const scene: Scene = useMemo(
    () => ({
      items: hasPins ? pins.items : sample.items,
      showRoute: true,
      cardExtra: (i) => <DemoLink placeId={i.placeId} href={href} />,
    }),
    [sample, hasPins, pins, href],
  );
  useMapScene(scene);

  return (
    <Panel
      title={t("PinWith · 아는 곳을 핀으로 꽂아 건네세요")}
      // 로그인 전에도 언어를 바꿀 수 있게 제목 줄에 언어 선택
      titleSlot={
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[15px] font-semibold text-ink">{t("PinWith · 아는 곳을 핀으로 꽂아 건네세요")}</span>
          <LangSwitch className="ml-auto shrink-0" />
        </span>
      }
    >
      <div className="px-5 pb-8 pt-5">
        <h1 className="font-display text-[30px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink">
          {t("아는 곳을 핀으로 꽂아, 링크 하나로 건네세요.")}
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-ink/80">
          {t("여행 영상에 나온 식당, 동네 단골집, 친구에게 알려주고 싶은 카페. 지도에 모아두면 받는 사람은 로그인 없이 바로 보고, 구글 지도나 네이버 지도로 길을 찾아갑니다.")}
        </p>
        <p className="mt-3 text-[14px] text-muted">{t("지도의 핀은 예시 코스예요. 핀을 눌러보세요.")}</p>
        <div className="mt-6 grid gap-2">
          <Link href="/login?next=/" className="btn-primary justify-center !py-3 !text-[15px]">
            {t("내 지도 만들기")}
          </Link>
          <Link href="/explore" className="btn-quiet justify-center !py-3 !text-[15px]">
            {t("다른 사람 리스트 둘러보기")}
          </Link>
        </div>
        {examples && examples.length > 0 && (
          <section className="mt-8">
            <h2 className="text-[13px] font-semibold text-teal">{t("예시 리스트")}</h2>
            <ul className="mt-2 divide-y divide-rule border-y border-rule">
              {examples.map((l) => (
                <li key={l.id}>
                  <Link href={l.href} className="block py-3 hover:bg-surface/60">
                    <span className="block text-[16px] font-semibold text-ink">{l.title}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[13px] text-muted">
                      {l.owner?.display_name}
                      {l.owner?.is_official && <OfficialBadge />}
                      <ExampleBadge />
                      <span>· {t("장소 {n}곳", { n: l.list_items?.[0]?.count ?? 0 })}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className="mt-8 text-[12px] text-muted">
          <Link href="/privacy" className="underline">{t("개인정보처리방침")}</Link>
          {" · "}
          <Link href="/terms" className="underline">{t("이용약관")}</Link>
        </p>
      </div>
    </Panel>
  );
}

// 지도 핀 카드 아래 링크(지도 장면을 다시 만들지 않도록 번역은 여기서)
function DemoLink({ placeId, href }: { placeId: string; href: string }) {
  const t = useT();
  const { focusNext } = useShell();
  return (
    <Link href={href} onClick={() => focusNext(placeId)} className="flex items-center text-[14px] font-semibold text-teal">
      {t("예시 리스트 전체 보기")} <span className="ml-auto">›</span>
    </Link>
  );
}
