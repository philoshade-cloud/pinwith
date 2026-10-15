import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";

// 짧은 링크 /s/코드 → 리스트나 큐레이터 지도로 보낸다. 열림을 기록한다(유입 경로 집계용).
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const home = new URL("/", request.url);
  if (!/^[A-Za-z0-9]{4,12}$/.test(code)) return NextResponse.redirect(home);

  const db = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { data } = await db
    .from("short_links")
    .select(
      "code, target_list_id, list:lists(slug, owner:profiles!lists_owner_id_fkey(handle)), profile:profiles!short_links_target_profile_id_fkey(handle)",
    )
    .eq("code", code)
    .maybeSingle();
  const row = data as unknown as {
    target_list_id: string | null;
    list: { slug: string; owner: { handle: string } | null } | null;
    profile: { handle: string } | null;
  } | null;

  let path: string | null = null;
  if (row?.list?.owner) path = `/@${row.list.owner.handle}/${row.list.slug}`;
  else if (row?.profile) path = `/@${row.profile.handle}`;
  if (!path) return NextResponse.redirect(home);

  // 리스트 링크: 열림 기록은 리스트 화면이 남긴다(?s=코드로 어느 링크인지 전달).
  // 큐레이터 지도 링크: 여기서 기록한다.
  if (row?.list) {
    const url = new URL(path, request.url);
    url.searchParams.set("s", code);
    return NextResponse.redirect(url, 307);
  }
  await db.from("link_events").insert({ code, event: "open", referrer: request.headers.get("referer") });
  return NextResponse.redirect(new URL(path, request.url), 307);
}
