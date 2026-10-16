import type { Metadata } from "next";
import Link from "next/link";
import { ByLang } from "@/components/ByLang";

export const metadata: Metadata = { title: "이용약관" };

// 출시 전 법률 검토를 받는다.
export default function Terms() {
  return <ByLang ko={<TermsKo />} en={<TermsEn />} />;
}

function TermsKo() {
  return (
    <>
      <h1>이용약관</h1>
      <p className="note">시행일: 2026년 10월 16일</p>

      <p>
        이 약관은 STRATO TRADINGS PTE. LTD.(싱가포르, UEN 202402989G, 이하 “회사”)가 운영하는 PinWith(이하 “서비스”)를 이용하는 모든 분께 적용됩니다. 가입하거나 서비스를 쓰면
        이 약관과 <Link href="/privacy">개인정보처리방침</Link>에 동의한 것으로 봅니다. 가게 계정과 수익화에 관한 6~9조는 그 기능을 쓰는 분께만 적용됩니다.
      </p>

      <h2>1. 서비스</h2>
      <p>
        PinWith는 장소를 지도에 모아 리스트로 만들고 링크로 공유하는 서비스입니다. 링크를 받은 사람은 로그인 없이 볼 수 있습니다. 회사는 서비스를 더 좋게 만들기 위해 기능을
        바꾸거나 멈출 수 있으며, 이용자에게 중요한 변경은 미리 알립니다.
      </p>

      <h2>2. 계정</h2>
      <ul>
        <li>만 14세 이상(나라에 따라 13~16세 이상)만 가입할 수 있습니다.</li>
        <li>계정은 본인만 쓰고, 로그인 수단을 안전하게 지켜야 합니다. 내 계정에서 일어난 일은 내 책임입니다.</li>
        <li>다른 사람·회사·브랜드를 사칭하는 핸들이나 이름은 쓸 수 없습니다.</li>
        <li>프로필 화면의 ‘계정 삭제’로 언제든 탈퇴할 수 있습니다. 탈퇴하면 내 리스트·댓글 등이 지워지고 되돌릴 수 없습니다. 받을 수익이 남아 있다면 9조를 먼저 확인하세요.</li>
      </ul>

      <h2>3. 내가 올린 내용</h2>
      <ul>
        <li>리스트·메모·댓글·사진 등 내가 올린 내용의 권리는 나에게 있습니다.</li>
        <li>
          회사가 서비스를 운영하는 데 필요한 범위(화면에 보여 주기, 공유 링크·미리보기 그림 만들기, 공개 리스트를 ‘타인의 핀’ 등에서 소개하기)에서 무료로 쓸 수 있도록 허락합니다.
          이 허락은 내가 내용을 지우거나 비공개로 바꾸면 그때부터 끝납니다.
        </li>
        <li>
          <b>공동 편집</b>: 공동 편집자가 리스트에 더한 장소·메모는 그 리스트의 일부가 되며, 리스트 주인이 계속 쓰고 고칠 수 있습니다. 공동 편집자를 빼도 이미 더한 내용은
          남습니다.
        </li>
        <li>다른 사람의 리스트에서 장소를 ‘담기’하면 장소만 옮겨지고, 원래 큐레이터의 메모는 복사되지 않습니다.</li>
        <li>공개 범위(공개·링크 공개·비공개)는 내가 정합니다. 링크 공개는 링크를 가진 누구나 볼 수 있다는 뜻입니다.</li>
      </ul>

      <h2>4. 하면 안 되는 일</h2>
      <ul>
        <li>남의 권리(저작권·초상권·상표 등)를 침해하거나, 거짓·불법·혐오·괴롭힘·음란 내용을 올리는 일</li>
        <li>가게나 사람에 대해 사실이 아닌 내용으로 평판을 해치는 일</li>
        <li>대가를 받은 홍보를 표시 없이 올리는 일(PinWith 가게 제휴를 붙인 장소는 리스트 화면에 ‘제휴’로 자동 표시되며, 그 밖에 따로 대가를 받았다면 메모에 직접 밝혀야 합니다)</li>
        <li>스팸 메시지·댓글, 원하지 않는 사람에게 반복해서 연락하는 일</li>
        <li>노출·클릭·방문·예약을 부풀리는 일(자기 클릭, 자동화, 대가를 주고 누르게 하기, 거짓 예약 등)</li>
        <li>자동화된 방법으로 대량 수집하거나 서비스를 방해·우회하는 일</li>
      </ul>
      <p>
        이런 내용이나 행동은 <Link href="/support?type=report">문의·신고하기</Link>로 알려 주세요. 회사는 확인 뒤 내용을 숨기거나 지우고, 기능을 제한하거나 계정을 정지할 수 있으며,
        부풀린 수익은 지급하지 않거나 돌려받습니다. 리스트 주인은 자기 리스트의 댓글을 숨길 수 있고, 메시지는 상대를 차단할 수 있습니다.
      </p>

      <h2>5. 장소 정보와 지도</h2>
      <p>
        장소 이름·사진·평점·영업 정보는 Google 등 외부에서 받아 보여 주며, 회사가 정확성을 보장하지 않습니다. 방문 전 해당 지도 앱이나 가게에 확인하세요. 길찾기는 이용자가 고른
        외부 지도 앱(구글·네이버·카카오 등)에서 이뤄집니다. 지도 바탕은 © OpenStreetMap 기여자 데이터입니다.
      </p>

      <h2>6. 광고</h2>
      <p>
        서비스 안에 광고가 보일 수 있습니다. 광고 내용은 광고주의 책임이며, 광고를 통해 산 상품·서비스는 광고주와 이용자 사이의 거래입니다.
      </p>

      <h2>7. 예약 문의</h2>
      <ul>
        <li>예약 문의는 가게가 확정하기 전까지 예약이 아닙니다. 확정·거절·변경은 가게가 정합니다.</li>
        <li>손님의 이름·연락처는 그 가게에만 전달되며, 가게는 예약 처리 외의 목적으로 쓸 수 없습니다.</li>
        <li>
          예약의 이행(자리, 가격, 결제, 취소·노쇼 규정 등)은 손님과 가게 사이의 일이며, 회사는 연결을 돕는 역할만 합니다. 다만 문제가 생기면 신고를 받아 확인하고, 필요하면 가게의
          예약 기능을 제한합니다.
        </li>
      </ul>

      <h2>8. 가게 계정과 광고비</h2>
      <ul>
        <li>
          <b>인증</b>: 가게 계정은 실제 운영자(또는 운영자에게 권한을 받은 사람)만 만들 수 있습니다. 회사는 증빙 자료와 가게 전화번호로 확인하며, 한 가게에는 하나의 인증 계정만
          허용됩니다. 사실과 다르면 승인하지 않거나 정지합니다.
        </li>
        <li>
          <b>과금 조건</b>: 인증된 가게는 과금 조건(길찾기·지도 열기, 가게 근처 누름, 예약 확정)과 금액, 월 예산을 정할 수 있습니다. 큐레이터가 이를 자기 리스트에 붙이면 조건에
          맞는 손님 행동마다 광고비 잔액에서 금액이 빠집니다. 같은 사람은 조건별로 하루 1회만 세며, 큐레이터·가게 본인의 행동은 세지 않습니다.
        </li>
        <li>
          <b>예약 확정 조건</b>: 가게가 확정할 때 과금되며(잔액이 모자라면 확정할 수 없음), 확정 뒤 노쇼·취소로 바뀌면 되돌립니다. 가게의 기록을 먼저 인정하되, 주변 가게와 비교해
          노쇼·취소 비율이 크게 높으면 연결된 큐레이터에게 알리고 회사가 확인합니다.
        </li>
        <li>
          <b>광고비</b>: 광고비는 회사의 광고 서비스(PinWith 리스트를 통한 노출·연결)에 대한 선불 이용료입니다. 카드(Stripe) 또는 계좌 입금으로 충전하며, 쓰지 않은 잔액은 문의로
          환불을 요청할 수 있고 결제·송금 수수료를 뺀 금액을 돌려드립니다. 잔액에는 이자가 붙지 않습니다.
        </li>
        <li>
          <b>가게의 권한</b>: 가게는 특정 큐레이터를 차단할 수 있고, 그러면 그 큐레이터의 리스트에서 가게가 숨겨지며 풀릴 때까지 다시 담을 수 없습니다. 차단을 남용하면 회사가 풀
          수 있습니다.
        </li>
        <li>
          <b>운영자 조치</b>: 노쇼·취소 비율이 비정상이거나 약관을 어기면 회사는 가게의 예약 제휴나 예약 기능을 끄고 잠글 수 있습니다. 잠긴 기능은 회사가 풀 때까지 다시 켤 수
          없으며, 가게와 연결된 큐레이터에게 알립니다. 정지하면 과금·예약·콘솔 사용이 멈춥니다.
        </li>
      </ul>

      <h2>9. 큐레이터 수익</h2>
      <ul>
        <li>
          <b>자격</b>: 회사가 운영자 콘솔에서 정한 기준(팔로워 수 또는 실제 광고 노출)을 넘은 큐레이터는 리스트별로 수익화를 켤 수 있습니다. 기준과 비율은 바뀔 수 있으며, 불리하게
          바꿀 때는 30일 전에 알립니다.
        </li>
        <li>
          <b>광고 수익 나눔</b>: 리스트 화면의 광고 수익 중 회사가 정한 비율을, 수익화한 리스트의 실제 광고 노출 비중대로 나눕니다. 광고 수익이 확정된 뒤 달마다 정산합니다.
        </li>
        <li>
          <b>가게 제휴 보상</b>: 큐레이터가 리스트에 붙인 가게 제휴 조건이 충족되면, 그 금액에서 회사 수수료를 뺀 나머지를 보상으로 쌓습니다. 큐레이터는 가게를 ‘광고비 지급될 때만
          공개’로 담을 수 있으며, 이 경우 가게 잔액이 모자라면 그 리스트에서 가게가 숨겨집니다.
        </li>
        <li>
          <b>보상의 성격</b>: 큐레이터가 받는 돈은 큐레이터의 소개·홍보 활동에 대해 회사가 회사의 수입에서 지급하는 보수입니다. 회사가 가게나 광고주의 돈을 맡아 대신 전달하는 것이
          아니며, 큐레이터와 가게 사이에 직접 계약이 생기지 않습니다.
        </li>
        <li>
          <b>공동 편집자 배분</b>: 리스트 주인은 그 리스트 몫 중 일부(%)를 공동 편집자에게 나눠 줄 수 있습니다.
        </li>
        <li>
          <b>지급</b>: 지급 정보를 등록하고 최소 금액 이상이면 지급을 요청할 수 있습니다. 회사는 확인 뒤 등록된 방법(Wise·PayPal·은행)으로 보내며, 송금 회사가 요구하는 본인 확인
          정보를 추가로 받을 수 있습니다. 받는 쪽에서 생기는 수수료와 환전 차이는 받는 사람이 부담할 수 있습니다.
        </li>
        <li>
          <b>지급하지 않는 경우</b>: 4조의 부풀리기가 확인되거나, 지급 정보가 잘못됐거나, 법·제재로 송금할 수 없는 나라·사람인 경우 지급하지 않거나 이미 준 금액을 돌려받거나 다음
          지급에서 뺄 수 있습니다. 탈퇴하면 지급 정보도 함께 지워지므로, 받을 금액이 남아 있으면 지급을 받은 뒤 탈퇴하세요.
        </li>
        <li><b>세금</b>: 받은 돈의 세금 신고·납부는 받는 사람이 사는 나라의 법에 따라 받는 사람이 합니다. 법이 요구하면 회사는 세금을 떼거나 필요한 서류를 요청할 수 있습니다.</li>
      </ul>

      <h2>10. 이의 제기</h2>
      <p>
        과금·되돌림·노쇼 기록이나 운영자 조치에 이의가 있으면 가게 콘솔 또는 큐레이터 콘솔의 ‘이의 제기’로 알려 주세요. 회사는 양쪽 기록을 확인해 기각하거나, 큐레이터에게
        지급하거나, 가게에 돌려주는 방식으로 정하고 결과를 알립니다. 그래도 해결되지 않으면 12조에 따릅니다.
      </p>

      <h2>11. 책임의 한계</h2>
      <ul>
        <li>서비스는 있는 그대로 제공됩니다. 회사는 중단 없는 서비스, 장소 정보의 정확성, 다른 이용자·가게의 행동을 보장하지 않습니다.</li>
        <li>
          법이 허용하는 범위에서, 회사는 간접 손해(이익 손실, 데이터 손실 등)에 책임지지 않으며, 회사의 책임은 사고 전 12개월 동안 그 이용자가 회사에 낸 금액(무료 이용자는 미화
          100달러)을 넘지 않습니다.
        </li>
        <li>회사의 고의·중대한 과실로 생긴 손해나, 법이 책임 제한을 허용하지 않는 손해에는 위 제한이 적용되지 않습니다.</li>
        <li>가게와 큐레이터는 자기가 올린 내용·과금 조건·예약 처리 때문에 생긴 다른 사람의 청구로부터 회사를 보호해야 합니다.</li>
      </ul>

      <h2>12. 준거법과 분쟁</h2>
      <p>
        이 약관은 싱가포르 법을 따르고, 분쟁은 먼저 문의 창구로 협의합니다. 협의가 안 되면 싱가포르 법원에서 해결합니다. 다만 소비자인 이용자는 사는 나라의 소비자 보호 법이 더
        유리하게 정한 권리와 그 나라 법원에 소송할 권리를 그대로 가집니다.
      </p>

      <h2>13. 약관 변경과 연락</h2>
      <p>
        약관이 바뀌면 시행 7일 전(이용자에게 불리한 변경은 30일 전)에 서비스 안에서 알립니다. 바뀐 약관에 동의하지 않으면 시행 전에 탈퇴할 수 있습니다. 문의는{" "}
        <Link href="/support?type=question">문의·신고하기</Link> 또는 이메일 <a href="mailto:support@pinwith.me">support@pinwith.me</a>로 보내 주세요. 회사 주소: 5008 Ang Mo Kio Avenue 5, #04-09, TechPlace II, Singapore 569874.
      </p>

    </>
  );
}

function TermsEn() {
  return (
    <>
      <h1>Terms of Use</h1>
      <p className="note">Effective date: October 16, 2026</p>

      <p>
        These terms apply to everyone who uses PinWith (the “Service”), operated by STRATO TRADINGS PTE. LTD. (Singapore, UEN 202402989G, the “Company”). By
        registering or using the Service, you are deemed to agree to these terms and the <Link href="/privacy">Privacy Policy</Link>. Sections 6 to 9 on store
        accounts and monetization apply only to those who use those features.
      </p>

      <h2>1. The Service</h2>
      <p>
        PinWith is a service for collecting places on a map into lists and sharing them by link. Anyone who receives a link can view it without signing in.
        The Company may change or discontinue features to improve the Service, and will give advance notice of changes that are important to users.
      </p>

      <h2>2. Accounts</h2>
      <ul>
        <li>You must be at least 14 years old (13 to 16, depending on the country) to register.</li>
        <li>Your account is for your use only, and you must keep your sign-in method secure. You are responsible for activity on your account.</li>
        <li>You may not use a handle or name that impersonates another person, company or brand.</li>
        <li>You can leave at any time with “Delete account” on your profile screen. Deleting your account erases your lists, comments and other content, and this cannot be undone. If you still have earnings to receive, check section 9 first.</li>
      </ul>

      <h2>3. Content you post</h2>
      <ul>
        <li>You keep the rights to the content you post, such as lists, notes, comments and photos.</li>
        <li>
          You grant the Company a free permission to use it to the extent needed to operate the Service (displaying it on screen, creating share links and
          preview images, and featuring public lists in places such as “Explore”). This permission ends when you delete the content or make it private.
        </li>
        <li>
          <b>Co-editing</b>: places and notes that co-editors add to a list become part of that list, and the list owner may continue to use and edit them.
          Removing a co-editor does not remove content they have already added.
        </li>
        <li>When you “save” a place from someone else’s list, only the place is copied; the original curator’s notes are not.</li>
        <li>You decide the visibility (public, link-only or private). Link-only means anyone who has the link can view it.</li>
      </ul>

      <h2>4. Prohibited conduct</h2>
      <ul>
        <li>Infringing others’ rights (copyright, portrait rights, trademarks, etc.), or posting false, illegal, hateful, harassing or obscene content</li>
        <li>Damaging the reputation of a store or person with untrue content</li>
        <li>Posting paid promotion without disclosure (places with a PinWith store partnership are automatically labeled “Partnership” on the list screen; if you received any other compensation, you must disclose it yourself in your notes)</li>
        <li>Spam messages or comments, or repeatedly contacting people who do not want to be contacted</li>
        <li>Inflating impressions, clicks, visits or reservations (self-clicking, automation, paying others to tap, fake reservations, etc.)</li>
        <li>Mass collection by automated means, or disrupting or circumventing the Service</li>
      </ul>
      <p>
        Please report such content or conduct through the <Link href="/support?type=report">support form</Link>. After review, the Company may hide or
        remove content, restrict features or suspend accounts, and will withhold or reclaim inflated earnings. List owners can hide comments on their own
        lists, and you can block other users in messages.
      </p>

      <h2>5. Place information and maps</h2>
      <p>
        Place names, photos, ratings and business information are received from external sources such as Google and displayed as-is; the Company does not
        guarantee their accuracy. Please check with the relevant map app or the store before visiting. Directions are provided in the external map app you
        choose (Google, Naver, Kakao, etc.). Base map data © OpenStreetMap contributors.
      </p>

      <h2>6. Advertising</h2>
      <p>
        Ads may appear in the Service. Advertisers are responsible for their ads, and any purchase of products or services through an ad is a transaction
        between the advertiser and the user.
      </p>

      <h2>7. Reservation inquiries</h2>
      <ul>
        <li>A reservation inquiry is not a reservation until the store confirms it. The store decides whether to confirm, decline or change it.</li>
        <li>Guests’ names and contact details are delivered only to that store, and the store may not use them for any purpose other than handling the reservation.</li>
        <li>
          Fulfilling the reservation (seating, prices, payment, cancellation and no-show policies, etc.) is a matter between the guest and the store; the
          Company only helps connect them. However, if a problem arises, the Company will accept and review reports and, if necessary, restrict the store’s
          reservation features.
        </li>
      </ul>

      <h2>8. Store accounts and ad credit</h2>
      <ul>
        <li>
          <b>Verification</b>: only the actual operator of a store (or a person authorized by the operator) may create a store account. The Company verifies
          this using supporting documents and the store’s phone number, and only one verified account is allowed per store. If the information is untrue, the
          Company will not approve the account or will suspend it.
        </li>
        <li>
          <b>Billing conditions</b>: verified stores can set billing conditions (directions or map opens, taps near the store, confirmed reservations), the
          amount for each, and a monthly budget. When a curator attaches these to their list, the amount is deducted from the ad credit balance for each guest
          action that meets a condition. The same person is counted only once per day per condition, and actions by the curator or the store itself are not
          counted.
        </li>
        <li>
          <b>Confirmed-reservation condition</b>: the charge is made when the store confirms (a reservation cannot be confirmed if the balance is
          insufficient), and is reversed if the reservation is later changed to a no-show or cancellation. The store’s records are accepted in the first
          instance, but if its no-show or cancellation rate is significantly higher than that of nearby stores, the linked curators are notified and the
          Company reviews it.
        </li>
        <li>
          <b>Ad credit</b>: ad credit is a prepaid fee for the Company’s advertising service (exposure and connections through PinWith lists). It is topped up
          by card (Stripe) or bank transfer. You may request a refund of any unused balance through the support form, and we will refund the amount minus
          payment and transfer fees. The balance does not earn interest.
        </li>
        <li>
          <b>Store rights</b>: a store can block a specific curator; the store is then hidden from that curator’s lists and cannot be added again until the
          block is lifted. The Company may lift blocks that are abused.
        </li>
        <li>
          <b>Operator actions</b>: if a store’s no-show or cancellation rate is abnormal or it violates these terms, the Company may turn off and lock the
          store’s reservation partnership or reservation features. Locked features cannot be turned back on until the Company unlocks them, and the curators
          linked to the store are notified. If a store is suspended, charging, reservations and console use stop.
        </li>
      </ul>

      <h2>9. Curator earnings</h2>
      <ul>
        <li>
          <b>Eligibility</b>: curators who exceed the criteria set by the Company in the operator console (number of followers or actual ad impressions) can
          turn on monetization for each list. The criteria and rates may change, and we will give 30 days’ notice of unfavorable changes.
        </li>
        <li>
          <b>Ad revenue sharing</b>: a percentage of ad revenue from list screens, set by the Company, is divided according to each monetized list’s share of
          actual ad impressions. Settlement is monthly, after ad revenue is finalized.
        </li>
        <li>
          <b>Store partnership rewards</b>: when a store partnership condition that a curator attached to a list is met, the amount minus the Company’s fee is
          credited to the curator as a reward. Curators can add a store as “Show only while paid”; in that case, the store is hidden from that
          list when the store’s balance is insufficient.
        </li>
        <li>
          <b>Nature of rewards</b>: money a curator receives is compensation paid by the Company from its own revenue for the curator’s referral and
          promotional activities. The Company does not hold or pass on money on behalf of stores or advertisers, and no direct contract arises between the
          curator and the store.
        </li>
        <li>
          <b>Sharing with co-editors</b>: the list owner can give a portion (%) of that list’s share to co-editors.
        </li>
        <li>
          <b>Payouts</b>: once you register payout information and your balance reaches the minimum amount, you can request a payout. After review, the Company
          sends it via the registered method (Wise, PayPal or bank) and may request additional identity information required by the money transfer provider.
          Fees and exchange-rate differences charged on the receiving side may be borne by the recipient.
        </li>
        <li>
          <b>When we do not pay</b>: if inflation as described in section 4 is confirmed, if payout information is incorrect, or if the country or person cannot
          receive transfers due to laws or sanctions, the Company may withhold payment, reclaim amounts already paid, or deduct them from the next payout. Deleting
          your account also deletes your payout information, so if you have earnings to receive, collect your payout before deleting your account.
        </li>
        <li><b>Taxes</b>: recipients are responsible for reporting and paying taxes on money received, in accordance with the laws of the country where they live. Where required by law, the Company may withhold taxes or request necessary documents.</li>
      </ul>

      <h2>10. Disputes</h2>
      <p>
        If you disagree with a charge, reversal, no-show record or operator action, let us know using “Dispute” in the store console or curator console. The
        Company will review both sides’ records and decide to reject the dispute, pay the curator, or refund the store, and will notify you of the result. If
        the matter is still not resolved, section 12 applies.
      </p>

      <h2>11. Limitation of liability</h2>
      <ul>
        <li>The Service is provided as is. The Company does not guarantee uninterrupted service, the accuracy of place information, or the conduct of other users or stores.</li>
        <li>
          To the extent permitted by law, the Company is not liable for indirect damages (loss of profits, loss of data, etc.), and the Company’s liability
          will not exceed the amount the user paid the Company in the 12 months before the incident (US$100 for free users).
        </li>
        <li>The above limits do not apply to damage caused by the Company’s intentional misconduct or gross negligence, or to damage for which the law does not allow liability to be limited.</li>
        <li>Stores and curators must protect the Company from claims by others arising from the content they post, their billing conditions or their handling of reservations.</li>
      </ul>

      <h2>12. Governing law and disputes</h2>
      <p>
        These terms are governed by the laws of Singapore, and disputes will first be discussed through our support channel. If no agreement is reached, they
        will be resolved in the courts of Singapore. However, users who are consumers retain any more favorable rights under the consumer protection laws of
        the country where they live, and the right to bring proceedings in the courts of that country.
      </p>

      <h2>13. Changes to these terms and contact</h2>
      <p>
        If these terms change, we will notify you within the Service 7 days before the change takes effect (30 days before for changes unfavorable to users).
        If you do not agree to the revised terms, you may delete your account before they take effect. Please send questions through the{" "}
        <Link href="/support?type=question">support form</Link> or by email to <a href="mailto:support@pinwith.me">support@pinwith.me</a>. Company address: 5008 Ang Mo Kio Avenue 5, #04-09, TechPlace II, Singapore 569874.
      </p>
    </>
  );
}
