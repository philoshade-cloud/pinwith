"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/i18n/client";
import { isLang, type Lang } from "@/lib/i18n/core";

// '타인의 핀'에서 볼 언어(My 화면에서 고름, profiles.explore_langs). 고른 게 없으면 화면 언어 하나.
// 리스트의 언어는 lists.lang(주인이 편집 화면에서 고름, 새 리스트는 만든 사람의 계정 언어로 시작). 비어 있으면 만든 사람의 계정 언어.
export function listLang(l: { lang?: string | null; owner?: { lang?: string | null } | null }): string {
  return l.lang ?? l.owner?.lang ?? "ko";
}

export function useExploreLangs() {
  const ui = useLang();
  const supabase = useMemo(() => createClient(), []);
  const [saved, setSaved] = useState<Lang[] | null | undefined>(undefined);
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return alive && setSaved(null);
      setUid(auth.user.id);
      const { data } = await supabase.from("profiles").select("explore_langs").eq("id", auth.user.id).maybeSingle();
      const v = (data?.explore_langs as string[] | null) ?? null;
      if (alive) setSaved(v ? v.filter(isLang) : null);
    })();
    return () => {
      alive = false;
    };
  }, [supabase]);

  const langs: Lang[] = saved && saved.length ? saved : [ui];

  const save = useCallback(
    async (next: Lang[]) => {
      setSaved(next);
      if (!uid) return false;
      const { error } = await supabase.from("profiles").update({ explore_langs: next.length ? next : null }).eq("id", uid);
      return !error;
    },
    [supabase, uid],
  );

  return { langs, ready: saved !== undefined, chosen: saved, save };
}
