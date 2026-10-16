import { ConsoleTopBar } from "@/components/console/ui";

// 상업 이용자용 콘솔: 지도 없이 넓은 화면
export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-[1100px] px-4 pb-20 pt-5 sm:px-5">
      <ConsoleTopBar />
      <div className="mt-6">{children}</div>
    </main>
  );
}
