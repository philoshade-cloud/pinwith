import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/placeCoords";
import { allocate, stripe, toMinor, type TopupRow } from "@/lib/stripeRefund";

// 운영자: 가게의 환불 요청을 카드 충전분(Stripe)으로 돌려준다.
// 돌려주는 돈 = 요청 금액 − 수수료(운영자가 정함). 잔액에서는 요청 금액 전체가 빠진다(요청할 때 이미 빠짐).
// 웹훅(charge.refunded)이 같은 환불을 두 번 세지 않도록, Stripe를 부르기 전에 충전 기록의 환불 금액을 먼저 올려 둔다.
export async function POST(req: Request) {
  let body: { refundId?: string; fee?: number };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  if (!process.env.STRIPE_SECRET_KEY) return Response.json({ error: "provider_not_ready" }, { status: 503 });
  const supabase = await createServerSupabase();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  const db = serviceDb();
  if (!userId || !db) return Response.json({ error: "login" }, { status: 401 });
  const { data: admin } = await db.from("admins").select("user_id").eq("user_id", userId).maybeSingle();
  if (!admin) return Response.json({ error: "forbidden" }, { status: 403 });

  // 요청을 '처리 중'으로 잡는다(두 번 누르기 방지)
  const fee = Math.max(0, Math.round(Number(body.fee ?? 0) * 100) / 100);
  const { data: refund } = await db
    .from("biz_refunds")
    .update({ status: "processing", fee })
    .eq("id", body.refundId ?? "")
    .eq("status", "requested")
    .select("id, business_id, amount, fee")
    .maybeSingle();
  if (!refund) return Response.json({ error: "not_requested" }, { status: 409 });
  const net = Math.round((Number(refund.amount) - fee) * 100) / 100;
  const back = async (status: "requested" | "failed" | "processing", note: string) =>
    db.from("biz_refunds").update({ status, admin_note: note }).eq("id", refund.id);
  if (net <= 0) {
    await back("requested", "수수료가 요청 금액 이상이라 처리하지 않았어요.");
    return Response.json({ error: "fee" }, { status: 400 });
  }

  const { data: rows } = await db
    .from("biz_topups")
    .select("id, amount, currency, pay_amount, pay_currency, external_id, payment_intent, refunded_amount, refunded_pay")
    .eq("business_id", refund.business_id)
    .eq("provider", "stripe")
    .eq("status", "paid")
    .order("paid_at", { ascending: false });
  const parts = allocate(net, (rows as TopupRow[]) ?? []);
  if (!parts) {
    await back("requested", "카드 충전분에서 돌려줄 수 있는 금액이 모자라요. 계좌 환불로 처리하세요.");
    return Response.json({ error: "card_room" }, { status: 409 });
  }

  const ids: string[] = [];
  for (const p of parts) {
    // Stripe 결제 id(payment_intent): 없으면 결제창 기록에서 찾는다
    let pi = p.topup.payment_intent;
    if (!pi && p.topup.external_id) {
      const s = await stripe(`checkout/sessions/${p.topup.external_id}`);
      pi = (s.body?.payment_intent as string | undefined) ?? null;
      if (pi) await db.from("biz_topups").update({ payment_intent: pi }).eq("id", p.topup.id);
    }
    if (!pi) {
      await back(ids.length ? "processing" : "requested", `결제 id를 찾지 못했어요(충전 ${p.topup.id}).${ids.length ? ` 이미 환불됨: ${ids.join(", ")}` : ""}`);
      return Response.json({ error: "payment_intent" }, { status: 502 });
    }
    const before = { refunded_amount: Number(p.topup.refunded_amount), refunded_pay: Number(p.topup.refunded_pay) };
    await db
      .from("biz_topups")
      .update({ refunded_amount: before.refunded_amount + p.base, refunded_pay: before.refunded_pay + p.pay })
      .eq("id", p.topup.id);
    const r = await stripe("refunds", {
      form: {
        payment_intent: pi,
        amount: String(toMinor(p.pay, p.payCurrency)),
        reason: "requested_by_customer",
        "metadata[pinwith_refund]": refund.id,
        "metadata[topup]": p.topup.id,
      },
      idempotencyKey: `pinwith-refund-${refund.id}-${p.topup.id}`,
    });
    if (!r.ok) {
      await db.from("biz_topups").update(before).eq("id", p.topup.id);
      const msg = ((r.body?.error as { message?: string } | undefined)?.message ?? "Stripe 오류").slice(0, 300);
      await back(ids.length ? "processing" : "requested", `Stripe 환불 실패: ${msg}${ids.length ? ` / 이미 환불됨: ${ids.join(", ")}` : ""}`);
      return Response.json({ error: "stripe", message: msg }, { status: 502 });
    }
    ids.push(String(r.body?.id));
  }

  await db
    .from("biz_refunds")
    .update({ status: "refunded", method: "stripe", external_ids: ids, processed_at: new Date().toISOString(), admin_note: null })
    .eq("id", refund.id);
  return Response.json({ ok: true, refunds: ids });
}
