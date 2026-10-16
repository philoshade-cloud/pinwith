import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/placeCoords";
import { presentmentCurrency } from "@/lib/payments";
import { allow, clientIp, tooMany } from "@/lib/rateLimit";

const ZERO_DECIMAL = new Set(["KRW", "JPY", "VND", "IDR"]);

// 기본 통화 → 현지 통화 환율(그날 시세). 받지 못하면 null(그때는 기본 통화로 결제).
async function rate(from: string, to: string): Promise<number | null> {
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${from}`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(4000) });
    const data = (await res.json()) as { result?: string; rates?: Record<string, number> };
    const r = data.rates?.[to];
    return data.result === "success" && r && r > 0 ? r : null;
  } catch {
    return null;
  }
}

// 광고비 카드 결제 시작(Stripe Checkout): 충전 기록을 만들고 결제 페이지 주소를 돌려준다.
export async function POST(req: Request) {
  if (!(await allow(`pay:${clientIp(req)}`, 10, 60))) return tooMany();
  let body: { businessId?: string; amount?: number; country?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  if (!process.env.STRIPE_SECRET_KEY) return Response.json({ error: "provider_not_ready" }, { status: 503 });
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

  const { data: s } = await supabase.from("monetization_settings").select("currency").maybeSingle();
  const currency = ((s?.currency as string) ?? "USD").toUpperCase();

  // 대한민국은 원화로 결제창을 열어야 국내 카드·간편결제가 보인다
  let payCurrency = currency;
  let payAmount = amount;
  const local = presentmentCurrency(country);
  if (local && local !== currency) {
    const r = await rate(currency, local);
    if (r) {
      payCurrency = local;
      payAmount = ZERO_DECIMAL.has(local) ? Math.round(amount * r) : Math.round(amount * r * 100) / 100;
    }
  }

  const { data: topup, error } = await supabase
    .from("biz_topups")
    .insert({ business_id: biz.id, amount, currency, method: "card", provider: "stripe", country, pay_amount: payAmount, pay_currency: payCurrency })
    .select("id")
    .single();
  if (error || !topup) return Response.json({ error: "insert" }, { status: 500 });

  const origin = new URL(req.url).origin;
  const orderName = `PinWith ad credit (광고비 충전) · ${biz.place_name}`.slice(0, 100);
  const form = new URLSearchParams({
    mode: "payment",
    success_url: `${origin}/biz/place?tab=billing&paid=stripe`,
    cancel_url: `${origin}/biz/place?tab=billing&paid=cancel`,
    client_reference_id: topup.id,
    "metadata[topup]": topup.id,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": payCurrency.toLowerCase(),
    "line_items[0][price_data][unit_amount]": String(Math.round(payAmount * (ZERO_DECIMAL.has(payCurrency) ? 1 : 100))),
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
  return Response.json({ url: session.url });
}
