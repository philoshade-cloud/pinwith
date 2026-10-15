// 광고비 카드 결제는 Stripe 하나로 받는다(2026-10-15 결정).
// 대한민국 가게: 원화로 결제창을 열어 국내 카드·네이버페이·삼성페이·페이코를 쓸 수 있게 한다
// (싱가포르 법인 Stripe 계정에서 가능, 카카오페이는 싱가포르 계정에서 지원되지 않음).
// 그 밖의 나라: 기본 통화로 결제. 나중에 특정 시장에 더 맞는 결제가 필요하면 여기서 나라별로 나눈다.
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

// 결제창에 보여 줄 통화: 나라별로 그 나라 결제 수단을 쓰려면 현지 통화가 필요하다
export function presentmentCurrency(country: string): string | null {
  return country === "KR" ? "KRW" : null;
}
