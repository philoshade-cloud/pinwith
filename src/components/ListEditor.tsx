"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { shortLink } from "@/lib/share";
import type { ListItem, ListKind, Section, Visibility } from "@/lib/types";
import { Panel, PanelLoading } from "./shell/Panel";
import { EditorsManager } from "./CoEdit";
import { NoticeComposer } from "./NoticeComposer";
import { useMapScene, useShell, type Scene } from "./shell/context";

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
  const supabase = useMemo(() => createClient(), []);

  const [state, setState] = useState<"loading" | "ready" | "forbidden" | "missing">("loading");
  const [handle, setHandle] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [ownerId, setOwnerId] = useState("");
  const [meta, setMeta] = useState<Meta | null>(null);
  const [savedMeta, setSavedMeta] = useState<Meta | null>(null);
  const [metaMsg, setMetaMsg] = useState<string | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [newSection, setNewSection] = useState("");
  const { selectedId, toast: flash, refreshMine, setPanelOpen } = useShell();

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
            " list_items(id, place_id, custom_title, memo, section_id, position, added_by, places(lat, lng)," +
            " adder:profiles!list_items_added_by_fkey(handle, display_name))",
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
      setOwnerId(row.owner_id);
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
        // 공개 범위와 주소는 주인만 바꾼다(공동 편집자는 DB에서도 막힘)
        ...(isOwner ? { slug, visibility: meta.visibility } : {}),
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

  async function setKind(kind: ListKind) {
    if (!meta || !savedMeta) return;
    setMeta({ ...meta, kind });
    setSavedMeta({ ...savedMeta, kind });
    const { error } = await supabase.from("lists").update({ kind }).eq("id", listId);
    if (error) flash("저장하지 못했습니다. 다시 시도하세요.");
    else flash(kind === "course" ? "번호를 붙였습니다." : "번호를 뗐습니다.");
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
            addTarget: {
              listId,
              sections,
              onAdded: (item) => setItems((list) => [...list, item as ItemRow]),
            },
          },
    [state, mapItems, savedMeta?.kind, numbering, listId, sections],
  );
  useMapScene(scene);

  // 지도에서 핀을 고르면 편집 목록에서 그 장소로
  useEffect(() => {
    if (selectedId) document.getElementById(`item-${selectedId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selectedId]);

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
    await refreshMine();
    router.push("/");
  }

  async function copyLink() {
    if (!savedMeta) return;
    const url = shareUrl ?? `${window.location.origin}/@${handle}/${savedMeta.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      flash("링크를 복사했습니다.");
    } catch {
      flash(url);
    }
  }

  // ── 화면 ─────────────────────────────────
  if (state === "loading") return <PanelLoading />;
  if (state === "missing" || state === "forbidden")
    return (
      <Panel title="리스트 편집">
        <div className="p-5">
          <p className="text-[16px] text-ink">
            {state === "missing" ? "리스트를 찾을 수 없습니다." : "이 리스트를 편집할 권한이 없습니다."}
          </p>
          <Link href="/" className="btn-quiet mt-4">지도로 돌아가기</Link>
        </div>
      </Panel>
    );
  if (!meta || !savedMeta) return null;

  const viewHref = `/@${handle}/${savedMeta.slug}`;

  return (
    <Panel title={`편집 · ${savedMeta.title}`}>
      <div className="px-5 pb-10 pt-4">
        <nav className="flex items-center gap-2">
          <Link href={viewHref} className="btn-quiet">리스트 보기</Link>
          <Link href="/me/stats" className="btn-quiet">통계</Link>
          <button type="button" onClick={copyLink} className="btn-quiet">링크 복사</button>
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
          {isOwner && <div className="grid gap-4">
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
          </div>}
          {isOwner && <label className="grid gap-1 text-[13px] font-semibold text-ink">
            주소
            <span className="flex items-center rounded-lg border border-rule bg-surface pl-3 text-[14px] font-normal text-muted focus-within:outline-2 focus-within:outline-teal">
              /@{handle}/
              <input
                value={meta.slug}
                onChange={(e) => setMeta({ ...meta, slug: e.target.value })}
                className="min-w-0 flex-1 rounded-r-lg bg-white px-2 py-2.5 text-[15px] text-ink outline-none"
              />
            </span>
          </label>}
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
          <p className="mt-1 text-[14px] text-ink/75">맨 위 검색창에서 장소를 찾으면 이 리스트에 바로 들어갑니다.</p>
          <button type="button" onClick={() => setPanelOpen(false)} className="btn-quiet mt-3 lg:hidden">
            지도 보기
          </button>
        </div>

        {/* 장소 목록 */}
        <section className="mt-10" aria-labelledby="items-h">
          <h2 id="items-h" className="text-[15px] font-semibold text-ink">장소 {items.length}곳</h2>
          {/* 코스 번호: 켜면 1, 2, 3 번호와 지도 위 경로선이 생긴다. 바로 저장된다. */}
          <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-rule p-3">
            <input
              type="checkbox"
              checked={meta.kind === "course"}
              onChange={(e) => setKind(e.target.checked ? "course" : "collection")}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-pin)]"
            />
            <span>
              <span className="block text-[14px] font-semibold text-ink">방문 순서대로 번호 붙이기 (코스)</span>
              <span className="mt-0.5 block text-[13px] text-muted">
                켜면 장소에 1, 2, 3 번호가 붙고 지도에 순서대로 선이 이어집니다. 순서는 아래 ↑↓ 버튼으로 바꿉니다.
              </span>
            </span>
          </label>
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
                    {item.adder && item.added_by !== ownerId && (
                      <span className="text-[12px] text-muted">추가: {item.adder.display_name || item.adder.handle}</span>
                    )}
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

        <NoticeComposer listId={listId} />
        {isOwner && <EditorsManager listId={listId} />}

        {isOwner && (
          <section className="mt-16 border-t border-rule pt-6">
            <button type="button" onClick={deleteList} className="text-[14px] font-semibold text-pin hover:underline">
              리스트 삭제
            </button>
          </section>
        )}
      </div>
    </Panel>
  );
}
