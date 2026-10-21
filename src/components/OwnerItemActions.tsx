"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { ConfirmButton } from "./ConfirmButton";
import { useShell } from "./shell/context";
import { useT } from "@/lib/i18n/client";

// 내 리스트의 핀 카드: 그 장소를 바로 편집하거나 리스트에서 뺀다.
export function OwnerItemActions({
  itemId, listId, placeId, title, onDeleted,
}: {
  itemId: string;
  listId: string;
  placeId: string;
  title: string;
  onDeleted?: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { select, toast, refreshMine } = useShell();

  function edit() {
    // 이 장소 하나만 고치는 화면
    router.push(`/me/lists/${listId}/item/${itemId}`);
  }

  async function remove() {
    const { error } = await supabase.from("list_items").delete().eq("id", itemId);
    if (error) return toast(t("장소를 빼지 못했습니다."));
    select(null);
    toast(t("‘{title}’을(를) 리스트에서 뺐어요.", { title }));
    onDeleted?.();
    router.refresh();
    refreshMine();
  }

  return (
    <div className="flex flex-wrap items-start gap-2">
      <button type="button" onClick={edit} className="btn-quiet !px-3 !py-1.5 !text-[13px]">{t("편집")}</button>
      <ConfirmButton
        label={t("삭제")}
        question={t("‘{title}’을(를) 이 리스트에서 뺄까요? 메모와 댓글도 함께 지워져요.", { title })}
        confirmLabel={t("삭제")}
        onConfirm={remove}
        className="btn-quiet !px-3 !py-1.5 !text-[13px] text-pin"
      />
    </div>
  );
}
