import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/env";

// 로그인 세션 쿠키를 요청마다 갱신한다. 권한 판단은 여기서 하지 않는다(RLS가 담당).
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!isSupabaseConfigured()) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  // getClaims는 토큰을 이 서버에서 검증한다(만료됐으면 갱신). 인증 서버까지 왕복하지 않아 빠르다.
  await supabase.auth.getClaims();

  // 로그아웃 전까지 로그인 유지: 사파리 등은 화면(자바스크립트)이 쓴 쿠키를 7일 뒤 지운다.
  // 페이지를 열 때마다 서버가 로그인 쿠키를 다시 내려 주어(400일) 오래 안 들어와도 유지되게 한다.
  if (request.method === "GET" && (request.headers.get("accept") ?? "").includes("text/html")) {
    const already = new Set(response.cookies.getAll().map((c) => c.name));
    for (const c of request.cookies.getAll()) {
      if (!/^sb-.+-auth-token(\.\d+)?$/.test(c.name) || already.has(c.name)) continue;
      response.cookies.set(c.name, c.value, { path: "/", sameSite: "lax", secure: request.nextUrl.protocol === "https:", maxAge: 400 * 24 * 60 * 60 });
    }
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
