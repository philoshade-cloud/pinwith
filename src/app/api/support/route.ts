import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/placeCoords";

// 문의·신고 접수: DB에 저장하고, 메일 설정이 있으면 운영자에게 메일로 보낸다.
// 메일 설정(Vercel 환경 변수): RESEND_API_KEY, SUPPORT_INBOX(받을 주소), SUPPORT_FROM(보내는 주소, 도메인 인증 후)
const CATEGORIES = { question: "이용 문의", bug: "오류·불편 신고", report: "부적절한 내용 신고", partnership: "제휴·광고 문의", other: "기타" } as const;

export async function POST(req: Request) {
  let body: { category?: string; email?: string; body?: string; pageUrl?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const category = (body.category ?? "") in CATEGORIES ? (body.category as keyof typeof CATEGORIES) : "other";
  const text = (body.body ?? "").trim().slice(0, 4000);
  const email = (body.email ?? "").trim().slice(0, 200) || null;
  const pageUrl = (body.pageUrl ?? "").slice(0, 500) || null;
  if (!text) return Response.json({ ok: false, error: "empty" }, { status: 400 });

  const supabase = await createServerSupabase();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = (claims?.claims?.sub as string | undefined) ?? null;
  const row = { user_id: userId, category, email, body: text, page_url: pageUrl };
  // 로그인 여부와 관계없이 저장: 서버 키가 있으면 그걸로, 없으면 사용자 권한으로
  const db = serviceDb() ?? supabase;
  const { error } = await db.from("support_requests").insert(row);
  if (error) return Response.json({ ok: false }, { status: 500 });

  const key = process.env.RESEND_API_KEY;
  const to = process.env.SUPPORT_INBOX;
  if (key && to) {
    let who = "로그인 안 함";
    if (userId) {
      const { data: p } = await supabase.from("profiles").select("handle, display_name").eq("id", userId).maybeSingle();
      if (p) who = `${p.display_name} (@${p.handle})`;
    }
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.SUPPORT_FROM || "PinWith <onboarding@resend.dev>",
        to: [to],
        reply_to: email ?? undefined,
        subject: `[PinWith ${CATEGORIES[category]}] ${text.slice(0, 40)}`,
        text: `분류: ${CATEGORIES[category]}\n보낸 사람: ${who}\n답장 받을 메일: ${email ?? "(없음)"}\n화면: ${pageUrl ?? "-"}\n\n${text}`,
      }),
    }).catch(() => {});
  }
  return Response.json({ ok: true });
}
