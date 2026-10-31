import type { Metadata } from "next";
import Link from "next/link";
import { ByLang } from "@/components/ByLang";

export const metadata: Metadata = {
  title: "Contact",
  description: "How to reach the PinWith team: support, feedback, content removal and partnerships.",
  alternates: { languages: { ko: "/contact?lang=ko", en: "/contact?lang=en", "x-default": "/contact" } },
};

// 연락처(광고 심사·이용자 문의용).
export default function Contact() {
  return <ByLang ko={<ContactKo />} en={<ContactEn />} />;
}

function ContactEn() {
  return (
    <>
      <h1>Contact</h1>
      <p>
        Email us at <a href="mailto:support@pinwith.me">support@pinwith.me</a>. We usually reply within two business days.
      </p>
      <h2>What to write about</h2>
      <ul>
        <li><strong>Help with the app</strong>: signing in, lists, sharing, editing with friends. Tell us what device and browser you use.</li>
        <li><strong>Remove or correct content</strong>: send the link to the list or place and what should change. If a list uses your content or names you, we take it down on request.</li>
        <li><strong>Your account and data</strong>: deleting your account or getting a copy of your data. See also the <Link href="/privacy">privacy policy</Link>.</li>
        <li><strong>Creators and businesses</strong>: maps for your audience, or how your place appears. See <Link href="/for-creators">For creators</Link> and <Link href="/for-businesses">For businesses</Link>.</li>
        <li><strong>Feedback and ideas</strong>: anything you&apos;d like PinWith to do better.</li>
      </ul>
      <p>
        PinWith is operated by STRATO TRADINGS PTE. LTD. (Singapore, UEN 202402989G). <Link href="/about">About PinWith</Link>
      </p>
    </>
  );
}

function ContactKo() {
  return (
    <>
      <h1>문의</h1>
      <p>
        <a href="mailto:support@pinwith.me">support@pinwith.me</a>로 메일 보내 주세요. 보통 영업일 이틀 안에 답장드려요.
      </p>
      <h2>이런 일로 연락 주세요</h2>
      <ul>
        <li><strong>앱 사용 도움</strong>: 로그인, 리스트, 공유, 함께 편집하기. 쓰시는 기기와 브라우저를 함께 알려 주세요.</li>
        <li><strong>콘텐츠 삭제·수정</strong>: 리스트나 장소 링크와 바꿀 내용을 보내 주세요. 본인의 콘텐츠나 이름이 쓰인 리스트는 요청하시면 내려요.</li>
        <li><strong>계정과 데이터</strong>: 계정 삭제, 내 데이터 받기. <Link href="/privacy">개인정보처리방침</Link>도 참고해 주세요.</li>
        <li><strong>크리에이터·가게</strong>: 시청자용 지도, 가게 정보 관리. <Link href="/for-creators">크리에이터께</Link>, <Link href="/for-businesses">가게 사장님께</Link>를 보세요.</li>
        <li><strong>의견과 제안</strong>: PinWith가 더 나아졌으면 하는 점이라면 무엇이든요.</li>
      </ul>
      <p>
        PinWith는 STRATO TRADINGS PTE. LTD.(싱가포르, UEN 202402989G)가 운영해요. <Link href="/about">PinWith 소개</Link>
      </p>
    </>
  );
}
