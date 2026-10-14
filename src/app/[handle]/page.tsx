import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCuratorPage } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/env";

// /@handle — 큐레이터 홈: 공개 리스트와 팔로우 버튼.
export default function CuratorPage({ params }: PageProps<"/[handle]">) {
  return (
    <main className="mx-auto max-w-[640px] px-5 py-10">
      <Suspense fallback={<p className="text-muted">불러오는 중</p>}>
        <CuratorContent params={params} />
      </Suspense>
    </main>
  );
}

async function CuratorContent({ params }: { params: PageProps<"/[handle]">["params"] }) {
  const { handle } = await params;
  if (!decodeURIComponent(handle).startsWith("@") || !isSupabaseConfigured()) notFound();
  const page = await getCuratorPage(handle);
  if (!page) notFound();
  const { curator, lists } = page;

  return (
    <>
      <h1 className="font-display text-[32px] font-semibold tracking-[-0.02em] text-ink">{curator.displayName}</h1>
      <p className="mt-1 text-[14px] text-muted">
        @{curator.handle} · 팔로워 {curator.followerCount.toLocaleString("ko-KR")}
      </p>
      {curator.bio && <p className="mt-4 text-[16px] leading-relaxed text-ink/80">{curator.bio}</p>}
      <div className="mt-5">
        <Link href={`/login?next=/@${curator.handle}`} className="btn-primary">
          팔로우
        </Link>
      </div>

      <h2 className="mt-12 text-[15px] font-semibold text-teal">리스트 {lists.length}개</h2>
      {lists.length === 0 ? (
        <p className="mt-3 text-[15px] text-muted">아직 공개한 리스트가 없습니다.</p>
      ) : (
        <ul className="mt-3 divide-y divide-rule border-y border-rule">
          {lists.map((l) => (
            <li key={l.id}>
              <Link href={`/@${curator.handle}/${l.slug}`} className="block py-4 hover:bg-surface/60">
                <span className="block text-[17px] font-semibold text-ink">{l.title}</span>
                <span className="mt-1 block text-[13px] text-muted">
                  장소 {l.itemCount}곳 · 좋아요 {l.likeCount.toLocaleString("ko-KR")}
                  {l.themes.length > 0 && ` · ${l.themes.map((t) => `#${t}`).join(" ")}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
