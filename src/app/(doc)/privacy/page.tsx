import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "개인정보처리방침" };

// 출시 전 법률 검토를 받는다. 도메인이 정해지면 문의 이메일을 더하고, 개인정보 보호책임자 이름을 채운다.
export default function Privacy() {
  return (
    <>
      <h1>개인정보처리방침</h1>
      <p className="note">시행일: 2026년 10월 16일</p>

      <p>
        PinWith(이하 “서비스”)는 이용자의 개인정보를 서비스에 꼭 필요한 만큼만 모으고, 아래에 적은 목적으로만 씁니다. 이 방침은 한국 개인정보 보호법, 싱가포르 개인정보보호법(PDPA),
        유럽 일반개인정보보호규정(GDPR) 등 이용자가 사는 나라의 법을 함께 고려해 작성했습니다.
      </p>

      <h2>1. 운영자와 연락처</h2>
      <ul>
        <li>운영 회사: STRATO TRADINGS PTE. LTD. (싱가포르, 회사등록번호 UEN 202402989G)</li>
        <li>주소: 5008 Ang Mo Kio Avenue 5, #04-09, TechPlace II, Singapore 569874</li>
        <li>
          개인정보 문의·요청: <Link href="/support?type=question">문의·신고하기</Link>(로그인 없이도 보낼 수 있어요). 답을 받을 이메일을 함께 적어 주세요.
        </li>
        <li>개인정보 보호책임자: 회사 대표 (위 문의 창구로 연락)</li>
      </ul>

      <h2>2. 모으는 정보</h2>
      <p>
        <b>가입하지 않고 볼 때</b>
      </p>
      <ul>
        <li>
          <b>링크 이용 기록</b>: 공유 링크가 열린 횟수, 장소·길찾기·지도 앱 버튼을 누른 기록, 들어온 이전 페이지 주소(referrer). ‘가게 근처(500m)에서 눌렀는지’는 기기 안에서만
          계산해 예/아니오만 저장하며, 위치 좌표는 서버로 보내지도 저장하지도 않습니다.
        </li>
        <li>
          <b>기기 번호</b>: 브라우저마다 무작위로 만든 번호를 기기에 저장해, 같은 사람의 반복 노출·클릭을 한 번으로 세는 데 씁니다(광고 노출 집계, 가게 제휴 과금의 중복 방지, 남용
          방지). ‘필수만’을 고르면 방문 통계용 기기 번호는 지웁니다.
        </li>
        <li>
          <b>IP 주소</b>: 접속 과정에서 서버가 받습니다. 저장하지 않으며, 문의·결제 시작·알림 등록이 짧은 시간에 몰릴 때 막기 위해 최대 하루 동안만 횟수와 함께 보관합니다.
        </li>
        <li>
          <b>오류 기록</b>: 화면이나 서버에서 오류가 나면 오류 내용, 그때의 페이지 주소, 브라우저 종류(user agent)를 저장해 고치는 데 씁니다. 이름·이메일 등은 담지 않습니다.
        </li>
        <li>
          <b>사용량 집계</b>: 구글 지도 기능(장소 카드, 검색 등)이 몇 번 쓰였는지 날짜별 합계만 저장합니다. 누가 썼는지는 저장하지 않습니다.
        </li>
      </ul>
      <p>
        <b>가입한 이용자</b>
      </p>
      <ul>
        <li><b>계정</b>: 이메일 주소, 구글로 로그인하면 구글이 알려 주는 이름과 프로필 사진</li>
        <li><b>프로필</b>: 핸들, 이름, 소개, 프로필 사진(직접 올린 경우)</li>
        <li><b>내가 만든 내용</b>: 리스트, 장소, 메모, 섹션, 태그, 공지, 팔로우, 좋아요, 댓글, 공동 편집 기록(누가 언제 무엇을 바꿨는지)</li>
        <li><b>메시지</b>: 다른 이용자와 주고받은 메시지와 차단 여부</li>
        <li><b>알림</b>: 받은 알림, 휴대폰·컴퓨터 알림을 켠 경우 그 기기의 알림 주소(브라우저가 만든 값)와 브라우저 종류</li>
        <li><b>예약 문의</b>: 이름, 연락처, 방문 날짜·시간·인원, 요청 사항, 가게와 주고받은 메시지, 처리 상태(확정·방문·노쇼·취소)</li>
        <li><b>문의·신고</b>: 보낸 내용, 답을 받을 이메일(선택), 신고한 리스트, 보낸 페이지 주소</li>
      </ul>
      <p>
        <b>상업 이용자(가게·수익화 큐레이터)</b>
      </p>
      <ul>
        <li>
          <b>가게 계정</b>: 가게(구글 장소), 상호, 사업자등록번호, 담당자 이름·연락처, 사업자등록증 등 증빙 자료, 예약 설정, 과금 조건, 광고비 충전·결제 기록, 이의 제기 내용
        </li>
        <li>
          <b>큐레이터 지급 정보</b>: 받는 사람 실명, 받는 방법(Wise·PayPal·은행), 계좌 또는 계정 이메일, SWIFT, 나라·통화, 지급 요청·지급 기록, 이의 제기 내용. 송금 회사가 요구하면
          생년월일·연락처를 더 받을 수 있습니다.
        </li>
      </ul>
      <p>카드 번호는 결제 회사(Stripe)가 직접 받으며 PinWith는 보지도 저장하지도 않습니다.</p>

      <h2>3. 쓰는 목적과 근거</h2>
      <ul>
        <li><b>서비스 제공</b>(로그인, 리스트 만들기·공유, 댓글·메시지, 공동 편집, 알림) — 이용 계약 이행</li>
        <li><b>큐레이터 통계, 광고 수익 나눔, 가게 제휴 정산과 지급</b> — 이용 계약 이행</li>
        <li><b>예약 문의 전달과 처리</b>, 노쇼·취소 비율 확인(가게별 통계로만 쓰고 손님 개인을 평가하지 않음) — 이용 계약 이행</li>
        <li><b>가게가 실제로 운영되는지 확인</b>(증빙 자료와 가게 전화번호로) — 이용 계약 이행, 부정 이용 방지</li>
        <li><b>부정 이용·남용 방지, 오류 수정, 서비스 개선, 비용 관리</b> — 정당한 이익</li>
        <li><b>세금·회계 기록 보관</b> — 법적 의무</li>
        <li><b>방문 통계용 기기 번호, 맞춤 광고</b> — 동의(‘모두 허용’). 동의하지 않으면 비맞춤 광고만 보입니다.</li>
      </ul>
      <p>위 목적 밖으로 쓰거나 정보를 팔지 않습니다.</p>

      <h2>4. 다른 이용자에게 보이는 정보</h2>
      <ul>
        <li><b>공개 프로필과 공개 리스트</b>: 핸들, 이름, 소개, 프로필 사진, 공개·링크 공개로 둔 리스트는 링크를 가진 누구나 볼 수 있습니다.</li>
        <li>
          <b>댓글</b>: 댓글을 쓴 사람의 팔로워와 리스트 주인에게 보입니다(대댓글은 원래 댓글을 쓴 사람에게도). 운영자가 예시로 지정한 일부 리스트는 댓글이 누구에게나 보이며, 그
          리스트의 댓글 칸에 그렇게 표시합니다.
        </li>
        <li><b>공동 편집</b>: 함께 편집하는 사람들은 서로의 편집 기록을 볼 수 있습니다.</li>
        <li>
          <b>예약 문의를 보낸 가게</b>: 이름·연락처·방문 정보·요청 사항·메시지가 그 가게에만 전달됩니다. 가게는 예약 처리 외의 목적(광고 연락 등)으로 쓸 수 없습니다.
        </li>
        <li><b>리스트를 만든 큐레이터</b>: 자기 리스트로 들어온 예약의 건수와 상태만 보며, 손님의 이름·연락처는 보지 못합니다.</li>
        <li><b>가게 계정</b>: 자기 가게를 담은 공개 리스트, 그 큐레이터의 핸들, 반응 수치를 봅니다.</li>
      </ul>

      <h2>5. 처리를 맡기는 회사와 국외 이전</h2>
      <p>
        PinWith는 싱가포르 회사이며, 서비스를 위해 아래 회사에 정보 처리를 맡깁니다. 이용자가 서비스를 쓰는 동안 인터넷으로 전송되고, 아래 보관 기간 동안 처리됩니다. 국외
        이전을 원하지 않으면 가입하지 않거나 계정을 삭제할 수 있지만, 그 경우 서비스를 이용할 수 없습니다.
      </p>
      <ul>
        <li><b>Supabase</b>(미국 회사, 데이터 보관: 일본 도쿄) — 데이터베이스, 로그인, 파일 보관: 위 2번의 모든 정보</li>
        <li><b>Vercel</b>(미국 회사, 서버: 일본 도쿄 등) — 웹사이트 운영: 접속 정보</li>
        <li><b>Google</b>(미국) — 구글 로그인, 장소 검색·장소 정보(Google Maps Platform), 광고(Google AdSense, 도입 시): 로그인 정보, 접속 정보, 광고 동의 여부</li>
        <li><b>Stripe</b>(미국·싱가포르) — 가게 광고비 카드 결제: 결제 정보, 가게 이름·이메일</li>
        <li><b>Wise, PayPal 또는 은행</b> — 큐레이터에게 송금: 지급 정보</li>
        <li>
          <b>브라우저 알림 서비스</b>(Google, Apple, Mozilla 등 이용자 브라우저의 회사) — 휴대폰·컴퓨터 알림 전달: 알림 제목과 내용
        </li>
        <li><b>OpenFreeMap / OpenStreetMap</b> — 지도 바탕 그림: 개인정보를 보내지 않음</li>
      </ul>

      <h2>6. 보관 기간과 파기</h2>
      <ul>
        <li>계정과 내가 만든 내용: 계정을 삭제할 때까지. 삭제하면 바로 지웁니다(다른 사람 리스트에 남긴 댓글 포함).</li>
        <li>링크 이용 기록: 최대 2년. 이후에는 개인을 알 수 없는 통계 수치로만 남깁니다.</li>
        <li>예약 문의의 이름·연락처·메시지: 방문 날짜로부터 1년. 이후 자동으로 지우고 건수 통계만 남깁니다.</li>
        <li>IP 주소가 담긴 요청 제한 기록: 최대 1일</li>
        <li>오류 기록: 고친 뒤 최대 1년</li>
        <li>가게 증빙 자료: 가게 계정을 닫을 때까지(심사 뒤에는 운영자만 열람)</li>
        <li>결제·지급·정산 기록: 세금·회계 법령이 정한 기간(싱가포르 기준 5년)</li>
      </ul>
      <p>기간이 지나면 데이터베이스에서 지우고 복구할 수 없게 합니다. 백업에 남은 사본은 백업 주기에 따라 함께 사라집니다.</p>

      <h2>7. 안전하게 지키는 방법</h2>
      <ul>
        <li>모든 통신은 암호화(HTTPS)하고, 데이터베이스는 행 단위 접근 권한으로 본인·권한 있는 사람만 읽게 합니다.</li>
        <li>운영자 기능과 서버 키는 정해진 운영자만 쓸 수 있고, 가게 증빙 자료는 비공개 저장소에 둡니다.</li>
        <li>짧은 시간에 몰리는 요청은 자동으로 막고, 오류는 기록해 빠르게 고칩니다.</li>
      </ul>

      <h2>8. 내 권리</h2>
      <ul>
        <li>내 정보를 보고, 고치고, 지우고, 처리를 멈추게 하거나, 받아 갈(이동) 수 있습니다.</li>
        <li>프로필 화면의 <b>계정 삭제</b>로 언제든 바로 지울 수 있고, 그 밖의 요청은 위 문의 창구로 보내 주세요. 법이 정한 기간 안에 답합니다.</li>
        <li>동의는 언제든 거둘 수 있습니다. 브라우저 저장 공간을 지우면 동의 선택 창이 다시 나옵니다.</li>
        <li>
          답이 만족스럽지 않으면 사는 나라의 개인정보 감독 기관에 민원을 낼 수 있습니다(예: 한국 개인정보침해신고센터 국번 없이 118, 개인정보분쟁조정위원회 1833-6972 / 싱가포르
          PDPC / 유럽 각국 감독 기관).
        </li>
        <li>미국 일부 주 이용자: PinWith는 개인정보를 팔지 않습니다. 맞춤 광고에 쓰이지 않게 하려면 ‘필수만’을 고르세요.</li>
      </ul>

      <h2>9. 쿠키와 기기 저장 공간</h2>
      <ul>
        <li><b>꼭 필요한 것</b>: 로그인 유지 쿠키, 동의 선택, 화면 설정. 끌 수 없습니다.</li>
        <li><b>동의한 경우에만</b>: 방문 통계용 기기 번호, 맞춤 광고(광고 회사 쿠키 포함)</li>
      </ul>
      <p>처음 들어오면 화면 아래에서 ‘필수만’ 또는 ‘모두 허용’을 고를 수 있습니다. 광고가 붙으면 유럽·영국 등에서는 광고 회사가 정한 동의 창이 따로 나올 수 있습니다.</p>

      <h2>10. 어린이</h2>
      <p>만 14세 미만(나라에 따라 13~16세 미만)은 가입할 수 없습니다. 그런 계정을 알게 되면 지웁니다.</p>

      <h2>11. 바뀌면</h2>
      <p>이 방침이 바뀌면 시행 7일 전(이용자 권리에 중요한 변경은 30일 전)에 서비스 안에서 알립니다.</p>

      <hr />
      <h2>Privacy Policy (English summary)</h2>
      <p>
        PinWith is operated by STRATO TRADINGS PTE. LTD. (Singapore, UEN 202402989G), 5008 Ang Mo Kio Avenue 5, #04-09, TechPlace II, Singapore 569874.
        Contact us through the in-app <Link href="/support?type=question">support form</Link>.
      </p>
      <p>
        We collect: account data (email; name and photo from Google sign-in), profile and content you create (lists, places, notes, comments, messages, follows,
        likes, co-editing history), link-usage events, a random device ID (statistics only if you choose “Allow all”; also used to count each viewer once for ads
        and partner billing), error reports (message, page URL, browser type), daily aggregate usage counts, push-notification endpoints if you turn them on,
        reservation inquiries (name, phone, visit details, notes, messages), business verification data and top-up records, and curator payout details. IP
        addresses are kept for at most one day for rate limiting. Whether a tap happened within 500 m of a place is computed on your device; we never store your
        coordinates. Card numbers go directly to Stripe.
      </p>
      <p>
        Reservation details are shared only with the business you contact; curators see counts and statuses only. Comments are visible to the commenter’s
        followers and the list owner, except on a few example lists marked as open to everyone. We do not sell personal data.
      </p>
      <p>
        Processors: Supabase (data stored in Tokyo), Vercel, Google (Sign-in, Maps Platform, AdSense when enabled), Stripe, Wise/PayPal/banks, browser push
        services, OpenFreeMap. Retention: account data until deletion; link events up to 2 years; reservation contact details 1 year after the visit; rate-limit
        records 1 day; payment records 5 years. You may access, correct, delete, restrict or export your data, withdraw consent, and complain to your data
        protection authority. Users under 14 (or the local age of digital consent) may not register.
      </p>
    </>
  );
}
