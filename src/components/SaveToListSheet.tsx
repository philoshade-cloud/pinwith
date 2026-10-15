"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { addPlaceToList, createEmptyList, DuplicatePlaceError } from "@/lib/lists";
import type { ListItem } from "@/lib/types";

const NEW_LIST = "__new__";

// 남의 리스트에 있는 장소를 내 리스트로 담기.
// 원작자의 메모는 원작자의 콘텐츠이므로 복사하지 않고, 출처(copied_from_item_id)만 남긴다.
export function SaveToListSheet({ item, onClose }: { item: ListItem; onClose: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [lists, setLists] = useState<{ id: string; title: string }[] | null>(null);
  const [listId, setListId] = useState(NEW_LIST);
  const [title, setTitle] = useState(item.title);
  const [memo, setMemo] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [savedTo, setSavedTo] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data } = await supabase
        .from("lists")
        .select("id, title")
        .eq("owner_id", auth.user.id)
        .order("updated_at", { ascending: false });
      setLists(data ?? []);
      if (data && data.length > 0) setListId(data[0].id);
    })();
  }, [supabase]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (item.lat == null || item.lng == null || !title.trim() || state === "saving") return;
    setState("saving");
    setError(null);
    try {
      const target = listId === NEW_LIST ? await createEmptyList() : listId;
      await addPlaceToList({
        listId: target,
        placeId: item.placeId,
        lat: item.lat,
        lng: item.lng,
        title: title.trim(),
        memo: memo.trim(),
        sectionId: null,
        copiedFromItemId: item.id,
      });
      setSavedTo(target);
      setState("done");
    } catch (err) {
      setError(err instanceof DuplicatePlaceError ? "이미 그 리스트에 있는 장소입니다." : "담지 못했습니다. 잠시 후 다시 시도하세요.");
      setState("idle");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 lg:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-h"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] rounded-t-2xl bg-white p-5 pb-8 shadow-xl lg:rounded-2xl lg:pb-5"
      >
        <div className="flex items-center">
          <h2 id="save-h" className="text-[17px] font-semibold text-ink">내 리스트에 담기</h2>
          <button type="button" onClick={onClose} className="ml-auto rounded p-1 text-muted hover:text-ink" aria-label="닫기">✕</button>
        </div>

        {state === "done" ? (
          <div className="mt-4">
            <p className="text-[15px] text-ink">{title.trim()}을(를) 담았습니다.</p>
            <div className="mt-4 flex gap-2">
              <Link href={`/me/lists/${savedTo}`} className="btn-primary">내 리스트에서 보기</Link>
              <button type="button" onClick={onClose} className="btn-quiet">계속 둘러보기</button>
            </div>
          </div>
        ) : (
          <form onSubmit={save} className="mt-4 grid gap-3">
            <label className="grid gap-1 text-[13px] font-semibold text-ink">
              넣을 리스트
              <select value={listId} onChange={(e) => setListId(e.target.value)} className="field" disabled={lists === null}>
                {(lists ?? []).map((l) => (
                  <option key={l.id} value={l.id}>{l.title}</option>
                ))}
                <option value={NEW_LIST}>+ 새 리스트 만들어 넣기</option>
              </select>
            </label>
            <label className="grid gap-1 text-[13px] font-semibold text-ink">
              리스트에 보일 이름
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required className="field" />
            </label>
            <label className="grid gap-1 text-[13px] font-semibold text-ink">
              내 메모
              <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={2} className="field" placeholder="나만의 메모 (원래 메모는 복사되지 않습니다)" />
            </label>
            {error && <p role="alert" className="text-[14px] text-pin">{error}</p>}
            <button type="submit" disabled={state === "saving" || lists === null} className="btn-primary justify-center !py-2.5 disabled:opacity-50">
              {state === "saving" ? "담는 중" : "담기"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
