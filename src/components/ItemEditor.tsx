"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ListItem, Section } from "@/lib/types";
import { Panel, PanelLoading } from "./shell/Panel";
import { ConfirmButton } from "./ConfirmButton";
import { useMapScene, useShell, type Scene } from "./shell/context";
import { useT } from "@/lib/i18n/client";

type Row = {
  id: string; place_id: string; custom_title: string; memo: string; section_id: string | null; tags: string[] | null;
  position: number; places: { lat: number | null; lng: number | null } | null;
  list: { id: string; title: string; slug: string; owner_id: string; owner: { handle: string } | null; sections: Section[] } | null;
};

// 핀 카드의 '편집': 장소 하나만 고친다(리스트 전체 편집 화면에서 스크롤하지 않도록).
export function ItemEditor({ listId, itemId }: { listId: string; itemId: string }) {
  const t = useT();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { toast, refreshMine } = useShell();
  const [state, setState] = useState<"loading" | "ready" | "missing" | "forbidden">("loading");
  const [row, setRow] = useState<Row | null>(null);
  const [title, setTitle] = useState("");
  const [memo, setMemo] = useState("");
  const [tags, setTags] = useState("");
  const [section, setSection] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.replace(`/login?next=${encodeURIComponent(`/me/lists/${listId}/item/${itemId}`)}`);
        return;
      }
      const { data } = await supabase
        .from("list_items")
        .select("id, place_id, custom_title, memo, section_id, tags, position, places(lat, lng), list:lists(id, title, slug, owner_id, owner:profiles!lists_owner_id_fkey(handle), sections(id, name, position))")
        .eq("id", itemId)
        .eq("list_id", listId)
        .maybeSingle();
      const r = data as unknown as Row | null;
      if (!r?.list) return setState("missing");
      if (r.list.owner_id !== auth.user.id) {
        const { data: ed } = await supabase.from("list_editors").select("accepted_at").eq("list_id", listId).eq("user_id", auth.user.id).maybeSingle();
        if (!ed?.accepted_at) return setState("forbidden");
      }
      setRow(r);
      setTitle(r.custom_title);
      setMemo(r.memo ?? "");
      setTags((r.tags ?? []).join(", "));
      setSection(r.section_id ?? "");
      setState("ready");
    })();
  }, [supabase, router, listId, itemId]);

  // 지도에는 이 장소만
  const scene: Scene | null = useMemo(() => {
    if (!row) return null;
    const item: ListItem = {
      id: row.id, placeId: row.place_id, title: row.custom_title, memo: "", sectionId: row.section_id, position: row.position,
      tags: [], videoUrl: null, lat: row.places?.lat ?? null, lng: row.places?.lng ?? null,
    };
    return { items: [item], listIdOf: () => listId };
  }, [row, listId]);
  useMapScene(scene);

  const listHref = row?.list?.owner?.handle ? `/@${row.list.owner.handle}/${row.list.slug}` : "/";
  function leave() {
    if (window.history.length > 1) router.back();
    else router.push(listHref);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const name = title.trim();
    if (!name) return toast(t("장소 이름을 넣으세요."));
    setBusy(true);
    const tagList = [...new Set(tags.split(/[,#]/).map((s) => s.trim()).filter(Boolean))].slice(0, 10).map((s) => s.slice(0, 30));
    const { error } = await supabase
      .from("list_items")
      .update({ custom_title: name.slice(0, 120), memo, tags: tagList, section_id: section || null })
      .eq("id", itemId);
    setBusy(false);
    if (error) return toast(t("변경을 저장하지 못했습니다."));
    toast(t("저장했어요."));
    router.refresh();
    leave();
  }

  async function remove() {
    const { error } = await supabase.from("list_items").delete().eq("id", itemId);
    if (error) return toast(t("장소를 빼지 못했습니다."));
    toast(t("‘{title}’을(를) 리스트에서 뺐어요.", { title: row?.custom_title ?? "" }));
    refreshMine();
    router.refresh();
    router.push(listHref);
  }

  if (state === "loading") return <PanelLoading />;
  if (state !== "ready" || !row?.list)
    return (
      <Panel title={t("장소 편집")}>
        <div className="p-5">
          <p className="text-[16px] text-ink">{state === "forbidden" ? t("이 리스트를 편집할 권한이 없습니다.") : t("장소를 찾을 수 없어요.")}</p>
          <Link href="/" className="btn-quiet mt-4">{t("지도로 돌아가기")}</Link>
        </div>
      </Panel>
    );

  const sections = [...row.list.sections].sort((a, b) => a.position - b.position);
  return (
    <Panel title={t("장소 편집 · {title}", { title: row.custom_title })}>
      <form onSubmit={save} className="grid gap-4 px-5 pb-10 pt-4">
        <p className="text-[13px] text-muted">{t("‘{list}’ 리스트의 장소", { list: row.list.title })}</p>
        <label className="grid gap-1 text-[13px] font-semibold text-ink">
          {t("장소 이름")}
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className="field !font-semibold" />
        </label>
        <label className="grid gap-1 text-[13px] font-semibold text-ink">
          {t("메모")}
          <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={4} className="field" autoFocus />
        </label>
        <label className="grid gap-1 text-[13px] font-semibold text-ink">
          {t("태그(쉼표로 구분)")}
          <input value={tags} onChange={(e) => setTags(e.target.value)} className="field" placeholder={t("예: 무료, 예약 필요")} />
        </label>
        {sections.length > 0 && (
          <label className="grid gap-1 text-[13px] font-semibold text-ink">
            {t("섹션")}
            <select value={section} onChange={(e) => setSection(e.target.value)} className="field">
              <option value="">{t("섹션 없음")}</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button disabled={busy} className="btn-primary disabled:opacity-50">{busy ? t("저장 중") : t("저장")}</button>
          <button type="button" onClick={leave} className="btn-quiet">{t("취소")}</button>
          <span className="ml-auto">
            <ConfirmButton
              label={t("삭제")}
              question={t("‘{title}’을(를) 이 리스트에서 뺄까요? 메모와 댓글도 함께 지워져요.", { title: row.custom_title })}
              confirmLabel={t("삭제")}
              onConfirm={remove}
              className="btn-quiet text-pin"
            />
          </span>
        </div>
        <Link href={`/me/lists/${listId}`} className="text-[13px] text-muted underline">{t("리스트 전체 편집(순서·섹션·리스트 정보)")}</Link>
      </form>
    </Panel>
  );
}
