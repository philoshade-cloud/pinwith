import type { Metadata } from "next";
import Link from "next/link";
import { ByLang } from "@/components/ByLang";

export const metadata: Metadata = { title: "개인정보처리방침", alternates: { canonical: "/privacy" } };

// 출시 전 법률 검토를 받는다.
export default function Privacy() {
  return <ByLang ko={<PrivacyKo />} en={<PrivacyEn />} />;
}

function PrivacyKo() {
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
          개인정보 문의·요청: 이메일 <a href="mailto:support@pinwith.me">support@pinwith.me</a> 또는 <Link href="/support?type=question">문의·신고하기</Link>(로그인 없이도 보낼 수 있어요. 답을 받을 이메일을 함께 적어 주세요).
        </li>
        <li>개인정보 보호책임자: Adrian Kim (대표, <a href="mailto:support@pinwith.me">support@pinwith.me</a>)</li>
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
        <li><b>계정</b>: 이메일 주소, 구글·Apple·Facebook으로 로그인하면 그 회사가 알려 주는 이름과 프로필 사진(Apple에서 이메일 가리기를 고르면 Apple이 만든 전달용 주소)</li>
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
          <b>큐레이터 지급 정보</b>: 받는 사람 실명과 영문 이름, 받는 방법(Wise·PayPal·은행), 계좌 또는 계정 이메일, SWIFT, 나라·통화, 생년월일·휴대폰 번호(원화로 받는 경우 등
          송금 회사가 요구할 때), 지급 요청·지급 기록, 이의 제기 내용
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
        <li><b>Apple</b>(미국), <b>Meta</b>(미국, Facebook 로그인) — 그 회사 계정으로 로그인할 때: 로그인 정보</li>
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

      <h2 id="delete">8. 내 권리</h2>
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

    </>
  );
}

function PrivacyEn() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="note">Effective date: October 16, 2026</p>

      <p>
        PinWith (the “Service”) collects only the personal information the Service actually needs and uses it only for the purposes described below. This
        policy was written with the laws of the countries where our users live in mind, including Korea’s Personal Information Protection Act, Singapore’s
        Personal Data Protection Act (PDPA) and the EU General Data Protection Regulation (GDPR).
      </p>

      <h2>1. Operator and contact</h2>
      <ul>
        <li>Operating company: STRATO TRADINGS PTE. LTD. (Singapore, company registration number UEN 202402989G)</li>
        <li>Address: 5008 Ang Mo Kio Avenue 5, #04-09, TechPlace II, Singapore 569874</li>
        <li>
          Privacy questions and requests: email <a href="mailto:support@pinwith.me">support@pinwith.me</a> or use the <Link href="/support?type=question">support form</Link> (you can send it without signing in;
          please include an email address where we can reply).
        </li>
        <li>Data Protection Officer: Adrian Kim (CEO; <a href="mailto:support@pinwith.me">support@pinwith.me</a>)</li>
      </ul>

      <h2>2. Information we collect</h2>
      <p>
        <b>When you browse without an account</b>
      </p>
      <ul>
        <li>
          <b>Link usage records</b>: how many times a shared link was opened, taps on place, directions and map-app buttons, and the address of the page you
          came from (referrer). Whether a tap happened near the store (within 500 m) is calculated only on your device and stored as a simple yes/no; your
          location coordinates are never sent to or stored on our servers.
        </li>
        <li>
          <b>Device ID</b>: a random ID generated for each browser and stored on your device, used to count repeated views and clicks by the same person only
          once (ad impression counts, preventing duplicate partnership charges to stores, and preventing abuse). If you choose “Essential only”, the device ID
          used for visit statistics is deleted.
        </li>
        <li>
          <b>IP address</b>: our servers receive it as part of the connection. We do not store it, except that it is kept together with a request count for
          up to one day to block bursts of support requests, payment starts or notification sign-ups in a short period.
        </li>
        <li>
          <b>Error records</b>: when an error occurs on screen or on the server, we store the error details, the page address at that time and the browser
          type (user agent) so we can fix it. These records do not include your name, email or similar details.
        </li>
        <li>
          <b>Usage totals</b>: we store only daily totals of how many times Google Maps features (place cards, search, etc.) were used. We do not store who
          used them.
        </li>
      </ul>
      <p>
        <b>Registered users</b>
      </p>
      <ul>
        <li><b>Account</b>: email address, and if you sign in with Google, Apple or Facebook, the name and profile photo that company provides (if you choose Hide My Email with Apple, the relay address Apple creates)</li>
        <li><b>Profile</b>: handle, name, bio, profile photo (if you uploaded one)</li>
        <li><b>Content you create</b>: lists, places, notes, sections, tags, announcements, follows, likes, comments, and co-editing history (who changed what and when)</li>
        <li><b>Messages</b>: messages exchanged with other users and whether you have blocked someone</li>
        <li><b>Notifications</b>: notifications you received, and if you turn on phone or computer notifications, that device’s notification endpoint (a value created by the browser) and browser type</li>
        <li><b>Reservation inquiries</b>: name, contact details, visit date, time and party size, requests, messages exchanged with the store, and status (confirmed, visited, no-show, cancelled)</li>
        <li><b>Support requests and reports</b>: what you sent, an email address for our reply (optional), the list you reported, and the page address you sent it from</li>
      </ul>
      <p>
        <b>Commercial users (stores and monetizing curators)</b>
      </p>
      <ul>
        <li>
          <b>Store accounts</b>: the store (Google place), business name, business registration number, contact person’s name and contact details, supporting
          documents such as a business registration certificate, reservation settings, billing conditions, ad credit top-up and payment records, and dispute
          details
        </li>
        <li>
          <b>Curator payout information</b>: the recipient’s legal name and name in English, payout method (Wise, PayPal or bank), account number or account
          email, SWIFT code, country and currency, date of birth and mobile number (when the money transfer provider requires them, such as for payouts in
          Korean won), payout requests and payout records, and dispute details
        </li>
      </ul>
      <p>Card numbers are collected directly by our payment provider (Stripe); PinWith never sees or stores them.</p>

      <h2>3. How we use information and our legal bases</h2>
      <ul>
        <li><b>Providing the Service</b> (sign-in, creating and sharing lists, comments and messages, co-editing, notifications) — performance of our contract with you</li>
        <li><b>Curator statistics, ad revenue sharing, and store partnership settlement and payouts</b> — performance of contract</li>
        <li><b>Delivering and handling reservation inquiries</b>, and checking no-show and cancellation rates (used only as per-store statistics, never to rate individual guests) — performance of contract</li>
        <li><b>Verifying that a store actually operates</b> (using supporting documents and the store’s phone number) — performance of contract and fraud prevention</li>
        <li><b>Preventing fraud and abuse, fixing errors, improving the Service, and managing costs</b> — legitimate interests</li>
        <li><b>Keeping tax and accounting records</b> — legal obligation</li>
        <li><b>Device ID for visit statistics, and personalized ads</b> — consent (“Allow all”). If you do not consent, you will see only non-personalized ads.</li>
      </ul>
      <p>We do not use information for any purpose other than those above, and we do not sell it.</p>

      <h2>4. Information visible to other users</h2>
      <ul>
        <li><b>Public profiles and public lists</b>: your handle, name, bio and profile photo, and lists set to public or link-only, can be seen by anyone who has the link.</li>
        <li>
          <b>Comments</b>: visible to the commenter’s followers and to the list owner (replies are also visible to the author of the original comment).
          Comments on a few example lists designated by the operator are visible to everyone, and this is indicated in the comment area of those lists.
        </li>
        <li><b>Co-editing</b>: people who edit a list together can see each other’s editing history.</li>
        <li>
          <b>The store you send a reservation inquiry to</b>: your name, contact details, visit details, requests and messages are delivered only to that
          store. The store may not use them for any purpose other than handling the reservation (for example, marketing contact).
        </li>
        <li><b>The curator who made the list</b>: sees only the number and status of reservations that came through their list, not guests’ names or contact details.</li>
        <li><b>Store accounts</b>: see public lists that include their store, those curators’ handles, and engagement figures.</li>
      </ul>

      <h2>5. Service providers and international transfers</h2>
      <p>
        PinWith is a Singapore company and entrusts the processing of information to the companies below in order to provide the Service. Information is
        transferred over the internet while you use the Service and is processed for the retention periods below. If you do not want your information
        transferred abroad, you can choose not to register or delete your account, but in that case you will not be able to use the Service.
      </p>
      <ul>
        <li><b>Supabase</b> (US company, data stored in Tokyo, Japan) — database, sign-in and file storage: all information in section 2 above</li>
        <li><b>Vercel</b> (US company, servers in Tokyo, Japan and elsewhere) — website hosting: connection information</li>
        <li><b>Google</b> (US) — Google sign-in, place search and place information (Google Maps Platform), ads (Google AdSense, once introduced): sign-in information, connection information, ad consent status</li>
        <li><b>Apple</b> (US), <b>Meta</b> (US, Facebook Login) — when you sign in with an account from that company: sign-in information</li>
        <li><b>Stripe</b> (US and Singapore) — card payments for stores’ ad credit: payment information, store name and email</li>
        <li><b>Wise, PayPal or banks</b> — transfers to curators: payout information</li>
        <li>
          <b>Browser notification services</b> (the company behind your browser, such as Google, Apple or Mozilla) — delivering phone and computer
          notifications: notification title and content
        </li>
        <li><b>OpenFreeMap / OpenStreetMap</b> — base map imagery: no personal information is sent</li>
      </ul>

      <h2>6. Retention and deletion</h2>
      <ul>
        <li>Account and content you create: until you delete your account. When you delete it, we erase it immediately (including comments you left on other people’s lists).</li>
        <li>Link usage records: up to 2 years. After that, only statistics that cannot identify individuals are kept.</li>
        <li>Names, contact details and messages in reservation inquiries: 1 year from the visit date. They are then deleted automatically and only count statistics are kept.</li>
        <li>Rate-limit records containing IP addresses: up to 1 day</li>
        <li>Error records: up to 1 year after the error is fixed</li>
        <li>Store supporting documents: until the store account is closed (after review, viewable only by the operator)</li>
        <li>Payment, payout and settlement records: for the period required by tax and accounting laws (5 years under Singapore law)</li>
      </ul>
      <p>When a retention period ends, we delete the data from our database so that it cannot be recovered. Copies remaining in backups are removed as backups rotate.</p>

      <h2>7. How we keep information safe</h2>
      <ul>
        <li>All communication is encrypted (HTTPS), and the database uses row-level access controls so that only you and authorized people can read your data.</li>
        <li>Operator functions and server keys are available only to designated operators, and store supporting documents are kept in private storage.</li>
        <li>Bursts of requests in a short period are blocked automatically, and errors are logged so we can fix them quickly.</li>
      </ul>

      <h2 id="delete-en">8. Your rights</h2>
      <ul>
        <li>You can access, correct and delete your information, ask us to stop processing it, or take a copy with you (portability).</li>
        <li>You can delete your account immediately at any time with <b>Delete account</b> on your profile screen; please send any other requests through the support form above. We will respond within the period required by law.</li>
        <li>You can withdraw consent at any time. If you clear your browser storage, the consent choice will appear again.</li>
        <li>
          If you are not satisfied with our response, you can file a complaint with the data protection authority in your country (for example, (Korea)
          Personal Information Infringement Report Center (118), Personal Information Dispute Mediation Committee (1833-6972) / Singapore PDPC / data
          protection authorities in each European country).
        </li>
        <li>Users in certain US states: PinWith does not sell personal information. To keep your information from being used for personalized ads, choose “Essential only”.</li>
      </ul>

      <h2>9. Cookies and device storage</h2>
      <ul>
        <li><b>Strictly necessary</b>: sign-in cookies, your consent choice, display settings. These cannot be turned off.</li>
        <li><b>Only with your consent</b>: device ID for visit statistics, personalized ads (including ad companies’ cookies)</li>
      </ul>
      <p>On your first visit, you can choose “Essential only” or “Allow all” at the bottom of the screen. Once ads are added, a separate consent window set by the ad company may appear in the EU, the UK and elsewhere.</p>

      <h2>10. Children</h2>
      <p>Children under 14 (or under 13 to 16, depending on the country) may not register. If we learn of such an account, we will delete it.</p>

      <h2>11. Changes</h2>
      <p>If this policy changes, we will notify you within the Service 7 days before the change takes effect (30 days before for changes significant to your rights).</p>
    </>
  );
}
