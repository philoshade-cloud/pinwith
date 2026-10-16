import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

// 웹 푸시 키(VAPID): 처음 쓸 때 만들어 DB(app_secrets, 서버만 읽음)에 보관한다. 환경 변수를 따로 넣지 않아도 된다.
export async function vapidKeys(db: SupabaseClient): Promise<{ publicKey: string; privateKey: string } | null> {
  const { data } = await db.from("app_secrets").select("key, value").in("key", ["vapid_public", "vapid_private"]);
  const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value as string]));
  if (map.vapid_public && map.vapid_private) return { publicKey: map.vapid_public, privateKey: map.vapid_private };
  const keys = webpush.generateVAPIDKeys();
  // 동시에 두 번 만들어지지 않게: 이미 있으면 덮어쓰지 않고 다시 읽는다
  await db.from("app_secrets").upsert(
    [
      { key: "vapid_public", value: keys.publicKey },
      { key: "vapid_private", value: keys.privateKey },
    ],
    { onConflict: "key", ignoreDuplicates: true },
  );
  const { data: again } = await db.from("app_secrets").select("key, value").in("key", ["vapid_public", "vapid_private"]);
  const m2 = Object.fromEntries((again ?? []).map((r) => [r.key, r.value as string]));
  return m2.vapid_public && m2.vapid_private ? { publicKey: m2.vapid_public, privateKey: m2.vapid_private } : null;
}

type N = { kind: string; body: string | null; body_en?: string | null; list_id: string | null; actor: { display_name: string | null; handle: string } | null; list: { slug: string; owner: { handle: string } | null } | null };

const TITLE: Record<string, string> = {
  follow: "새 팔로워", like: "좋아요", comment: "새 댓글", reply: "내 댓글에 답글", invite: "공동 편집 초대", invite_accepted: "초대 수락",
  share_changed: "수익 배분 변경", notice: "새 공지", resolved: "메시지 반영", reservation: "예약 문의 답변", reservation_new: "새 예약 문의",
  reservation_msg: "예약 문의 메시지", biz_block: "리스트에서 빠짐", biz_alert: "연결된 가게 확인 필요", biz_review: "가게 인증", topup_paid: "광고비 충전",
  payout: "지급", dispute: "이의 제기", biz_admin: "운영자 조치", ops: "운영 알림",
};

const TITLE_EN: Record<string, string> = {
  follow: "New follower", like: "Like", comment: "New comment", reply: "Reply to your comment", invite: "Co-editing invite", invite_accepted: "Invite accepted",
  share_changed: "Revenue share changed", notice: "New notice", resolved: "Message applied", reservation: "Reservation reply", reservation_new: "New reservation inquiry",
  reservation_msg: "Reservation message", biz_block: "Removed from list", biz_alert: "Check a connected store", biz_review: "Store verification", topup_paid: "Ad credit top-up",
  payout: "Payout", dispute: "Dispute", biz_admin: "Admin action", ops: "Operations",
};

// 알림 한 건을 휴대폰 알림 문구와 눌렀을 때 열 주소로 바꾼다
export function pushPayload(n: N, lang: "ko" | "en" = "ko") {
  const who = n.actor ? n.actor.display_name || `@${n.actor.handle}` : "PinWith";
  const url =
    n.kind === "reservation_new" ? "/biz/place?tab=reservations"
      : n.kind === "reservation" || n.kind === "reservation_msg" ? "/me/reservations"
        : n.kind === "biz_alert" ? "/biz/curator?tab=stores"
          : n.kind === "biz_review" || n.kind === "topup_paid" ? "/biz/place"
            : n.kind === "payout" ? "/biz/curator?tab=payout"
              : n.kind === "dispute" ? (n.actor ? "/admin?tab=disputes" : "/notifications")
              : n.kind === "biz_admin" ? "/biz"
              : n.kind === "ops" ? (n.body?.includes("오류") ? "/admin?tab=errors" : "/admin?tab=usage")
              : n.kind === "follow" && n.actor ? `/@${n.actor.handle}`
                : n.list?.owner ? `/@${n.list.owner.handle}/${n.list.slug}` : "/notifications";
  return {
    title: `${(lang === "en" ? TITLE_EN[n.kind] : TITLE[n.kind]) ?? (lang === "en" ? "Notification" : "알림")}${n.actor ? ` · ${who}` : ""}`,
    body: (lang === "en" && n.body_en) || n.body || "",
    url,
    tag: n.kind === "reservation_msg" ? `rmsg` : undefined,
  };
}
