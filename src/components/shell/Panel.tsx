"use client";

import { useEffect, type ReactNode } from "react";
import { useShell } from "./context";
import { useT } from "@/lib/i18n/client";

// 지도 위에 열리는 기능 패널. 접으면 제목 줄만 남고 지도가 보인다.
// 모바일: 아래에서 올라오는 시트(아래 메뉴 위), 데스크톱: 왼쪽 카드.
export function Panel({
  title, titleSlot, defaultOpen = true, children,
}: {
  title: ReactNode;
  // 제목 줄을 직접 그릴 때(예: 리스트 바꾸기). 이때는 '펼치기' 버튼만 패널을 여닫는다.
  titleSlot?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const { panelOpen, setPanelOpen } = useShell();
  const t = useT();
  useEffect(() => {
    setPanelOpen(defaultOpen);
    // 화면에 들어올 때 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section
      aria-label={typeof title === "string" ? title : undefined}
      className={`fixed inset-x-0 bottom-16 z-20 flex flex-col overflow-hidden rounded-t-2xl bg-white shadow-[0_-6px_24px_rgba(24,34,47,0.16)] lg:inset-x-auto lg:bottom-auto lg:left-4 lg:top-[76px] lg:w-[400px] lg:rounded-2xl lg:shadow-[0_4px_24px_rgba(24,34,47,0.16)] ${
        panelOpen ? "top-[38dvh] lg:bottom-4" : "h-[52px] lg:h-auto"
      }`}
    >
      {titleSlot ? (
        <div className="flex h-[52px] shrink-0 items-center gap-2 border-b border-rule px-4">
          <div className="min-w-0 flex-1">{titleSlot}</div>
          <button
            type="button"
            onClick={() => setPanelOpen(!panelOpen)}
            aria-expanded={panelOpen}
            className="shrink-0 rounded-full bg-surface px-3 py-1 text-[13px] font-semibold text-ink"
          >
            {panelOpen ? t("지도 보기 ▾") : t("펼치기 ▴")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPanelOpen(!panelOpen)}
          aria-expanded={panelOpen}
          className="flex h-[52px] shrink-0 items-center gap-2 border-b border-rule px-4 text-left"
        >
          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">{title}</span>
          <span className="shrink-0 rounded-full bg-surface px-3 py-1 text-[13px] font-semibold text-ink">
            {panelOpen ? t("지도 보기 ▾") : t("펼치기 ▴")}
          </span>
        </button>
      )}
      <div className={`${panelOpen ? "block" : "hidden"} min-h-0 flex-1 overflow-y-auto overscroll-contain`}>{children}</div>
    </section>
  );
}

export function PanelLoading() {
  const t = useT();
  return (
    <section className="fixed inset-x-0 bottom-16 top-[38dvh] z-20 rounded-t-2xl bg-white p-5 text-[14px] text-muted lg:inset-x-auto lg:bottom-4 lg:left-4 lg:top-[76px] lg:w-[400px] lg:rounded-2xl" aria-busy="true">
      {t("불러오는 중")}
    </section>
  );
}
