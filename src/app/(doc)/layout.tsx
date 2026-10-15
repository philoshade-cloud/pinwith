import Link from "next/link";
import { Logo } from "@/components/Logo";

// 긴 글 화면(개인정보처리방침, 이용약관). 지도 없이 읽기 좋은 폭으로.
export default function DocLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-[720px] px-5 pb-20 pt-6">
      <Link href="/" aria-label="PinWith 지도로">
        <Logo size={28} />
      </Link>
      <article className="doc mt-8">{children}</article>
    </main>
  );
}
