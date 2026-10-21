// 광고비 환불(서버 전용): 결제 통화 금액 ↔ Stripe 최소 단위, 충전 기록에서 환불할 몫 나누기.
export const ZERO_DECIMAL = new Set(["KRW", "JPY", "VND", "IDR"]);

export const toMinor = (amount: number, currency: string) =>
  Math.round(amount * (ZERO_DECIMAL.has(currency.toUpperCase()) ? 1 : 100));
export const fromMinor = (minor: number, currency: string) =>
  ZERO_DECIMAL.has(currency.toUpperCase()) ? minor : minor / 100;

export type TopupRow = {
  id: string;
  amount: number;
  currency: string;
  pay_amount: number | null;
  pay_currency: string | null;
  external_id: string | null;
  payment_intent: string | null;
  refunded_amount: number;
  refunded_pay: number;
};

// 돌려줄 금액(기본 통화)을 최근 카드 충전부터 나눈다. 모자라면 null.
export function allocate(net: number, topups: TopupRow[]) {
  const parts: { topup: TopupRow; base: number; pay: number; payCurrency: string }[] = [];
  let left = Math.round(net * 100) / 100;
  for (const tp of topups) {
    if (left <= 0) break;
    const room = Math.round((Number(tp.amount) - Number(tp.refunded_amount)) * 100) / 100;
    if (room <= 0) continue;
    const base = Math.min(room, left);
    const payCurrency = (tp.pay_currency ?? tp.currency).toUpperCase();
    const rate = tp.pay_amount ? Number(tp.pay_amount) / Number(tp.amount) : 1;
    const payRoom = Math.round(((tp.pay_amount ? Number(tp.pay_amount) : Number(tp.amount)) - Number(tp.refunded_pay)) * 100) / 100;
    // 이 충전분을 다 돌려주면 결제 통화로 남은 금액 전부(환율 반올림 차이 없이)
    let pay = base === room ? payRoom : fromMinor(toMinor(base * rate, payCurrency), payCurrency);
    pay = Math.min(pay, payRoom);
    if (pay <= 0) continue;
    parts.push({ topup: tp, base, pay, payCurrency });
    left = Math.round((left - base) * 100) / 100;
  }
  return left > 0 ? null : parts;
}

export async function stripe(path: string, init: { method?: string; form?: Record<string, string>; idempotencyKey?: string } = {}) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: init.method ?? (init.form ? "POST" : "GET"),
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      ...(init.form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(init.idempotencyKey ? { "Idempotency-Key": init.idempotencyKey } : {}),
    },
    body: init.form ? new URLSearchParams(init.form) : undefined,
  });
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  return { ok: res.ok, body };
}
