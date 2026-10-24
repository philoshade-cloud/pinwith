"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// 고른 리스트의 섹션 목록(장소를 저장할 때 바로 섹션까지 고르게). 새 리스트·빈 값이면 빈 목록.
export function useListSections(listId: string | null) {
  const supabase = useMemo(() => createClient(), []);
  const [loaded, setLoaded] = useState<{ listId: string; sections: { id: string; name: string }[] } | null>(null);
  useEffect(() => {
    if (!listId || listId.startsWith("__")) return;
    let alive = true;
    supabase
      .from("sections")
      .select("id, name")
      .eq("list_id", listId)
      .order("position")
      .then(({ data }) => {
        if (alive) setLoaded({ listId, sections: (data ?? []) as { id: string; name: string }[] });
      });
    return () => {
      alive = false;
    };
  }, [supabase, listId]);
  return loaded && loaded.listId === listId ? loaded.sections : [];
}
