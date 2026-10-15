import { serviceDb } from "@/lib/placeCoords";

// 토스 결제창에서 돌아오면(successUrl) 금액이 맞는지 확인하고 결제를 승인한 뒤 잔액에 넣는다.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (q: string) => Response.redirect(`${url.origin}/biz/place?paid=${q}`, 303);
  const paymentKey = url.searchParams.get("paymentKey") ?? "";
  const orderId = url.searchParams.get("orderId") ?? "";
  const amount = Number(url.searchParams.get("amount"));
  const db = serviceDb();
  const secret = process.env.TOSS_SECRET_KEY;
  if (!db || !secret || !paymentKey || !/^[0-9a-f-]{36}$/i.test(orderId)) return back("fail");

  const { data: t } = await db.from("biz_topups").select("id, status, pay_amount, provider").eq("id", orderId).maybeSingle();
  if (!t || t.provider !== "toss") return back("fail");
  if (t.status === "paid") return back("ok");
  // 결제창에서 넘어온 금액이 처음 만든 금액과 다르면 승인하지 않는다(위변조 방지)
  if (Number(t.pay_amount) !== amount) return back("fail");

  const res = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${secret}:`).toString("base64")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  });
  const pay = (await res.json().catch(() => null)) as { status?: string } | null;
  if (!res.ok || pay?.status !== "DONE") return back("fail");
  await db
    .from("biz_topups")
    .update({ status: "paid", paid_at: new Date().toISOString(), external_id: paymentKey, reference: "토스 카드 결제" })
    .eq("id", t.id)
    .eq("status", "requested");
  return back("ok");
}
