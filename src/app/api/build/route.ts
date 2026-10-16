import { connection } from "next/server";

// 지금 배포된 빌드(커밋). 화면이 가진 값과 다르면 그 탭은 예전 배포다.
export async function GET() {
  await connection();
  return Response.json({ sha: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev" }, { headers: { "cache-control": "no-store" } });
}
