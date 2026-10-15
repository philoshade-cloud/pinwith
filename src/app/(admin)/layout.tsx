import Link from "next/link";
import { Logo } from "@/components/Logo";

// 운영자 화면: 지도 없이 넓은 표로
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-[1100px] px-5 pb-20 pt-6">
      <Link href="/" aria-label="PinWith 지도로">
        <Logo size={28} />
      </Link>
      <div className="mt-6">{children}</div>
    </main>
  );
}
