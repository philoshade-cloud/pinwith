import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/placeCoords";

// 문의·신고 접수: DB(support_requests)에 저장하고 운영자 콘솔(/admin → 문의·신고)에서 확인한다.
const CATEGORIES = ["question", "bug", "report", "partnership", "other"] as const;

export async function POST(req: Request) {
  let body: { category?: string; email?: string; body?: string; pageUrl?: string; listId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const category = (CATEGORIES as readonly string[]).includes(body.category ?? "") ? body.category! : "other";
  const text = (body.body ?? "").trim().slice(0, 4000);
  const email = (body.email ?? "").trim().slice(0, 200) || null;
  const pageUrl = (body.pageUrl ?? "").slice(0, 500) || null;
  if (!text) return Response.json({ ok: false, error: "empty" }, { status: 400 });

  const supabase = await createServerSupabase();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = (claims?.claims?.sub as string | undefined) ?? null;
  // 로그인 여부와 관계없이 저장: 서버 키가 있으면 그걸로, 없으면 사용자 권한으로
  const db = serviceDb() ?? supabase;

  // '이 리스트 신고'로 왔으면 신고 대상 리스트를 함께 저장(콘솔에서 제목·주인·링크로 보임)
  let listId: string | null = null;
  if (body.listId && /^[0-9a-f-]{36}$/i.test(body.listId)) {
    const { data: l } = await db.from("lists").select("id").eq("id", body.listId).maybeSingle();
    listId = (l?.id as string | undefined) ?? null;
  }

  const { error } = await db
    .from("support_requests")
    .insert({ user_id: userId, category, email, body: text, page_url: pageUrl, list_id: listId });
  if (error) return Response.json({ ok: false }, { status: 500 });
  return Response.json({ ok: true });
}
