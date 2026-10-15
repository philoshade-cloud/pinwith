import Link from "next/link";
import { Logo } from "@/components/Logo";

// 상업 이용자용 콘솔: 지도 없이 넓은 화면
export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-[1100px] px-4 pb-20 pt-5 sm:px-5">
      <div className="flex items-center gap-3">
        <Link href="/" aria-label="PinWith 지도로">
          <Logo size={28} />
        </Link>
        <Link href="/biz" className="ml-auto text-[13px] text-muted underline">콘솔 처음</Link>
        <Link href="/" className="text-[13px] text-muted underline">지도로</Link>
      </div>
      <div className="mt-6">{children}</div>
    </main>
  );
}
