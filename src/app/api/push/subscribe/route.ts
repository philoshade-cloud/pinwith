import { createClient as createServerSupabase } from "@/lib/supabase/server";

// 이 기기를 알림 받을 곳으로 등록/해제(로그인한 사람 본인 것만)
export async function POST(req: Request) {
  const supabase = await createServerSupabase();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) return Response.json({ error: "login" }, { status: 401 });
  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  if (!body.endpoint?.startsWith("https://") || !body.keys?.p256dh || !body.keys?.auth) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  // 같은 기기가 다른 계정으로 등록돼 있었으면 그 줄을 바꾼다(서버 키 없이 본인 권한으로: 내 것이 아니면 새로 넣기만)
  const row = {
    user_id: userId, endpoint: body.endpoint.slice(0, 1000), p256dh: body.keys.p256dh.slice(0, 200), auth: body.keys.auth.slice(0, 100),
    user_agent: (req.headers.get("user-agent") ?? "").slice(0, 300) || null,
  };
  const { error } = await supabase.from("push_subscriptions").upsert(row, { onConflict: "endpoint" });
  if (error) return Response.json({ error: "save" }, { status: 500 });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const supabase = await createServerSupabase();
  const { endpoint } = (await req.json().catch(() => ({}))) as { endpoint?: string };
  if (endpoint) await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return Response.json({ ok: true });
}
