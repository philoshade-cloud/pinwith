"use client";

import { SCOPES, type SavedHit, type Scope } from "@/lib/savedSearch";
import { useT } from "@/lib/i18n/client";

// 검색 범위 고르기(여러 개 켤 수 있는 칩)
export function ScopeChips({ scopes, toggle }: { scopes: Scope[]; toggle: (s: Scope) => void }) {
  const t = useT();
  return (
    <span className="flex flex-wrap gap-1.5">
      {SCOPES.map((s) => {
        const on = scopes.includes(s.id);
        return (
          <button
            key={s.id}
            type="button"
            aria-pressed={on}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => toggle(s.id)}
            className={`rounded-full border px-2.5 py-0.5 text-[12px] font-semibold ${on ? "border-teal bg-teal text-white" : "border-rule bg-white text-muted"}`}
          >
            {on ? "✓ " : ""}{t(s.label)}
          </button>
        );
      })}
    </span>
  );
}

const WHERE: Record<SavedHit["matched"], string> = { title: "", tag: "태그", section: "섹션@@검색결과", memo: "메모", list: "" };

// 결과 한 줄: 장소면 '장소 · 리스트 이름', 리스트면 '리스트 · 만든 사람'
export function SavedHitRow({ hit, q, onPick, active }: { hit: SavedHit; q: string; onPick: (h: SavedHit) => void; active?: boolean }) {
  const t = useT();
  const place = hit.kind === "place";
  const detail =
    hit.matched === "memo" ? hit.memo
    : hit.matched === "tag" ? (hit.tags ?? []).map((x) => `#${x}`).join(" ")
    : hit.matched === "section" ? hit.section_name
    : null;
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onPick(hit)}
      className={`flex w-full items-start gap-2.5 px-3 py-2 text-left ${active ? "bg-surface" : "hover:bg-surface/60"}`}
    >
      <span aria-hidden className={`mt-0.5 shrink-0 text-[15px] ${place ? "text-pin" : "text-teal"}`}>{place ? "📍" : "☰"}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] text-ink"><Mark text={place ? hit.item_title ?? "" : hit.list_title} q={q} /></span>
        <span className="block truncate text-[12px] text-muted">
          {place ? hit.list_title : t("리스트")}
          {hit.scope !== "mine" && ` · ${hit.owner_name || `@${hit.owner_handle}`}`}
        </span>
        {detail && (
          <span className="mt-0.5 block truncate text-[12px] text-ink/70">
            {t(WHERE[hit.matched])}: <Mark text={detail} q={q} />
          </span>
        )}
      </span>
    </button>
  );
}

// 검색어 부분 강조
function Mark({ text, q }: { text: string; q: string }) {
  const term = q.trim();
  if (!term) return <>{text}</>;
  const i = text.toLowerCase().indexOf(term.toLowerCase());
  if (i < 0) return <>{text}</>;
  // 메모처럼 긴 글은 찾은 곳 근처부터 보여 준다
  const start = i > 24 ? i - 12 : 0;
  return (
    <>
      {start > 0 && "…"}
      {text.slice(start, i)}
      <mark className="rounded bg-[#fff1b8] px-0.5 text-ink">{text.slice(i, i + term.length)}</mark>
      {text.slice(i + term.length)}
    </>
  );
}
