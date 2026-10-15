import Link from "next/link";

// 랜딩: 링크로 들어오는 사람 대부분은 리스트로 바로 가므로, 여기서는 만드는 사람을 위한 안내만 둔다.
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[640px] flex-col justify-center px-6 py-16">
      <p className="font-display text-[20px] font-semibold text-pin">PinWith</p>
      <h1 className="font-display mt-6 text-[44px] font-semibold leading-[1.05] tracking-[-0.025em] text-ink sm:text-[56px]">
        아는 곳을 핀으로 꽂아, 링크 하나로 건네세요.
      </h1>
      <p className="mt-6 max-w-[52ch] text-[17px] leading-relaxed text-ink/80">
        여행 영상에 나온 식당, 동네 단골집, 친구에게 알려주고 싶은 카페. 지도에 모아두면 받는 사람은
        로그인 없이 바로 보고, 구글 지도나 네이버 지도로 길을 찾아갑니다.
      </p>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/me?welcome=1" className="btn-primary !px-5 !py-3 !text-[15px]">
          내 지도 만들기
        </Link>
        <Link href="/explore" className="btn-quiet !px-5 !py-3 !text-[15px]">
          다른 사람 리스트 둘러보기
        </Link>
        <Link href="/demo" className="btn-quiet !px-5 !py-3 !text-[15px]">
          예시 리스트 보기
        </Link>
      </div>
    </main>
  );
}
