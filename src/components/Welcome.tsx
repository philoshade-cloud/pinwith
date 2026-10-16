"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { CuratedList } from "@/lib/types";
import { Panel } from "./shell/Panel";
import { useMapScene, type Scene } from "./shell/context";
import { useT } from "@/lib/i18n/client";

// 로그인 전 홈: 지도에는 예시 코스, 패널에는 서비스 소개.
export function Welcome({ sample }: { sample: CuratedList }) {
  const t = useT();
  const scene: Scene = useMemo(
    () => ({
      items: sample.items,
      showRoute: true,
      cardExtra: () => <DemoLink />,
    }),
    [sample],
  );
  useMapScene(scene);

  return (
    <Panel title={t("PinWith · 아는 곳을 핀으로 꽂아 건네세요")}>
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
          <Link href="/demo" className="btn-quiet justify-center !py-3 !text-[15px]">
            {t("예시 리스트 보기")}
          </Link>
          <Link href="/explore" className="btn-quiet justify-center !py-3 !text-[15px]">
            {t("다른 사람 리스트 둘러보기")}
          </Link>
        </div>
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
function DemoLink() {
  const t = useT();
  return (
    <Link href="/demo" className="flex items-center text-[14px] font-semibold text-teal">
      {t("예시 리스트 전체 보기")} <span className="ml-auto">›</span>
    </Link>
  );
}
