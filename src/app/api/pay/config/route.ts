// 어떤 카드 결제가 준비됐는지(키가 들어 있는지)만 알려준다. 키 값은 보내지 않는다.
export async function GET() {
  return Response.json({
    stripe: !!process.env.STRIPE_SECRET_KEY,
    toss: !!(process.env.TOSS_SECRET_KEY && process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY),
  });
}
