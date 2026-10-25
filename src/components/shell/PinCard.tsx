"use client";

import type { ReactNode } from "react";
import type { ListItem } from "@/lib/types";
import { track } from "@/lib/track";
import { ExternalLinks } from "./ExternalLinks";
import { ReserveButton } from "../Reservation";
import { useT } from "@/lib/i18n/client";

export function Tags({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <span className="mt-2 flex flex-wrap gap-1">
      {tags.map((t) => (
        <span key={t} className="rounded bg-surface px-1.5 py-0.5 text-[12px] text-teal">{t}</span>
      ))}
    </span>
  );
}

// 영상 링크의 시작 시각(t=90, t=1m30s, start=90)을 1:30 꼴로. 없으면 null.
export function videoTime(url: string): string | null {
  try {
    const u = new URL(url);
    const raw = u.searchParams.get("t") ?? u.searchParams.get("start") ?? u.hash.match(/t=([0-9hms]+)/)?.[1] ?? null;
    if (!raw) return null;
    const m = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
    if (!m) return null;
    const sec = Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
    if (!sec) return null;
    const h = Math.floor(sec / 3600), mm = Math.floor((sec % 3600) / 60), ss = sec % 60;
    return h ? `${h}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}` : `${mm}:${String(ss).padStart(2, "0")}`;
  } catch {
    return null;
  }
}

// 지도에서 핀을 누르면 뜨는 카드. 길찾기·외부 지도·담기는 어느 화면에서나 같다.
export function PinCard({
  item, listId, onClose, onSave, extra,
}: {
  item: ListItem;
  listId?: string;
  onClose: () => void;
  onSave: (item: ListItem) => void;
  extra?: ReactNode;
}) {
  const t = useT();
  const log = (e: Parameters<typeof track>[0]) => {
    if (listId) track(e, { listId, itemId: item.id, lat: item.lat, lng: item.lng });
  };
  return (
    <div className="rounded-2xl bg-white p-4 shadow-[0_8px_30px_rgba(24,34,47,0.2)]">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[17px] font-semibold text-ink">{item.title}</h3>
        <button type="button" onClick={onClose} className="-m-1 rounded p-1 text-muted hover:text-ink" aria-label={t("닫기")}>
          ✕
        </button>
      </div>
      {item.memo && <p className="mt-1.5 text-[14px] leading-relaxed text-ink/80">{item.memo}</p>}
      <Tags tags={item.tags} />
      {/* 버튼이 많으면 줄바꿈 없이 옆으로 밀어서 본다 */}
      <div className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        <ReserveButton
          placeId={item.placeId}
          itemId={listId && !listId.startsWith("demo") ? item.id : undefined}
          onOpen={onClose}
          className="btn-primary shrink-0 whitespace-nowrap !px-3 !py-1.5 !text-[13px]"
        />
        {item.videoUrl && /^https?:\/\//.test(item.videoUrl) && (
          <a
            href={item.videoUrl}
            target="_blank"
            rel="noopener"
            onClick={() => log("video")}
            className="btn-primary shrink-0 whitespace-nowrap !bg-teal !px-3 !py-1.5 !text-[13px]"
          >
            ▶ {t("영상에서 보기")}{videoTime(item.videoUrl) ? ` ${videoTime(item.videoUrl)}` : ""}
          </a>
        )}
        <ExternalLinks item={item} onEvent={log} compact />
        <button
          type="button"
          onClick={() => {
            log("save_place");
            onSave(item);
          }}
          className="btn-quiet shrink-0 whitespace-nowrap !px-3 !py-1.5 !text-[13px]"
        >
          {t("내 리스트에 담기")}
        </button>
      </div>
      {extra && <div className="mt-3 border-t border-rule pt-3">{extra}</div>}
    </div>
  );
}
