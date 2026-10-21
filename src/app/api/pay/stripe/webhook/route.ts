import { createHmac, timingSafeEqual } from "node:crypto";
import { serviceDb } from "@/lib/placeCoords";
import { fromMinor, ZERO_DECIMAL } from "@/lib/stripeRefund";

// Stripe 알림을 받아 서명을 확인하고 PinWith 기록에 반영한다.
// - checkout.session.completed / async_payment_succeeded: 결제 완료 → 잔액에 넣기
// - charge.refunded: Stripe 대시보드에서 직접 환불한 것도 잔액에서 빼기(PinWith에서 처리한 환불은 이미 반영돼 있어 건너뜀)
// Stripe 대시보드 → Webhooks에 이 주소를 등록하고, 받은 서명 비밀값을 STRIPE_WEBHOOK_SECRET에 넣는다.
function verify(payload: string, header: string, secret: string) {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > 300 || !parts.v1) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v1);
  return a.length === b.length && timingSafeEqual(a, b);
}

type Session = { id: string; payment_status?: string; amount_total?: number; currency?: string; payment_intent?: string | null; metadata?: { topup?: string } };
type Charge = { id: string; payment_intent?: string | null; amount_refunded?: number; currency?: string };

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const db = serviceDb();
  const payload = await req.text();
  if (!secret || !db || !verify(payload, req.headers.get("stripe-signature") ?? "", secret)) {
    return new Response("invalid", { status: 400 });
  }
  const event = JSON.parse(payload) as { type: string; data: { object: Session & Charge } };

  // 국내 간편결제 등 나중에 확정되는 결제는 checkout.session.async_payment_succeeded로 온다
  const done = event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded";
  if (done && event.data.object.payment_status === "paid") {
    const s = event.data.object as Session;
    const id = s.metadata?.topup;
    if (id) {
      const { data: t } = await db.from("biz_topups").select("id, pay_amount, pay_currency, status").eq("id", id).maybeSingle();
      const zeroDecimal = ZERO_DECIMAL.has(String(t?.pay_currency));
      const expected = t ? Math.round(Number(t.pay_amount) * (zeroDecimal ? 1 : 100)) : -1;
      if (t && t.status === "requested" && s.amount_total === expected) {
        await db
          .from("biz_topups")
          .update({ status: "paid", paid_at: new Date().toISOString(), external_id: s.id, payment_intent: s.payment_intent ?? null, reference: "Stripe 카드 결제" })
          .eq("id", t.id);
      }
    }
  }

  if (event.type === "charge.refunded") {
    const c = event.data.object as Charge;
    if (c.payment_intent && c.currency) {
      const { data: t } = await db
        .from("biz_topups")
        .select("id, business_id, amount, currency, pay_amount, refunded_amount, refunded_pay")
        .eq("provider", "stripe")
        .eq("payment_intent", c.payment_intent)
        .maybeSingle();
      if (t) {
        // Stripe 기준 지금까지 환불된 총액 − PinWith가 이미 반영한 금액 = 새로 반영할 몫
        const total = fromMinor(c.amount_refunded ?? 0, c.currency);
        const diffPay = Math.round((total - Number(t.refunded_pay)) * 100) / 100;
        if (diffPay > 0) {
          const rate = t.pay_amount ? Number(t.amount) / Number(t.pay_amount) : 1;
          const room = Number(t.amount) - Number(t.refunded_amount);
          const base = Math.min(room, Math.round(diffPay * rate * 100) / 100);
          await db.from("biz_topups").update({ refunded_amount: Number(t.refunded_amount) + base, refunded_pay: total }).eq("id", t.id);
          if (base > 0) {
            await db.from("biz_refunds").insert({
              business_id: t.business_id, amount: base, currency: t.currency, status: "refunded", method: "stripe", source: "stripe_dashboard",
              admin_note: "Stripe 대시보드에서 직접 환불", external_ids: [c.id], processed_at: new Date().toISOString(),
            });
          }
        }
      }
    }
  }
  return Response.json({ received: true });
}
