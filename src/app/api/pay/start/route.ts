import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/placeCoords";
import { providerFor } from "@/lib/payments";

// 광고비 카드 결제 시작: 충전 기록을 만들고, 나라에 맞는 결제 서비스로 보낸다.
// 토스: 화면에서 결제창을 띄울 값을 돌려준다. Stripe: 결제 페이지 주소를 돌려준다.
export async function POST(req: Request) {
  let body: { businessId?: string; amount?: number; country?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const supabase = await createServerSupabase();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) return Response.json({ error: "login" }, { status: 401 });

  const amount = Math.round(Number(body.amount) * 100) / 100;
  const country = /^[A-Z]{2}$/.test(body.country ?? "") ? body.country! : "XX";
  if (!(amount > 0) || amount > 100000) return Response.json({ error: "amount" }, { status: 400 });

  const { data: biz } = await supabase
    .from("businesses")
    .select("id, place_name")
    .eq("id", body.businessId ?? "")
    .eq("owner_id", userId)
    .eq("status", "approved")
    .maybeSingle();
  if (!biz) return Response.json({ error: "business" }, { status: 403 });

  const { data: s } = await supabase.from("monetization_settings").select("currency, krw_per_unit").maybeSingle();
  const currency = (s?.currency as string) ?? "USD";
  const provider = providerFor(country);
  const ready = provider === "toss"
    ? !!(process.env.TOSS_SECRET_KEY && process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY)
    : !!process.env.STRIPE_SECRET_KEY;
  if (!ready) return Response.json({ error: "provider_not_ready", provider }, { status: 503 });

  // 토스는 원화로만 받는다: 기본 통화 금액 × 환율(운영자 콘솔 설정)
  const payCurrency = provider === "toss" ? "KRW" : currency;
  const payAmount = provider === "toss" ? (currency === "KRW" ? Math.round(amount) : Math.round(amount * Number(s?.krw_per_unit ?? 1400))) : amount;
  if (provider === "toss" && payAmount < 100) return Response.json({ error: "amount" }, { status: 400 });

  const { data: topup, error } = await supabase
    .from("biz_topups")
    .insert({ business_id: biz.id, amount, currency, method: "card", provider, country, pay_amount: payAmount, pay_currency: payCurrency })
    .select("id")
    .single();
  if (error || !topup) return Response.json({ error: "insert" }, { status: 500 });

  const origin = new URL(req.url).origin;
  const orderName = `PinWith 광고비 충전 · ${biz.place_name}`.slice(0, 100);

  if (provider === "toss") {
    return Response.json({ provider, orderId: topup.id, amount: payAmount, orderName, customerKey: userId });
  }

  // Stripe Checkout 세션
  const form = new URLSearchParams({
    mode: "payment",
    success_url: `${origin}/biz/place?paid=stripe`,
    cancel_url: `${origin}/biz/place?paid=cancel`,
    client_reference_id: topup.id,
    "metadata[topup]": topup.id,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": payCurrency.toLowerCase(),
    "line_items[0][price_data][unit_amount]": String(Math.round(payAmount * (payCurrency === "KRW" || payCurrency === "JPY" ? 1 : 100))),
    "line_items[0][price_data][product_data][name]": orderName,
  });
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const session = (await res.json().catch(() => null)) as { id?: string; url?: string } | null;
  if (!res.ok || !session?.url) return Response.json({ error: "stripe" }, { status: 502 });
  await serviceDb()?.from("biz_topups").update({ external_id: session.id }).eq("id", topup.id);
  return Response.json({ provider, url: session.url });
}
