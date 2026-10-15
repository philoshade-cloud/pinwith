import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "상업 이용자용 콘솔" };

// 어떤 상업 이용자인지 고르면 각자의 콘솔로 보낸다
export default function Page() {
  return (
    <section className="mx-auto max-w-[640px]">
      <h1 className="font-display text-[28px] font-semibold text-ink">상업 이용자용 콘솔</h1>
      <p className="mt-2 text-[15px] text-muted">어떤 분인지 골라 주세요.</p>
      <div className="mt-6 grid gap-3">
        <Link href="/biz/curator" className="block rounded-2xl border border-rule p-5 hover:border-pin">
          <span className="block text-[18px] font-semibold text-ink">상업화를 원하는 큐레이터예요</span>
          <span className="mt-1 block text-[14px] text-muted">
            내 리스트에 붙는 광고 수익, 가게 제휴로 버는 수익을 보고, 지급을 요청해요.
          </span>
        </Link>
        <Link href="/biz/place" className="block rounded-2xl border border-rule p-5 hover:border-pin">
          <span className="block text-[18px] font-semibold text-ink">장소의 주인이에요. 손님을 모으고 싶어요</span>
          <span className="mt-1 block text-[14px] text-muted">
            가게를 인증하고, 큐레이터에게 보상 조건을 내걸고, 성과와 광고비를 관리해요.
          </span>
        </Link>
      </div>
    </section>
  );
}
