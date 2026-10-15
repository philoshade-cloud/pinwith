"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ListItem, ListKind, Section, Visibility } from "@/lib/types";

const SearchableMap = dynamic(() => import("./SearchableMap").then((m) => m.SearchableMap), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-surface" />,
});

type Meta = {
  title: string;
  description: string;
  slug: string;
  visibility: Visibility;
  kind: ListKind;
  themes: string;
};

type ItemRow = {
  id: string;
  place_id: string;
  custom_title: string;
  memo: string;
  section_id: string | null;
  position: number;
  places: { lat: number | null; lng: number | null } | null;
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
  const supabase = useMemo(() => createClient(), []);

  const [state, setState] = useState<"loading" | "ready" | "forbidden" | "missing">("loading");
  const [handle, setHandle] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [savedMeta, setSavedMeta] = useState<Meta | null>(null);
  const [metaMsg, setMetaMsg] = useState<string | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [newSection, setNewSection] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // 모바일: 편집 / 지도(장소 추가) 전환. 데스크톱은 둘 다 보인다.
  const [view, setView] = useState<"edit" | "map">("edit");
  const [toast, setToast] = useState<string | null>(null);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  }, []);

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
          "id, owner_id, slug, title, description, visibility, kind, themes," +
            " owner:profiles!lists_owner_id_fkey(handle)," +
            " sections(id, name, position)," +
            " list_items(id, place_id, custom_title, memo, section_id, position, places(lat, lng))",
        )
        .eq("id", listId)
        .maybeSingle();
      if (!data) return setState("missing");

      const row = data as unknown as {
        owner_id: string; slug: string; title: string; description: string;
        visibility: Visibility; kind: ListKind; themes: string[];
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
      };
      setIsOwner(owner);
      setHandle(row.owner?.handle ?? "");
      setMeta(m);
      setSavedMeta(m);
      setSections([...row.sections].sort((a, b) => a.position - b.position));
      setItems([...row.list_items].sort((a, b) => a.position - b.position));
      setState("ready");
    })();
  }, [listId, router, supabase]);

  // ── 리스트 정보 ─────────────────────────────
  const metaDirty = meta && savedMeta && JSON.stringify(meta) !== JSON.stringify(savedMeta);

  async function saveMeta(e: React.FormEvent) {
    e.preventDefault();
    if (!meta) return;
    const slug = meta.slug.trim().toLowerCase();
    if (!SLUG_RE.test(slug)) {
      setMetaMsg("주소는 영문 소문자, 숫자, 하이픈(-)만 쓸 수 있습니다.");
      return;
    }
    if (!meta.title.trim()) {
      setMetaMsg("제목을 입력하세요.");
      return;
    }
    const themes = parseThemes(meta.themes);
    const { error } = await supabase
      .from("lists")
      .update({
        title: meta.title.trim(),
        description: meta.description.trim(),
        slug,
        visibility: meta.visibility,
        kind: meta.kind,
        themes,
      })
      .eq("id", listId);
    if (error) {
      setMetaMsg(error.code === "23505" ? "이미 쓰고 있는 주소입니다. 다른 주소를 정하세요." : "저장하지 못했습니다. 다시 시도하세요.");
      return;
    }
    const next = { ...meta, slug, themes: themes.map((t) => `#${t}`).join(" ") };
    setMeta(next);
    setSavedMeta(next);
    setMetaMsg("저장했습니다.");
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
    if (error || !data) return flash("섹션을 추가하지 못했습니다.");
    setSections((s) => [...s, data]);
    setNewSection("");
  }

  async function renameSection(id: string, name: string) {
    const clean = name.trim();
    if (!clean) return;
    const { error } = await supabase.from("sections").update({ name: clean }).eq("id", id);
    if (error) flash("섹션 이름을 저장하지 못했습니다.");
  }

  async function deleteSection(id: string) {
    const { error } = await supabase.from("sections").delete().eq("id", id);
    if (error) return flash("섹션을 지우지 못했습니다.");
    setSections((s) => s.filter((x) => x.id !== id));
    setItems((list) => list.map((i) => (i.section_id === id ? { ...i, section_id: null } : i)));
  }

  // ── 장소 ─────────────────────────────────
  // 장소 추가는 지도 위 검색(SearchableMap)에서 한다.
  function onPlaceAdded(item: ItemRow) {
    setItems((list) => [...list, item]);
    setSelectedId(item.id);
    flash(`${item.custom_title}을(를) 추가했습니다.`);
  }

  async function updateItem(id: string, patch: Partial<Pick<ItemRow, "custom_title" | "memo" | "section_id">>) {
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    const { error } = await supabase.from("list_items").update(patch).eq("id", id);
    if (error) flash("변경을 저장하지 못했습니다.");
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
    if (results.some((r) => r.error)) flash("순서를 저장하지 못했습니다.");
  }

  async function removeItem(id: string) {
    const { error } = await supabase.from("list_items").delete().eq("id", id);
    if (error) return flash("장소를 빼지 못했습니다.");
    setItems((list) => list.filter((i) => i.id !== id));
  }

  async function deleteList() {
    if (!window.confirm("이 리스트를 지울까요? 담긴 장소와 메모도 함께 지워집니다.")) return;
    const { error } = await supabase.from("lists").delete().eq("id", listId);
    if (error) return flash("리스트를 지우지 못했습니다.");
    router.push(handle ? `/@${handle}` : "/me");
  }

  async function copyLink() {
    if (!savedMeta) return;
    const url = `${window.location.origin}/@${handle}/${savedMeta.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      flash("링크를 복사했습니다.");
    } catch {
      flash(url);
    }
  }

  // ── 화면 ─────────────────────────────────
  if (state === "loading") return <p className="p-8 text-muted">불러오는 중</p>;
  if (state === "missing")
    return (
      <main className="mx-auto max-w-[560px] px-6 py-16">
        <p className="text-[16px] text-ink">리스트를 찾을 수 없습니다.</p>
        <Link href="/me" className="btn-quiet mt-4">내 리스트로 돌아가기</Link>
      </main>
    );
  if (state === "forbidden")
    return (
      <main className="mx-auto max-w-[560px] px-6 py-16">
        <p className="text-[16px] text-ink">이 리스트를 편집할 권한이 없습니다.</p>
        <Link href="/me" className="btn-quiet mt-4">내 리스트로 돌아가기</Link>
      </main>
    );
  if (!meta || !savedMeta) return null;

  const mapItems: ListItem[] = items.map((i) => ({
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
  }));
  const viewHref = `/@${handle}/${savedMeta.slug}`;

  return (
    <div className="lg:grid lg:h-dvh lg:grid-cols-[minmax(0,520px)_1fr]">
      <div className={`${view === "edit" ? "block" : "hidden"} overflow-y-auto px-5 pb-28 pt-5 lg:block lg:border-r lg:border-rule`}>
        <nav className="flex items-center gap-2">
          <Link href={handle ? `/@${handle}` : "/me"} className="text-[14px] text-muted hover:text-ink">← 내 지도</Link>
          <span className="ml-auto" />
          <button type="button" onClick={copyLink} className="btn-quiet">링크 복사</button>
          <Link href={viewHref} target="_blank" className="btn-quiet">보기</Link>
        </nav>

        {/* 리스트 정보 */}
        <form onSubmit={saveMeta} className="mt-6 grid gap-4">
          <label className="grid gap-1 text-[13px] font-semibold text-ink">
            제목
            <input
              value={meta.title}
              onChange={(e) => setMeta({ ...meta, title: e.target.value })}
              maxLength={120}
              className="field font-display !text-[22px] !font-semibold"
            />
          </label>
          <label className="grid gap-1 text-[13px] font-semibold text-ink">
            설명
            <textarea
              value={meta.description}
              onChange={(e) => setMeta({ ...meta, description: e.target.value })}
              rows={2}
              className="field"
              placeholder="이 리스트를 어떤 사람에게, 어떤 때에 추천하나요?"
            />
          </label>
          <label className="grid gap-1 text-[13px] font-semibold text-ink">
            테마 <span className="font-normal text-muted">최대 5개, 찾기 화면의 검색에 쓰입니다</span>
            <input
              value={meta.themes}
              onChange={(e) => setMeta({ ...meta, themes: e.target.value })}
              className="field"
              placeholder="#라멘 #혼자여행"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-[13px] font-semibold text-ink">
              공개 범위
              <select
                value={meta.visibility}
                onChange={(e) => setMeta({ ...meta, visibility: e.target.value as Visibility })}
                className="field"
              >
                {(Object.keys(VISIBILITY_LABEL) as Visibility[]).map((v) => (
                  <option key={v} value={v}>{VISIBILITY_LABEL[v]}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-[13px] font-semibold text-ink">
              방문 순서
              <select
                value={meta.kind}
                onChange={(e) => setMeta({ ...meta, kind: e.target.value as ListKind })}
                className="field"
              >
                <option value="collection">순서 없음 (모음)</option>
                <option value="course">순서대로 (코스)</option>
              </select>
            </label>
          </div>
          <label className="grid gap-1 text-[13px] font-semibold text-ink">
            주소
            <span className="flex items-center rounded-lg border border-rule bg-surface pl-3 text-[14px] font-normal text-muted focus-within:outline-2 focus-within:outline-teal">
              /@{handle}/
              <input
                value={meta.slug}
                onChange={(e) => setMeta({ ...meta, slug: e.target.value })}
                className="min-w-0 flex-1 rounded-r-lg bg-white px-2 py-2.5 text-[15px] text-ink outline-none"
              />
            </span>
          </label>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={!metaDirty} className="btn-primary disabled:opacity-40">
              변경 저장
            </button>
            {metaMsg && <span role="status" className="text-[14px] text-muted">{metaMsg}</span>}
          </div>
        </form>

        {/* 섹션 */}
        <section className="mt-10" aria-labelledby="sections-h">
          <h2 id="sections-h" className="text-[15px] font-semibold text-ink">섹션</h2>
          <p className="mt-1 text-[13px] text-muted">장소를 묶는 단위입니다. 예: Day 1, 아침, 카페</p>
          <ul className="mt-3 grid gap-2">
            {sections.map((s) => (
              <li key={s.id} className="flex gap-2">
                <input
                  defaultValue={s.name}
                  aria-label="섹션 이름"
                  maxLength={60}
                  onBlur={(e) => e.target.value !== s.name && renameSection(s.id, e.target.value)}
                  className="field"
                />
                <button type="button" onClick={() => deleteSection(s.id)} className="btn-quiet shrink-0">
                  삭제
                </button>
              </li>
            ))}
          </ul>
          <form onSubmit={addSection} className="mt-2 flex gap-2">
            <input
              value={newSection}
              onChange={(e) => setNewSection(e.target.value)}
              maxLength={60}
              placeholder="새 섹션 이름"
              aria-label="새 섹션 이름"
              className="field"
            />
            <button type="submit" className="btn-quiet shrink-0">섹션 추가</button>
          </form>
        </section>

        {/* 장소 추가: 지도에서 */}
        <div className="mt-10 rounded-xl bg-surface p-4">
          <p className="text-[15px] font-semibold text-ink">장소 추가</p>
          <p className="mt-1 text-[14px] text-ink/75">
            <span className="hidden lg:inline">오른쪽 지도 위 검색창에서 장소를 찾아 리스트에 추가하세요.</span>
            <span className="lg:hidden">지도에서 장소를 검색해 리스트에 추가합니다.</span>
          </p>
          <button type="button" onClick={() => setView("map")} className="btn-primary mt-3 lg:hidden">
            지도에서 장소 추가
          </button>
        </div>

        {/* 장소 목록 */}
        <section className="mt-10" aria-labelledby="items-h">
          <h2 id="items-h" className="text-[15px] font-semibold text-ink">장소 {items.length}곳</h2>
          {items.length === 0 && (
            <p className="mt-2 text-[14px] text-muted">지도에서 장소를 검색해 첫 장소를 추가하세요.</p>
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
                    <input
                      defaultValue={item.custom_title}
                      aria-label="장소 이름"
                      maxLength={120}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== item.custom_title) updateItem(item.id, { custom_title: v });
                      }}
                      className="field !font-semibold"
                    />
                    <textarea
                      defaultValue={item.memo}
                      aria-label="메모"
                      rows={2}
                      placeholder="메모"
                      onBlur={(e) => e.target.value !== item.memo && updateItem(item.id, { memo: e.target.value })}
                      className="field"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      {sections.length > 0 && (
                        <select
                          value={item.section_id ?? ""}
                          onChange={(e) => updateItem(item.id, { section_id: e.target.value || null })}
                          aria-label="섹션"
                          className="field !w-auto !py-1.5 !text-[14px]"
                        >
                          <option value="">섹션 없음</option>
                          {sections.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      )}
                      <span className="ml-auto flex gap-1">
                        <button type="button" onClick={() => moveItem(index, -1)} disabled={index === 0} className="btn-quiet !px-2.5 disabled:opacity-30" aria-label="위로">↑</button>
                        <button type="button" onClick={() => moveItem(index, 1)} disabled={index === items.length - 1} className="btn-quiet !px-2.5 disabled:opacity-30" aria-label="아래로">↓</button>
                        <button type="button" onClick={() => removeItem(item.id)} className="btn-quiet">빼기</button>
                      </span>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {isOwner && (
          <section className="mt-16 border-t border-rule pt-6">
            <button type="button" onClick={deleteList} className="text-[14px] font-semibold text-pin hover:underline">
              리스트 삭제
            </button>
          </section>
        )}
      </div>

      <div className={`${view === "map" ? "fixed inset-0 z-20" : "hidden"} lg:static lg:z-auto lg:block`}>
        <SearchableMap
          items={mapItems}
          selectedId={selectedId}
          showRoute={meta.kind === "course"}
          target={{ mode: "fixed", listId, sections }}
          sheetBottomPadClass="pb-24 lg:pb-4"
          onAdded={(_, item) => onPlaceAdded(item as ItemRow)}
          onSelect={(id) => {
            setSelectedId(id);
            if (window.innerWidth >= 1024) {
              document.getElementById(`item-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          }}
        />
      </div>

      {/* 모바일 전환 버튼 */}
      <div className="fixed inset-x-0 bottom-5 z-30 flex justify-center lg:hidden">
        <div role="tablist" aria-label="보기 방식" className="flex rounded-full bg-ink p-1 shadow-lg">
          {(["edit", "map"] as const).map((v) => (
            <button
              key={v}
              role="tab"
              type="button"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`rounded-full px-5 py-2 text-[14px] font-semibold transition-colors ${view === v ? "bg-white text-ink" : "text-white/80"}`}
            >
              {v === "edit" ? "편집" : "지도"}
            </button>
          ))}
        </div>
      </div>

      {toast && (
        <div role="status" className="fixed inset-x-0 bottom-20 z-40 lg:bottom-6 mx-auto w-fit max-w-[90vw] rounded-full bg-ink px-4 py-2 text-[14px] text-white">
          {toast}
        </div>
      )}
    </div>
  );
}
