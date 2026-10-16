import webpush from "web-push";
import { serviceDb } from "@/lib/placeCoords";
import { pushPayload, vapidKeys } from "@/lib/push";

// DB가 새 알림이 생겼다고 부르면(pg_net) 그 알림을 받는 사람의 기기들로 보낸다.
// 알림 id만 받고 내용은 DB에서 다시 읽으며, 한 알림은 한 번만 보낸다(pushed_at). 그래서 누가 이 주소를 불러도
// 이미 받을 사람에게 갈 알림이 한 번 더 가지는 않는다.
export async function POST(req: Request) {
  const db = serviceDb();
  if (!db) return Response.json({ skipped: "no service key" });
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "bad_request" }, { status: 400 });

  // 아직 안 보낸, 10분 안에 생긴 알림만 집어 들고(동시에 두 번 불려도 한 번만) 보낸 것으로 표시
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: claimed } = await db
    .from("notifications")
    .update({ pushed_at: new Date().toISOString() })
    .eq("id", id)
    .is("pushed_at", null)
    .gt("created_at", since)
    .select("user_id, kind, body, list_id, actor:profiles!notifications_actor_id_fkey(display_name, handle), list:lists(slug, owner:profiles!lists_owner_id_fkey(handle))")
    .maybeSingle();
  if (!claimed) return Response.json({ skipped: "already sent or too old" });

  const keys = await vapidKeys(db);
  if (!keys) return Response.json({ skipped: "no keys" });
  const { data: subs } = await db.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", claimed.user_id);
  if (!subs?.length) return Response.json({ sent: 0 });

  const site = (await db.from("app_secrets").select("value").eq("key", "site_url").maybeSingle()).data?.value as string | undefined;
  webpush.setVapidDetails(site ?? "https://pinwith-xiea.vercel.app", keys.publicKey, keys.privateKey);
  const { data: who } = await db.from("profiles").select("lang").eq("id", claimed.user_id).maybeSingle();
  const payload = JSON.stringify(pushPayload(claimed as unknown as Parameters<typeof pushPayload>[0], who?.lang === "en" ? "en" : "ko"));
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24 });
        sent++;
      } catch (e) {
        // 410/404: 기기에서 알림을 끄거나 앱을 지움 → 구독을 지운다
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await db.from("push_subscriptions").delete().eq("id", s.id);
      }
    }),
  );
  return Response.json({ sent });
}
