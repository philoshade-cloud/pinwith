import type { Metadata } from "next";

export const metadata: Metadata = { title: "개인정보처리방침" };

// 초안: 도메인 확정 후 문의 이메일을 채우고 법률 검토를 받는다.
export default function Privacy() {
  return (
    <>
      <h1>개인정보처리방침</h1>
      <p className="note">시행일: 2026년 10월 15일 (초안)</p>

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
        <li><b>기기 식별값</b>: ‘모두 허용’에 동의한 경우에만 무작위 값을 기기에 저장해 방문 통계에 씁니다.</li>
      </ul>

      <h2>3. 왜 쓰나요</h2>
      <ul>
        <li>로그인, 리스트 만들기·공유 등 서비스 제공</li>
        <li>큐레이터에게 링크 반응 통계 제공, 제휴 매장 정산(도입 시)</li>
        <li>부정 이용 방지, 서비스 개선</li>
        <li>광고(도입 시): 동의한 경우에만 맞춤 광고, 그 외에는 비맞춤 광고</li>
      </ul>

      <h2>4. 누구에게 맡기나요 (처리 위탁·국외 이전)</h2>
      <ul>
        <li>Supabase (데이터베이스·로그인, 서버 위치: 일본 도쿄)</li>
        <li>Vercel (웹 호스팅, 서버 위치: 일본 도쿄 등)</li>
        <li>Google (구글 로그인, 장소 검색·장소 정보: Google Maps Platform, 광고 도입 시 Google AdSense)</li>
        <li>OpenFreeMap / OpenStreetMap (지도 바탕 그림 제공, 개인정보를 보내지 않음)</li>
      </ul>
      <p>위 업체들은 각자의 보안 기준에 따라 정보를 처리하며, 서비스 제공에 필요한 범위에서만 국외(일본·미국 등)로 전송됩니다.</p>

      <h2>5. 얼마나 보관하나요</h2>
      <ul>
        <li>계정과 만든 내용: 계정을 삭제할 때까지. 삭제하면 바로 지워집니다.</li>
        <li>링크 이용 기록: 최대 2년, 이후 통계 수치로만 남깁니다.</li>
        <li>장소 좌표: 구글 정책에 따라 30일마다 새로 받습니다. 장소 ID만 계속 보관합니다.</li>
      </ul>

      <h2>6. 내 권리</h2>
      <p>
        언제든 내 정보를 보고, 고치고, 지울 수 있습니다. 프로필 화면의 <b>계정 삭제</b>로 바로 지울 수 있고,
        그 밖의 요청은 위 연락처로 보내 주세요. 화면 아래의 동의 선택은 브라우저 저장 공간을 지우면 다시 고를 수 있습니다.
      </p>

      <h2>7. 쿠키와 저장 공간</h2>
      <p>로그인 유지를 위한 쿠키는 꼭 필요합니다. 통계용 기기 식별값과 맞춤 광고는 ‘모두 허용’을 고른 경우에만 씁니다.</p>

      <h2>8. 어린이</h2>
      <p>만 14세 미만(국가에 따라 13~16세 미만)은 보호자 동의 없이 가입할 수 없습니다.</p>

      <h2>9. 바뀌면</h2>
      <p>이 방침이 바뀌면 시행 7일 전에 서비스 안에서 알립니다.</p>

      <hr />
      <h2>Privacy Policy (summary in English)</h2>
      <p>
        We collect account data (email, name, photo from Google sign-in), the content you create (lists, places, notes,
        follows, likes) and link-usage events. Whether a tap happened within 500 m of a place is computed on your device; we
        store only yes/no, never your coordinates. A random device ID and personalized ads are used only if you choose “Allow
        all”. Processors: Supabase (Tokyo), Vercel, Google (Sign-in, Maps Platform, AdSense when enabled), OpenFreeMap. You can
        delete your account at any time from your profile. Operator: STRATO TRADINGS PTE. LTD. (UEN 202402989G), 5008 Ang Mo Kio Avenue 5, #04-09, TechPlace II, Singapore 569874. Contact email: [to be added].
      </p>
    </>
  );
}
