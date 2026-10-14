"use client";
import { createClient } from "@/lib/supabase/client";

// 새 리스트를 만들고 편집 화면 id를 돌려준다. 주소(slug)는 임시값이며 편집 화면에서 바꿀 수 있다.
export async function createEmptyList(): Promise<string> {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("not-signed-in");
  const slug = `list-${Math.random().toString(36).slice(2, 8)}`;
  const { data, error } = await supabase
    .from("lists")
    .insert({ owner_id: auth.user.id, slug, title: "새 리스트" })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("insert-failed");
  return data.id;
}
