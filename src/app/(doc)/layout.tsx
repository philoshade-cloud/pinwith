import Link from "next/link";
import { BackHomeBar } from "@/components/BackHomeBar";

// 긴 글 화면(개인정보처리방침, 이용약관). 지도 없이 읽기 좋은 폭으로.
export default function DocLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-[720px] px-5 pb-20">
      <BackHomeBar />
      <article className="doc mt-6">{children}</article>
      <footer className="mt-14 border-t border-rule pt-5 text-[13px] text-muted">
        <p>
          <Link href="/places" className="underline">Cities · 도시별 리스트</Link>
          {" · "}
          <Link href="/for-creators" className="underline">For creators · 크리에이터께</Link>
          {" · "}
          <Link href="/for-businesses" className="underline">For businesses · 가게 사장님께</Link>
          {" · "}
          <Link href="/terms" className="underline">Terms · 이용약관</Link>
          {" · "}
          <Link href="/privacy" className="underline">Privacy · 개인정보처리방침</Link>
        </p>
        <p className="mt-2">
          <a href="mailto:support@pinwith.me" className="underline">support@pinwith.me</a> · STRATO TRADINGS PTE. LTD. (Singapore, UEN 202402989G)
        </p>
      </footer>
    </main>
  );
}
