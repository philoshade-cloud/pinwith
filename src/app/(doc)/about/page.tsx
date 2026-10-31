import type { Metadata } from "next";
import Link from "next/link";
import { ByLang } from "@/components/ByLang";

export const metadata: Metadata = {
  title: "About PinWith",
  description: "PinWith is a free map-list app: save places on one map, share it with a link, and plan trips together in 17 languages.",
  alternates: { languages: { ko: "/about?lang=ko", en: "/about?lang=en", "x-default": "/about" } },
};

// 서비스 소개(광고 심사·처음 온 사람용). 운영 주체와 연락처를 함께 적는다.
export default function About() {
  return <ByLang ko={<AboutKo />} en={<AboutEn />} />;
}

function AboutEn() {
  return (
    <>
      <h1>About PinWith</h1>
      <p>
        PinWith is a free app for keeping the places you care about on one map. Save restaurants, cafés, sights and stays into lists,
        add a short note to each pin, and share the whole map with a single link. Anyone who opens it sees the places on a map, in their
        own language, and can get directions to each one.
      </p>

      <h2>What you can do</h2>
      <ul>
        <li><strong>Make map lists</strong> for a trip, a neighbourhood, a food crawl or your everyday favourites, split into sections like days or areas.</li>
        <li><strong>Share with a link</strong>: lists can be public, open only to people with the link, or private.</li>
        <li><strong>Plan together</strong>: invite friends to edit a list and talk about each place in the pin comments.</li>
        <li><strong>Browse other people&apos;s lists</strong> by city in <Link href="/places">Cities</Link> and <Link href="/explore">Explore</Link>, and copy any place to your own map.</li>
        <li><strong>Use it in 17 languages</strong>, from English, Korean and Japanese to Arabic and Hindi.</li>
      </ul>

      <h2>For creators and businesses</h2>
      <p>
        Travel and food creators can turn the places from a video or post into one map their audience can follow, linked to the right
        moment in the video. See <Link href="/for-creators">For creators</Link>. Shop owners can manage how their place appears: see{" "}
        <Link href="/for-businesses">For businesses</Link>.
      </p>

      <h2>Example lists</h2>
      <p>
        Lists marked “Example” are made by the PinWith team from public information to show what a list can look like. They are not written by,
        or affiliated with, any particular creator or business.
      </p>

      <h2>Who runs PinWith</h2>
      <p>
        PinWith is operated by STRATO TRADINGS PTE. LTD. (Singapore, UEN 202402989G). Questions, feedback or requests to remove content:{" "}
        <a href="mailto:support@pinwith.me">support@pinwith.me</a> or the <Link href="/contact">contact page</Link>.
      </p>
      <p>
        <Link href="/terms">Terms of service</Link> · <Link href="/privacy">Privacy policy</Link>
      </p>
    </>
  );
}

function AboutKo() {
  return (
    <>
      <h1>PinWith 소개</h1>
      <p>
        PinWith는 아끼는 장소를 지도 한 장에 모아 두는 무료 앱이에요. 맛집, 카페, 명소, 숙소를 리스트로 저장하고 핀마다 짧은 메모를 달아,
        링크 하나로 지도 전체를 나눌 수 있어요. 링크를 연 사람은 자기 언어로 지도 위의 장소를 보고, 장소마다 길찾기를 할 수 있어요.
      </p>

      <h2>할 수 있는 일</h2>
      <ul>
        <li><strong>지도 리스트 만들기</strong>: 여행, 동네, 맛집 투어, 평소 단골 등. 날짜나 지역별로 구역을 나눌 수 있어요.</li>
        <li><strong>링크로 나누기</strong>: 전체 공개, 링크 있는 사람만, 나만 보기 중에서 고를 수 있어요.</li>
        <li><strong>함께 계획하기</strong>: 친구를 편집자로 초대하고, 핀마다 댓글로 의견을 나눠요.</li>
        <li><strong>다른 사람의 리스트 보기</strong>: <Link href="/places">도시별 리스트</Link>와 <Link href="/explore">둘러보기</Link>에서 찾아보고, 마음에 드는 장소를 내 지도로 담아요.</li>
        <li><strong>17개 언어</strong>로 쓸 수 있어요.</li>
      </ul>

      <h2>크리에이터·가게 사장님께</h2>
      <p>
        여행·맛집 크리에이터는 영상이나 글에 나온 장소를 시청자가 따라갈 수 있는 지도 한 장으로 만들 수 있어요. 핀마다 영상의 그 장면으로 이어져요.{" "}
        <Link href="/for-creators">크리에이터께</Link>를 보세요. 가게 사장님은 <Link href="/for-businesses">가게 사장님께</Link>를 보세요.
      </p>

      <h2>예시 리스트</h2>
      <p>
        ‘예시’ 표시가 있는 리스트는 리스트가 어떤 모습인지 보여 드리려고 PinWith 팀이 공개된 정보로 만든 거예요. 특정 크리에이터나 가게가 만들거나
        관여한 리스트가 아니에요.
      </p>

      <h2>운영</h2>
      <p>
        PinWith는 STRATO TRADINGS PTE. LTD.(싱가포르, UEN 202402989G)가 운영해요. 질문, 의견, 콘텐츠 삭제 요청은{" "}
        <a href="mailto:support@pinwith.me">support@pinwith.me</a> 또는 <Link href="/contact">문의 페이지</Link>로 보내 주세요.
      </p>
      <p>
        <Link href="/terms">이용약관</Link> · <Link href="/privacy">개인정보처리방침</Link>
      </p>
    </>
  );
}
