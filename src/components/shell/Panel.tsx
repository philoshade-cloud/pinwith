"use client";

import { useEffect, useRef, type PointerEvent, type ReactNode } from "react";
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
  const drag = useDrag(panelOpen, setPanelOpen);
  useEffect(() => {
    setPanelOpen(defaultOpen);
    // 화면에 들어올 때 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section
      aria-label={typeof title === "string" ? title : undefined}
      className={`fixed inset-x-0 bottom-16 z-20 flex flex-col overflow-hidden rounded-t-2xl bg-white shadow-[0_-6px_24px_rgba(24,34,47,0.16)] lg:inset-x-auto lg:left-4 lg:top-[76px] lg:w-[400px] lg:rounded-2xl lg:shadow-[0_4px_24px_rgba(24,34,47,0.16)] ${
        // 펼치면 데스크톱에서도 화면 아래(16px)까지로 높이를 정해 안쪽 목록이 스크롤되게 한다.
        // (예전엔 lg:bottom-auto와 lg:bottom-4가 함께 붙어 bottom-auto가 이겨, 패널이 화면 밖으로 늘어나 스크롤이 안 됐다)
        panelOpen ? "top-[38dvh] lg:bottom-4" : "h-[52px] lg:bottom-auto lg:h-auto"
      }`}
    >
      {titleSlot ? (
        <div {...drag.handlers} className="relative flex h-[52px] shrink-0 touch-none items-center gap-2 border-b border-rule px-4">
          <Grip />
          <div className="min-w-0 flex-1">{titleSlot}</div>
          <button
            type="button"
            onClick={() => drag.consumed() || setPanelOpen(!panelOpen)}
            aria-expanded={panelOpen}
            className="shrink-0 rounded-full bg-surface px-3 py-1 text-[13px] font-semibold text-ink"
          >
            {panelOpen ? t("지도 보기 ▾") : t("펼치기 ▴")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          {...drag.handlers}
          onClick={() => drag.consumed() || setPanelOpen(!panelOpen)}
          aria-expanded={panelOpen}
          className="relative flex h-[52px] shrink-0 touch-none items-center gap-2 border-b border-rule px-4 text-left"
        >
          <Grip />
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

// 휴대폰에서 제목 줄을 위로 끌면 펼치고, 아래로 끌면 접는다(버튼을 누르지 않아도).
const SWIPE = 24;
function useDrag(open: boolean, setOpen: (v: boolean) => void) {
  const start = useRef<{ y: number; id: number } | null>(null);
  // 끌어서 여닫았으면 바로 뒤따르는 클릭(손을 뗄 때 생김)은 무시한다
  const swiped = useRef(false);
  return {
    handlers: {
      onPointerDown: (e: PointerEvent) => {
        if (e.pointerType === "mouse") return;
        start.current = { y: e.clientY, id: e.pointerId };
        swiped.current = false;
      },
      onPointerMove: (e: PointerEvent) => {
        const s = start.current;
        if (!s || s.id !== e.pointerId) return;
        const dy = e.clientY - s.y;
        if (dy < -SWIPE && !open) {
          setOpen(true);
          swiped.current = true;
          start.current = null;
        } else if (dy > SWIPE && open) {
          setOpen(false);
          swiped.current = true;
          start.current = null;
        }
      },
      onPointerUp: () => {
        start.current = null;
      },
      onPointerCancel: () => {
        start.current = null;
      },
    },
    consumed: () => {
      const v = swiped.current;
      swiped.current = false;
      return v;
    },
  };
}

// 끌 수 있다는 표시(휴대폰에서만)
function Grip() {
  return <span aria-hidden className="pointer-events-none absolute left-1/2 top-1.5 h-1 w-9 -translate-x-1/2 rounded-full bg-rule lg:hidden" />;
}

export function PanelLoading() {
  const t = useT();
  return (
    <section className="fixed inset-x-0 bottom-16 top-[38dvh] z-20 rounded-t-2xl bg-white p-5 text-[14px] text-muted lg:inset-x-auto lg:bottom-4 lg:left-4 lg:top-[76px] lg:w-[400px] lg:rounded-2xl" aria-busy="true">
      {t("불러오는 중")}
    </section>
  );
}
