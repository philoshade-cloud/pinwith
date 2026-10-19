import { createHmac, timingSafeEqual } from "node:crypto";
import { serviceDb } from "@/lib/placeCoords";

// Stripe가 결제 완료를 알려주면(checkout.session.completed, async_payment_succeeded) 서명을 확인하고 잔액에 넣는다.
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

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const db = serviceDb();
  const payload = await req.text();
  if (!secret || !db || !verify(payload, req.headers.get("stripe-signature") ?? "", secret)) {
    return new Response("invalid", { status: 400 });
  }
  const event = JSON.parse(payload) as {
    type: string;
    data: { object: { id: string; payment_status?: string; amount_total?: number; currency?: string; metadata?: { topup?: string } } };
  };
  // 국내 간편결제 등 나중에 확정되는 결제는 checkout.session.async_payment_succeeded로 온다
  const done = event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded";
  if (done && event.data.object.payment_status === "paid") {
    const s = event.data.object;
    const id = s.metadata?.topup;
    if (id) {
      const { data: t } = await db.from("biz_topups").select("id, pay_amount, pay_currency, status").eq("id", id).maybeSingle();
      const zeroDecimal = ["KRW", "JPY", "VND", "IDR"].includes(String(t?.pay_currency));
      const expected = t ? Math.round(Number(t.pay_amount) * (zeroDecimal ? 1 : 100)) : -1;
      if (t && t.status === "requested" && s.amount_total === expected) {
        await db
          .from("biz_topups")
          .update({ status: "paid", paid_at: new Date().toISOString(), external_id: s.id, reference: "Stripe 카드 결제" })
          .eq("id", t.id);
      }
    }
  }
  return Response.json({ received: true });
}
