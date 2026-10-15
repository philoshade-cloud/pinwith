"use client";

import type { ReactNode } from "react";
import type { ListItem } from "@/lib/types";
import { track } from "@/lib/track";
import { ExternalLinks } from "./ExternalLinks";

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
  const log = (e: Parameters<typeof track>[0]) => {
    if (listId) track(e, { listId, itemId: item.id, lat: item.lat, lng: item.lng });
  };
  return (
    <div className="rounded-2xl bg-white p-4 shadow-[0_8px_30px_rgba(24,34,47,0.2)]">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[17px] font-semibold text-ink">{item.title}</h3>
        <button type="button" onClick={onClose} className="-m-1 rounded p-1 text-muted hover:text-ink" aria-label="닫기">
          ✕
        </button>
      </div>
      {item.memo && <p className="mt-1.5 text-[14px] leading-relaxed text-ink/80">{item.memo}</p>}
      <Tags tags={item.tags} />
      <div className="mt-3 flex flex-wrap gap-2">
        <ExternalLinks item={item} onEvent={log} />
        <button type="button" onClick={() => onSave(item)} className="btn-quiet">
          내 리스트에 담기
        </button>
      </div>
      {extra && <div className="mt-3 border-t border-rule pt-3">{extra}</div>}
    </div>
  );
}
