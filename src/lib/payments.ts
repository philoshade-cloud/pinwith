// 카드 결제 서비스 고르기: 가게가 있는 나라에 맞춰 고른다.
// 지금: 대한민국 → 토스페이먼츠(원화), 그 밖 → Stripe(기본 통화).
// 진출국이 늘면 그 시장에서 많이 쓰는 결제를 여기에 더한다(예: 일본 KOMOJU·PayPay, 인도 Razorpay,
// 동남아 Xendit, 중남미 Mercado Pago). 화면과 API는 이 표만 보고 움직인다.
export type PayProvider = "toss" | "stripe";

export const PAY_COUNTRIES: { code: string; name: string }[] = [
  { code: "KR", name: "대한민국" },
  { code: "JP", name: "일본" },
  { code: "SG", name: "싱가포르" },
  { code: "TW", name: "대만" },
  { code: "HK", name: "홍콩" },
  { code: "TH", name: "태국" },
  { code: "VN", name: "베트남" },
  { code: "MY", name: "말레이시아" },
  { code: "ID", name: "인도네시아" },
  { code: "PH", name: "필리핀" },
  { code: "AU", name: "호주" },
  { code: "US", name: "미국" },
  { code: "CA", name: "캐나다" },
  { code: "GB", name: "영국" },
  { code: "FR", name: "프랑스" },
  { code: "DE", name: "독일" },
  { code: "ES", name: "스페인" },
  { code: "IT", name: "이탈리아" },
  { code: "XX", name: "그 밖의 나라" },
];

export const PROVIDER_LABEL: Record<PayProvider, string> = { toss: "토스페이먼츠", stripe: "Stripe" };

export function providerFor(country: string): PayProvider {
  return country === "KR" ? "toss" : "stripe";
}
