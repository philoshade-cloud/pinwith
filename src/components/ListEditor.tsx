"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMonetization } from "@/lib/monetization";
import { shortLink } from "@/lib/share";
import type { ListItem, ListKind, Section, Visibility } from "@/lib/types";
import { Panel, PanelLoading } from "./shell/Panel";
import { ConfirmButton } from "./ConfirmButton";
import { OwnerItemActions } from "./OwnerItemActions";
import { ChangeLog, EditorsManager, MyShare } from "./CoEdit";
import { useMapScene, useShell, type Scene } from "./shell/context";
import { currentLang, useT } from "@/lib/i18n/client";
import { LANGS } from "@/lib/i18n/core";

type Meta = {
  title: string;
  description: string;
  slug: string;
  visibility: Visibility;
  kind: ListKind;
  themes: string;
  // 리스트의 언어('타인의 핀'에서 그 언어를 고른 사람에게 보임)
  lang: string;
};

type ItemRow = {
  id: string;
  place_id: string;
  custom_title: string;
  memo: string;
  section_id: string | null;
  position: number;
  places: { lat: number | null; lng: number | null } | null;
  added_by?: string;
  adder?: { handle: string; display_name: string } | null;
};

const VISIBILITY_LABEL: Record<Visibility, string> = {
  public: "공개 — 누구나 찾고 볼 수 있음",
  unlisted: "링크 공개 — 링크가 있는 사람만",
  private: "나만 보기",
};

const SLUG_RE = /^[a-z0-9-]{1,60}$/;

function parseThemes(raw: string) {
  return [
    ...new Set(
      raw
        .split(/[,\s]+/)
        .map((t) => t.replace(/^#/, "").trim())
        .filter(Boolean),
    ),
  ].slice(0, 5);
}

export function ListEditor({ listId }: { listId: string }) {
  const router = useRouter();
  const t = useT();
  const supabase = useMemo(() => createClient(), []);

  const [state, setState] = useState<"loading" | "ready" | "forbidden" | "missing">("loading");
  const [handle, setHandle] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [ownerId, setOwnerId] = useState("");
  const [monetize, setMonetize] = useState(false);
  const money = useMonetization();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [savedMeta, setSavedMeta] = useState<Meta | null>(null);
  const [metaMsg, setMetaMsgRaw] = useState<{ text: string; error: boolean } | null>(null);
  const setMetaMsg = (text: string, error = true) => setMetaMsgRaw({ text, error });
  const [sections, setSections] = useState<Section[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [newSection, setNewSection] = useState("");
  const { selectedId, select, takeFocus, toast: flash, refreshMine, setPanelOpen } = useShell();

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.replace(`/login?next=${encodeURIComponent(`/me/lists/${listId}`)}`);
        return;
      }

      const { data } = await supabase
        .from("lists")
        .select(
          "id, owner_id, slug, title, description, visibility, kind, themes, monetize, lang," +
            " owner:profiles!lists_owner_id_fkey(handle)," +
            " sections(id, name, position)," +
            " list_items(id, place_id, custom_title, memo, section_id, position, added_by, places(lat, lng)," +
            " adder:profiles!list_items_added_by_fkey(handle, display_name))",
        )
        .eq("id", listId)
        .maybeSingle();
      if (!data) return setState("missing");

      const row = data as unknown as {
        owner_id: string; slug: string; title: string; description: string;
        visibility: Visibility; kind: ListKind; themes: string[]; monetize: boolean; lang: string | null;
        owner: { handle: string } | null;
        sections: Section[]; list_items: ItemRow[];
      };

      const owner = row.owner_id === auth.user.id;
      let editor = false;
      if (!owner) {
        const { data: ed } = await supabase
          .from("list_editors")
          .select("accepted_at")
          .eq("list_id", listId)
          .eq("user_id", auth.user.id)
          .maybeSingle();
        editor = !!ed?.accepted_at;
      }
      if (!owner && !editor) return setState("forbidden");

      const m: Meta = {
        title: row.title,
        description: row.description,
        slug: row.slug,
        visibility: row.visibility,
        kind: row.kind,
        themes: row.themes.map((t) => `#${t}`).join(" "),
        lang: row.lang ?? currentLang(),
      };
      setIsOwner(owner);
      setOwnerId(row.owner_id);
      setMonetize(row.monetize);
      setHandle(row.owner?.handle ?? "");
      setMeta(m);
      setSavedMeta(m);
      setSections([...row.sections].sort((a, b) => a.position - b.position));
      setItems([...row.list_items].sort((a, b) => a.position - b.position));
      setState("ready");
      supabase.rpc("touch_lists", { ids: [listId] }).then(() => {});
    })();
  }, [listId, router, supabase]);

  // 공유용 짧은 링크는 미리 만들어 둔다(복사는 누른 즉시 해야 해서)
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  useEffect(() => {
    if (state !== "ready") return;
    let alive = true;
    shortLink({ listId }, "").then((u) => alive && u && setShareUrl(u));
    return () => {
      alive = false;
    };
  }, [state, listId]);

  // ── 리스트 정보 ─────────────────────────────
  const metaDirty = meta && savedMeta && JSON.stringify(meta) !== JSON.stringify(savedMeta);

  async function saveMeta(e: React.FormEvent) {
    e.preventDefault();
    if (!meta) return;
    const slug = meta.slug.trim().toLowerCase();
    if (!SLUG_RE.test(slug)) {
      setMetaMsg(t("주소는 영문 소문자, 숫자, 하이픈(-)만 쓸 수 있습니다."));
      return;
    }
    if (!meta.title.trim()) {
      setMetaMsg(t("제목을 입력하세요."));
      return;
    }
    const themes = parseThemes(meta.themes);
    const { error } = await supabase
      .from("lists")
      .update({
        title: meta.title.trim(),
        description: meta.description.trim(),
        // 공개 범위와 주소는 주인만 바꾼다(공동 편집자는 DB에서도 막힘)
        ...(isOwner ? { slug, visibility: meta.visibility, lang: meta.lang } : {}),
        kind: meta.kind,
        themes,
      })
      .eq("id", listId);
    if (error) {
      setMetaMsg(error.code === "23505" ? t("이미 쓰고 있는 주소입니다. 다른 주소를 정하세요.") : t("저장하지 못했습니다. 다시 시도하세요."));
      return;
    }
    const next = { ...meta, slug, themes: themes.map((t) => `#${t}`).join(" ") };
    setMeta(next);
    setSavedMeta(next);
    setMetaMsg(t("저장했습니다."), false);
  }

  // '이 리스트로 수익화할 것이다': 켜야 공동 편집자별 수익 배분을 정하고 보여준다
  // 수익화 기준(팔로워 또는 최근 30일 광고 노출)을 넘은 주인에게만 보인다
  async function toggleMonetize(on: boolean) {
    setMonetize(on);
    const { error } = await supabase.from("lists").update({ monetize: on }).eq("id", listId);
    if (error) {
      setMonetize(!on);
      flash(error.message.includes("eligible") ? t("아직 수익화 기준에 이르지 않았어요.") : t("저장하지 못했습니다."));
    }
  }

  async function setKind(kind: ListKind) {
    if (!meta || !savedMeta) return;
    setMeta({ ...meta, kind });
    setSavedMeta({ ...savedMeta, kind });
    const { error } = await supabase.from("lists").update({ kind }).eq("id", listId);
    if (error) flash(t("저장하지 못했습니다. 다시 시도하세요."));
    else flash(kind === "course" ? t("번호를 붙였습니다.") : t("번호를 뗐습니다."));
  }

  // ── 섹션 ─────────────────────────────────
  async function addSection(e: React.FormEvent) {
    e.preventDefault();
    const name = newSection.trim();
    if (!name) return;
    const { data, error } = await supabase
      .from("sections")
      .insert({ list_id: listId, name, position: sections.length })
      .select("id, name, position")
      .single();
    if (error || !data) return flash(t("섹션을 추가하지 못했습니다."));
    setSections((s) => [...s, data]);
    setNewSection("");
  }

  async function renameSection(id: string, name: string) {
    const clean = name.trim();
    if (!clean) return;
    const { error } = await supabase.from("sections").update({ name: clean }).eq("id", id);
    if (error) flash(t("섹션 이름을 저장하지 못했습니다."));
  }

  async function deleteSection(id: string) {
    const { error } = await supabase.from("sections").delete().eq("id", id);
    if (error) return flash(t("섹션을 지우지 못했습니다."));
    setSections((s) => s.filter((x) => x.id !== id));
    setItems((list) => list.map((i) => (i.section_id === id ? { ...i, section_id: null } : i)));
  }

  // ── 장소 ─────────────────────────────────
  // 장소 추가는 지도 위 검색창에서 한다(지도 화면이 이 리스트로 넣어준다).
  const mapItems: ListItem[] = useMemo(
    () =>
      items.map((i) => ({
        id: i.id,
        placeId: i.place_id,
        title: i.custom_title,
        memo: i.memo,
        sectionId: i.section_id,
        position: i.position,
        tags: [],
        videoUrl: null,
        lat: i.places?.lat ?? null,
        lng: i.places?.lng ?? null,
      })),
    [items],
  );
  const numbering = useMemo(() => new Map(items.map((i, n) => [i.id, n + 1])), [items]);
  const scene: Scene | null = useMemo(
    () =>
      state !== "ready"
        ? null
        : {
            items: mapItems,
            showRoute: savedMeta?.kind === "course",
            numbering,
            listIdOf: () => listId,
            // 지도에서 핀을 고르면 카드에서 바로 편집·삭제
            cardExtra: (i: ListItem) => (
              <OwnerItemActions itemId={i.id} listId={listId} placeId={i.placeId} title={i.title} />
            ),
            addTarget: {
              listId,
              sections,
              onAdded: (item) => {
                setItems((list) => [...list, item as ItemRow]);
                // 저장하면서 새 섹션을 만들었으면 섹션 목록을 다시 불러온다
                const sid = (item as ItemRow).section_id;
                if (sid && !sections.some((x) => x.id === sid))
                  supabase.from("sections").select("id, name, position").eq("list_id", listId).order("position")
                    .then(({ data }) => data && setSections(data));
              },
            },
          },
    [state, mapItems, savedMeta?.kind, numbering, listId, sections, supabase],
  );
  useMapScene(scene);

  // 핀 카드의 '편집'으로 들어왔으면 그 장소를 골라 둔다(아래 효과가 그 장소로 스크롤)
  useEffect(() => {
    if (state !== "ready") return;
    const placeId = takeFocus();
    if (!placeId) return;
    const hit = items.find((i) => i.place_id === placeId);
    if (hit) {
      setPanelOpen(true);
      select(hit.id);
      // 이미 같은 핀이 골라져 있으면 위 효과가 다시 돌지 않으므로 직접 스크롤
      setTimeout(() => document.getElementById(`item-${hit.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
    }
    // 목록을 다 불러온 직후 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // 핀 카드·검색 장소 카드에서 이 리스트의 장소를 지우면 목록에서도 뺀다
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ itemId: string; listId: string }>).detail;
      if (d?.listId === listId) setItems((list) => list.filter((i) => i.id !== d.itemId));
    };
    window.addEventListener("pw-item-removed", on);
    return () => window.removeEventListener("pw-item-removed", on);
  }, [listId]);

  // 지도에서 핀을 고르면 편집 목록에서 그 장소로
  useEffect(() => {
    if (selectedId) document.getElementById(`item-${selectedId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selectedId]);

  async function updateItem(id: string, patch: Partial<Pick<ItemRow, "custom_title" | "memo" | "section_id">>) {
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    const { error } = await supabase.from("list_items").update(patch).eq("id", id);
    if (error) flash(t("변경을 저장하지 못했습니다."));
  }

  async function moveItem(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    const renumbered = next.map((i, n) => ({ ...i, position: n }));
    setItems(renumbered);
    const changed = renumbered.filter((i, n) => items[n]?.id !== i.id);
    const results = await Promise.all(
      changed.map((i) => supabase.from("list_items").update({ position: i.position }).eq("id", i.id)),
    );
    if (results.some((r) => r.error)) flash(t("순서를 저장하지 못했습니다."));
  }

  async function removeItem(id: string) {
    const { error } = await supabase.from("list_items").delete().eq("id", id);
    if (error) return flash(t("장소를 빼지 못했습니다."));
    setItems((list) => list.filter((i) => i.id !== id));
  }

  async function deleteList() {
    const { error } = await supabase.from("lists").delete().eq("id", listId);
    if (error) return flash(t("리스트를 지우지 못했습니다."));
    await refreshMine();
    router.push("/");
  }

  async function copyLink() {
    if (!savedMeta) return;
    const url = shareUrl ?? `${window.location.origin}/@${handle}/${savedMeta.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      flash(t("링크를 복사했습니다."));
    } catch {
      flash(url);
    }
  }

  // ── 화면 ─────────────────────────────────
  if (state === "loading") return <PanelLoading />;
  if (state === "missing" || state === "forbidden")
    return (
      <Panel title={t("리스트 편집")}>
        <div className="p-5">
          <p className="text-[16px] text-ink">
            {state === "missing" ? t("리스트를 찾을 수 없습니다.") : t("이 리스트를 편집할 권한이 없습니다.")}
          </p>
          <Link href="/" className="btn-quiet mt-4">{t("지도로 돌아가기")}</Link>
        </div>
      </Panel>
    );
  if (!meta || !savedMeta) return null;

  const viewHref = `/@${handle}/${savedMeta.slug}`;

  return (
    <Panel title={t("편집 · {title}", { title: savedMeta.title })}>
      <div className="px-5 pb-10">
        {/* 패널을 내려도 늘 보이는 윗줄: 저장 버튼과 바로가기 */}
        <div className="sticky top-0 z-10 -mx-5 flex items-center gap-2 border-b border-rule bg-white px-5 py-2.5">
          <button type="submit" form="list-meta" disabled={!metaDirty} className="btn-primary shrink-0 !py-1.5 disabled:opacity-40">
            {t("변경 저장")}
          </button>
          {/* 저장한 뒤 다시 고치기 시작하면 '저장했습니다'는 지운다. 오류는 고칠 때까지 둔다 */}
          <span role="status" className={`min-w-0 flex-1 truncate text-[13px] ${metaMsg?.error ? "text-pin" : "text-muted"}`}>
            {metaMsg && (metaMsg.error || !metaDirty) ? metaMsg.text : metaDirty ? t("저장하지 않은 변경이 있어요") : ""}
          </span>
          <Link href={viewHref} className="btn-quiet shrink-0 !py-1.5">{t("리스트 보기")}</Link>
        </div>
        <nav className="mt-4 flex flex-wrap items-center gap-2">
          <Link href={`/me/lists/${listId}/notice`} className="btn-quiet">{t("공지")}</Link>
          <Link href="/me/stats" className="btn-quiet">{t("통계")}</Link>
          <button type="button" onClick={copyLink} className="btn-quiet">{t("링크 복사")}</button>
        </nav>

        {/* 리스트 정보 */}
        <form id="list-meta" onSubmit={saveMeta} className="mt-6 grid gap-4">
          <label className="grid gap-1 text-[13px] font-semibold text-ink">
            {t("제목")}
            <input
              value={meta.title}
              onChange={(e) => setMeta({ ...meta, title: e.target.value })}
              maxLength={120}
              className="field font-display !text-[22px] !font-semibold"
            />
          </label>
          <label className="grid gap-1 text-[13px] font-semibold text-ink">
            {t("설명")}
            <textarea
              value={meta.description}
              onChange={(e) => setMeta({ ...meta, description: e.target.value })}
              rows={2}
              className="field"
              placeholder={t("이 리스트를 어떤 사람에게, 어떤 때에 추천하나요?")}
            />
          </label>
          <label className="grid gap-1 text-[13px] font-semibold text-ink">
            {t("테마")} <span className="font-normal text-muted">{t("최대 5개, 찾기 화면의 검색에 쓰입니다")}</span>
            <input
              value={meta.themes}
              onChange={(e) => setMeta({ ...meta, themes: e.target.value })}
              className="field"
              placeholder={t("#라멘 #혼자여행")}
            />
          </label>
          {isOwner && <div className="grid gap-4">
            <label className="grid gap-1 text-[13px] font-semibold text-ink">
              {t("공개 범위")}
              <select
                value={meta.visibility}
                onChange={(e) => setMeta({ ...meta, visibility: e.target.value as Visibility })}
                className="field"
              >
                {(Object.keys(VISIBILITY_LABEL) as Visibility[]).map((v) => (
                  <option key={v} value={v}>{t(VISIBILITY_LABEL[v])}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-[13px] font-semibold text-ink">
              {t("리스트 언어")}
              <select value={meta.lang} onChange={(e) => setMeta({ ...meta, lang: e.target.value })} className="field">
                {LANGS.map((l) => (
                  <option key={l.id} value={l.id}>{l.label}</option>
                ))}
              </select>
              <span className="text-[12px] font-normal text-muted">{t("‘타인의 핀’에서 이 언어를 고른 사람에게 보여요.")}</span>
            </label>
          </div>}
          {isOwner && <label className="grid gap-1 text-[13px] font-semibold text-ink">
            {t("주소")}
            <span className="flex items-center rounded-lg border border-rule bg-surface pl-3 text-[14px] font-normal text-muted focus-within:outline-2 focus-within:outline-teal">
              /@{handle}/
              <input
                value={meta.slug}
                onChange={(e) => setMeta({ ...meta, slug: e.target.value })}
                className="min-w-0 flex-1 rounded-r-lg bg-white px-2 py-2.5 text-[15px] text-ink outline-none"
              />
            </span>
          </label>}
          <p className="text-[12px] text-muted">{t("제목·설명·공개 범위 등은 위쪽 ‘변경 저장’으로 저장해요. 섹션과 장소는 바꾸는 즉시 저장돼요.")}</p>
        </form>

        {/* 섹션 */}
        <section className="mt-10" aria-labelledby="sections-h">
          <h2 id="sections-h" className="text-[15px] font-semibold text-ink">{t("섹션")}</h2>
          <p className="mt-1 text-[13px] text-muted">{t("장소를 묶는 단위입니다. 예: Day 1, 아침, 카페")}</p>
          <ul className="mt-3 grid gap-2">
            {sections.map((s) => (
              <li key={s.id} className="flex gap-2">
                <input
                  defaultValue={s.name}
                  aria-label={t("섹션 이름")}
                  maxLength={60}
                  onBlur={(e) => e.target.value !== s.name && renameSection(s.id, e.target.value)}
                  className="field"
                />
                <button type="button" onClick={() => deleteSection(s.id)} className="btn-quiet shrink-0">
                  {t("삭제")}
                </button>
              </li>
            ))}
          </ul>
          <form onSubmit={addSection} className="mt-2 flex gap-2">
            <input
              value={newSection}
              onChange={(e) => setNewSection(e.target.value)}
              maxLength={60}
              placeholder={t("새 섹션 이름")}
              aria-label={t("새 섹션 이름")}
              className="field"
            />
            <button type="submit" className="btn-quiet shrink-0">{t("섹션 추가")}</button>
          </form>
        </section>

        {/* 장소 추가: 지도에서 */}
        <div className="mt-10 rounded-xl bg-surface p-4">
          <p className="text-[15px] font-semibold text-ink">{t("장소 추가")}</p>
          <p className="mt-1 text-[14px] text-ink/75">{t("맨 위 검색창에서 장소를 찾으면 이 리스트에 바로 들어갑니다.")}</p>
          <button type="button" onClick={() => setPanelOpen(false)} className="btn-quiet mt-3 lg:hidden">
            {t("지도 보기")}
          </button>
        </div>

        {/* 장소 목록 */}
        <section className="mt-10" aria-labelledby="items-h">
          <h2 id="items-h" className="text-[15px] font-semibold text-ink">{t("장소 {n}곳", { n: items.length })}</h2>
          {/* 코스 번호: 켜면 1, 2, 3 번호와 지도 위 경로선이 생긴다. 바로 저장된다. */}
          <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-rule p-3">
            <input
              type="checkbox"
              checked={meta.kind === "course"}
              onChange={(e) => setKind(e.target.checked ? "course" : "collection")}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-pin)]"
            />
            <span>
              <span className="block text-[14px] font-semibold text-ink">{t("방문 순서대로 번호 붙이기 (코스)")}</span>
              <span className="mt-0.5 block text-[13px] text-muted">
                {t("켜면 장소에 1, 2, 3 번호가 붙고 지도에 순서대로 선이 이어집니다. 순서는 아래 ↑↓ 버튼으로 바꿉니다.")}
              </span>
            </span>
          </label>
          {items.length === 0 && (
            <p className="mt-2 text-[14px] text-muted">{t("지도에서 장소를 검색해 첫 장소를 추가하세요.")}</p>
          )}
          <ol className="mt-3 grid gap-3">
            {items.map((item, index) => (
              <li
                key={item.id}
                id={`item-${item.id}`}
                className={`rounded-xl border p-4 ${item.id === selectedId ? "border-teal" : "border-rule"}`}
              >
                <div className="flex items-start gap-2">
                  {meta.kind === "course" && (
                    <span className="mt-2.5 w-5 text-right text-[13px] font-semibold tabular-nums text-pin">{index + 1}</span>
                  )}
                  <div className="grid min-w-0 flex-1 gap-2">
                    {item.adder && item.added_by !== ownerId && (
                      <span className="text-[12px] text-muted">{t("추가: {name}", { name: item.adder.display_name || item.adder.handle })}</span>
                    )}
                    <input
                      defaultValue={item.custom_title}
                      aria-label={t("장소 이름")}
                      maxLength={120}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== item.custom_title) updateItem(item.id, { custom_title: v });
                      }}
                      className="field !font-semibold"
                    />
                    <textarea
                      defaultValue={item.memo}
                      aria-label={t("메모")}
                      rows={2}
                      placeholder={t("메모")}
                      onBlur={(e) => e.target.value !== item.memo && updateItem(item.id, { memo: e.target.value })}
                      className="field"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      {sections.length > 0 && (
                        <select
                          value={item.section_id ?? ""}
                          onChange={(e) => updateItem(item.id, { section_id: e.target.value || null })}
                          aria-label={t("섹션")}
                          className="field !w-auto !py-1.5 !text-[14px]"
                        >
                          <option value="">{t("섹션 없음")}</option>
                          {sections.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      )}
                      <span className="ml-auto flex gap-1">
                        <button type="button" onClick={() => moveItem(index, -1)} disabled={index === 0} className="btn-quiet !px-2.5 disabled:opacity-30" aria-label={t("위로")}>↑</button>
                        <button type="button" onClick={() => moveItem(index, 1)} disabled={index === items.length - 1} className="btn-quiet !px-2.5 disabled:opacity-30" aria-label={t("아래로")}>↓</button>
                        <button type="button" onClick={() => removeItem(item.id)} className="btn-quiet">{t("빼기")}</button>
                      </span>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {isOwner && (monetize || money?.eligible) && (
          <label className="mt-10 flex cursor-pointer items-start gap-3 rounded-xl border border-rule p-3">
            <input
              type="checkbox"
              checked={monetize}
              onChange={(e) => toggleMonetize(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-pin)]"
            />
            <span>
              <span className="block text-[14px] font-semibold text-ink">{t("이 리스트로 수익화할 것이다")}</span>
              <span className="mt-0.5 block text-[13px] text-muted">
                {t("켜면 공동 편집자별 수익 배분을 정할 수 있고, 편집자도 자기 몫을 볼 수 있어요. 끄면 배분은 보이지 않아요.")}
              </span>
            </span>
          </label>
        )}
        {isOwner && <EditorsManager listId={listId} monetize={monetize} />}
        {!isOwner && <MyShare listId={listId} />}
        <ChangeLog listId={listId} />

        {isOwner && (
          <section className="mt-16 border-t border-rule pt-6">
            <ConfirmButton
              label={t("리스트 삭제")}
              question={t("이 리스트를 지울까요? 담긴 장소와 메모, 댓글도 함께 지워지고 되돌릴 수 없어요. 공유한 링크도 더 이상 열리지 않아요.")}
              confirmLabel={t("지우기")}
              onConfirm={deleteList}
              className="text-[14px] font-semibold text-pin hover:underline"
            />
          </section>
        )}
      </div>
    </Panel>
  );
}
