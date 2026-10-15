import type { Metadata } from "next";

export const metadata: Metadata = { title: "개인정보처리방침" };

// 초안: 도메인 확정 후 문의 이메일을 채우고 법률 검토를 받는다.
export default function Privacy() {
  return (
    <>
      <h1>개인정보처리방침</h1>
      <p className="note">시행일: 2026년 10월 15일 (초안, 예약·가게·지급 항목 추가)</p>

      <h2>1. 누가 운영하나요</h2>
      <p>PinWith(이하 “서비스”)는 다음 회사가 운영합니다.</p>
      <ul>
        <li>STRATO TRADINGS PTE. LTD. (싱가포르, 회사등록번호 UEN 202402989G)</li>
        <li>주소: 5008 Ang Mo Kio Avenue 5, #04-09, TechPlace II, Singapore 569874</li>
        <li>문의 이메일: [도메인 확정 후 기재]</li>
      </ul>

      <h2>2. 어떤 정보를 모으나요</h2>
      <ul>
        <li><b>계정</b>: 이메일 주소, 구글 로그인 시 구글이 알려주는 이름·프로필 사진</li>
        <li><b>프로필</b>: 핸들, 이름, 소개</li>
        <li><b>내가 만든 내용</b>: 리스트, 장소, 메모, 섹션, 태그, 팔로우, 좋아요</li>
        <li>
          <b>링크 이용 기록</b>: 공유 링크가 열린 횟수, 장소·길찾기 버튼을 누른 기록, 이전 페이지 주소(referrer).
          ‘가게 근처(500m)에서 눌렀는지’는 기기 안에서만 계산해 예/아니오만 저장하며, 위치 좌표 자체는 저장하지 않습니다.
        </li>
        <li><b>기기 식별값</b>: ‘모두 허용’에 동의한 경우에만 무작위 값을 기기에 저장해 방문 통계와 제휴 과금(같은 사람 중복 방지)에 씁니다.</li>
        <li><b>예약 문의</b>: 손님이 적은 이름·연락처·방문 날짜·시간·인원·요청 사항, 손님과 가게가 주고받은 메시지, 처리 상태(확정·방문·노쇼·취소)</li>
        <li><b>가게 계정</b>: 가게(구글 장소), 상호, 사업자등록번호, 담당자 이름·연락처, 사업자등록증 등 증빙 자료, 광고비 충전·결제 기록</li>
        <li><b>큐레이터 지급 정보</b>: 받는 사람 실명, 받는 방법(Wise·PayPal·은행), 계좌 또는 계정 이메일, 나라·통화, 지급 요청·지급 기록</li>
        <li><b>문의·신고</b>: 보낸 내용, 답장 받을 이메일(선택), 신고 대상 리스트</li>
      </ul>

      <h2>3. 왜 쓰나요</h2>
      <ul>
        <li>로그인, 리스트 만들기·공유 등 서비스 제공</li>
        <li>큐레이터에게 링크 반응 통계 제공, 광고 수익 나눔과 가게 제휴 정산·지급</li>
        <li>예약 문의 전달과 처리, 노쇼·취소 패턴 확인(가게별 통계로만 쓰고 손님 개인을 평가하지 않음)</li>
        <li>가게 계정의 실제 운영 여부 확인(운영자가 증빙 자료와 가게 전화번호로 확인)</li>
        <li>부정 이용 방지, 서비스 개선</li>
        <li>광고(도입 시): 동의한 경우에만 맞춤 광고, 그 외에는 비맞춤 광고</li>
      </ul>

      <h2>4. 다른 이용자에게 전달되는 정보 (제3자 제공)</h2>
      <ul>
        <li>
          <b>예약 문의를 보낸 가게</b>: 손님이 예약 문의를 보내면 이름·연락처·방문 날짜·시간·인원·요청 사항과 메시지가 그 가게(가게 계정 주인)에게 전달됩니다.
          목적은 예약 확인과 연락이며, 가게는 예약 처리 외의 목적(광고 연락 등)으로 쓰면 안 됩니다. 보관 기간은 아래 5번과 같습니다.
        </li>
        <li>
          <b>리스트를 만든 큐레이터</b>: 큐레이터의 리스트를 통해 들어온 예약은 큐레이터에게 건수와 상태(확정·방문·노쇼·취소)만 보이며, 손님의 이름·연락처는 보이지 않습니다.
        </li>
        <li><b>가게 계정</b>: 우리 가게를 담은 공개 리스트와 그 큐레이터의 핸들, 반응 수치가 보입니다.</li>
      </ul>

      <h2>5. 누구에게 맡기나요 (처리 위탁·국외 이전)</h2>
      <ul>
        <li>Supabase (데이터베이스·로그인, 서버 위치: 일본 도쿄)</li>
        <li>Vercel (웹 호스팅, 서버 위치: 일본 도쿄 등)</li>
        <li>Google (구글 로그인, 장소 검색·장소 정보: Google Maps Platform, 광고 도입 시 Google AdSense)</li>
        <li>OpenFreeMap / OpenStreetMap (지도 바탕 그림 제공, 개인정보를 보내지 않음)</li>
        <li>Stripe (가게 광고비 카드 결제. 카드 번호는 Stripe가 직접 받으며 PinWith는 저장하지 않음)</li>
        <li>지급 대행(Wise·PayPal 또는 은행): 큐레이터에게 돈을 보낼 때 받는 사람 정보</li>
      </ul>
      <p>위 업체들은 각자의 보안 기준에 따라 정보를 처리하며, 서비스 제공에 필요한 범위에서만 국외(일본·미국 등)로 전송됩니다.</p>

      <h2>6. 얼마나 보관하나요</h2>
      <ul>
        <li>계정과 만든 내용: 계정을 삭제할 때까지. 삭제하면 바로 지워집니다.</li>
        <li>링크 이용 기록: 최대 2년, 이후 통계 수치로만 남깁니다.</li>
        <li>장소 좌표: 구글 정책에 따라 30일마다 새로 받습니다. 장소 ID만 계속 보관합니다.</li>
        <li>예약 문의(이름·연락처·메시지): 방문 날짜로부터 1년. 이후 이름·연락처를 지우고 건수 통계만 남깁니다.</li>
        <li>가게 증빙 자료: 가게 계정을 닫을 때까지(심사에 쓰고 나면 운영자만 볼 수 있게 보관)</li>
        <li>결제·지급 기록: 세금·회계 법령이 정한 기간(싱가포르 기준 5년)</li>
      </ul>

      <h2>7. 내 권리</h2>
      <p>
        언제든 내 정보를 보고, 고치고, 지울 수 있습니다. 프로필 화면의 <b>계정 삭제</b>로 바로 지울 수 있고,
        그 밖의 요청은 위 연락처로 보내 주세요. 화면 아래의 동의 선택은 브라우저 저장 공간을 지우면 다시 고를 수 있습니다.
      </p>

      <h2>8. 쿠키와 저장 공간</h2>
      <p>로그인 유지를 위한 쿠키는 꼭 필요합니다. 통계용 기기 식별값과 맞춤 광고는 ‘모두 허용’을 고른 경우에만 씁니다.</p>

      <h2>9. 어린이</h2>
      <p>만 14세 미만(국가에 따라 13~16세 미만)은 보호자 동의 없이 가입할 수 없습니다.</p>

      <h2>10. 바뀌면</h2>
      <p>이 방침이 바뀌면 시행 7일 전에 서비스 안에서 알립니다.</p>

      <hr />
      <h2>Privacy Policy (summary in English)</h2>
      <p>
        We collect account data (email, name, photo from Google sign-in), the content you create (lists, places, notes,
        follows, likes), link-usage events, reservation inquiries (name, phone, date, time, party size, notes, messages), business
        verification data (business name, registration number, contact, documents, top-up records) and curator payout details.
        When you send a reservation inquiry, your name, phone number, visit details and messages are shared with that business
        only, for handling the reservation; curators see counts and statuses, never your contact details. Whether a tap happened within 500 m of a place is computed on your device; we
        store only yes/no, never your coordinates. A random device ID and personalized ads are used only if you choose “Allow
        all”. Processors: Supabase (Tokyo), Vercel, Google (Sign-in, Maps Platform, AdSense when enabled), OpenFreeMap, Stripe (card payments), payout providers (Wise, PayPal or banks). You can
        delete your account at any time from your profile. Operator: STRATO TRADINGS PTE. LTD. (UEN 202402989G), 5008 Ang Mo Kio Avenue 5, #04-09, TechPlace II, Singapore 569874. Contact email: [to be added].
      </p>
    </>
  );
}
