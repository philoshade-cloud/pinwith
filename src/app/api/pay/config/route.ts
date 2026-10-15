// 카드 결제(Stripe)가 준비됐는지(키가 들어 있는지)만 알려준다. 키 값은 보내지 않는다.
export async function GET() {
  return Response.json({ stripe: !!process.env.STRIPE_SECRET_KEY });
}
