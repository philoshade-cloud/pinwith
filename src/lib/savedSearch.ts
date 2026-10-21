"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// 저장한 핀 검색(위쪽 검색창의 '내 핀에서' + /search 화면). 서버 함수 search_saved.
export type Scope = "mine" | "following" | "liked";
export const SCOPES: { id: Scope; label: string }[] = [
  { id: "mine", label: "내 리스트" },
  { id: "following", label: "팔로잉" },
  { id: "liked", label: "좋아요@@검색범위" },
];
export type SavedHit = {
  kind: "place" | "list"; scope: Scope; list_id: string; list_title: string; slug: string; owner_handle: string; owner_name: string;
  item_id: string | null; place_id: string | null; item_title: string | null; memo: string | null; tags: string[] | null;
  section_name: string | null; lat: number | null; lng: number | null; matched: "title" | "tag" | "section" | "memo" | "list";
};

export const hitHref = (h: SavedHit) => `/@${h.owner_handle}/${h.slug}`;

const KEY = "pw-search-scopes";
export function useScopes() {
  const [scopes, setScopes] = useState<Scope[]>(["mine", "following", "liked"]);
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (Array.isArray(v)) setScopes(v.filter((s): s is Scope => SCOPES.some((x) => x.id === s)));
    } catch {
      /* 저장값이 없거나 막혀 있으면 기본값 */
    }
  }, []);
  function toggle(s: Scope) {
    setScopes((cur) => {
      const next = cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s];
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* 저장 못 해도 괜찮다 */
      }
      return next;
    });
  }
  return { scopes, toggle };
}

// 글자를 칠 때마다(잠깐 멈춘 뒤) 저장한 핀에서 찾는다. 구글 요금과 무관.
export function useSavedSearch(q: string, scopes: Scope[], limit = 40, enabled = true) {
  const supabase = useMemo(() => createClient(), []);
  const [hits, setHits] = useState<SavedHit[] | null>(null);
  const seq = useRef(0);
  const key = scopes.slice().sort().join(",");
  useEffect(() => {
    const term = q.trim();
    const my = ++seq.current;
    if (!enabled || !term || !scopes.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHits(term && scopes.length ? null : []);
      return;
    }
    const timer = window.setTimeout(async () => {
      const { data } = await supabase.rpc("search_saved", { p_q: term, p_scopes: scopes, p_limit: limit });
      if (my === seq.current) setHits((data as SavedHit[] | null) ?? []);
    }, 200);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, q, key, limit, enabled]);
  return hits;
}
