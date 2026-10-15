// AdSense 판매자 확인 파일(/ads.txt). NEXT_PUBLIC_ADSENSE_CLIENT(ca-pub-…)가 있으면 그걸로 만든다.
export function GET() {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "";
  const pub = client.replace(/^ca-/, "");
  const body = /^pub-\d+$/.test(pub) ? `google.com, ${pub}, DIRECT, f08c47fec0942fa0\n` : "# 광고 계정이 아직 연결되지 않았어요\n";
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
