import type { Metadata } from "next";
import Link from "next/link";
import { ByLang } from "@/components/ByLang";

export const metadata: Metadata = {
  title: "가게 사장님께",
  description: "PinWith 광고비(선불 충전)가 무엇에 쓰이는지, 과금 방식, 쓰지 않은 잔액 환불 정책, 판매자 정보와 문의처.",
};

// 가게(광고주)용 공개 안내: 광고비가 무엇인지, 과금, 환불, 판매자(merchant of record), 문의처.
// 결제사(Stripe) 심사 때 보여 줄 페이지. 내용은 이용약관 8조와 맞춘다.
export default function ForBusinesses() {
  return <ByLang ko={<Ko />} en={<En />} />;
}

const SUPPORT = "support@pinwith.me";

function Ko() {
  return (
    <>
      <h1>가게 사장님께: PinWith 광고비 안내</h1>
      <p className="note">마지막 수정: 2026년 10월 19일</p>

      <p>
        PinWith는 사람들이 아는 장소를 지도 리스트로 만들어 공유하는 서비스입니다. 가게는 <b>광고비</b>를 미리 충전해 두고, 큐레이터의 리스트를 통해 실제로 손님의 행동이
        생겼을 때만 정해 둔 금액을 냅니다. 이 페이지는 광고비가 무엇에 쓰이는지, 어떻게 과금되는지, 쓰지 않은 잔액은 어떻게 돌려받는지를 설명합니다.
      </p>

      <h2>1. 광고비는 무엇에 쓰이나요</h2>
      <ul>
        <li>광고비는 PinWith의 <b>광고 서비스</b>(PinWith 리스트를 통한 가게 노출과 손님 연결)에 대한 <b>선불 이용료</b>입니다.</li>
        <li>광고비는 PinWith 안에서만 쓰이며, 현금이나 다른 서비스의 결제 수단으로 바꾸거나 다른 사람에게 보낼 수 없습니다. 잔액에는 이자가 붙지 않습니다.</li>
        <li>충전한 광고비에는 유효기간이 없습니다.</li>
      </ul>

      <h2>2. 어떻게 과금되나요(성과 기반)</h2>
      <ul>
        <li>인증을 마친 가게는 상업 이용자용 콘솔에서 과금 조건(길찾기·지도 열기, 가게 근처에서 탭, 확정된 예약), 조건마다 금액, 월 예산을 정합니다.</li>
        <li>큐레이터가 그 조건을 자기 리스트에 붙이면, 리스트를 본 손님이 조건에 맞는 행동을 할 때마다 정한 금액이 잔액에서 빠집니다.</li>
        <li>같은 사람은 조건마다 하루 한 번만 셉니다. 큐레이터나 가게 자신의 행동은 세지 않습니다. 확정 예약은 노쇼·취소로 바뀌면 되돌립니다.</li>
        <li>잔액이 모자라면 새 과금이 멈춥니다. 쓴 내역은 콘솔의 ‘광고비’ 탭에서 언제든 볼 수 있습니다.</li>
      </ul>

      <h2>3. 충전 방법</h2>
      <ul>
        <li>
          <b>카드·간편결제</b>: Stripe 결제창에서 결제합니다. 대한민국 가게는 원화(KRW)로 결제창이 열리며, 국내 카드와 네이버페이·삼성페이·PAYCO 등 Stripe가 지원하는
          방법이 표시됩니다. 카드사 인증 화면으로 이동했다가 PinWith로 돌아옵니다.
        </li>
        <li><b>계좌 입금</b>: 콘솔에서 충전을 요청하면 운영자가 입금 방법을 안내하고, 입금이 확인되면 잔액에 들어갑니다.</li>
      </ul>

      <h2 id="refund">4. 쓰지 않은 잔액 환불 정책</h2>
      <ul>
        <li>쓰지 않은 광고비 잔액은 <b>언제든</b> 환불을 요청할 수 있습니다. 일부만 요청할 수도 있습니다.</li>
        <li>
          요청 방법: <Link href="/support">문의하기</Link>나 <a href={`mailto:${SUPPORT}`}>{SUPPORT}</a>로 가게 이름과 환불받을 금액을 보내 주세요.
        </li>
        <li>
          환불 금액은 요청 시점의 잔액에서 결제·송금 수수료를 뺀 금액입니다. 카드로 충전했다면 가능한 한 원래 결제 수단으로, 계좌로 충전했다면 가게 명의 계좌로 돌려드립니다.
        </li>
        <li>요청을 확인한 뒤 영업일 기준 10일 안에 처리합니다. 처리하는 동안에는 그 금액만큼 과금이 멈춥니다.</li>
        <li>가게 계정을 닫거나 회사가 서비스를 종료하면 남은 잔액은 같은 방식으로 돌려드립니다. 부정 사용(클릭 조작 등)으로 이용이 정지된 경우에는 조사 결과에 따라 처리합니다.</li>
        <li>이미 과금된 광고비는 이용약관의 이의 제기 절차(노쇼·취소 되돌리기, 분쟁 검토)를 따릅니다.</li>
      </ul>

      <h2>5. 판매자와 돈의 흐름</h2>
      <ul>
        <li>
          광고 서비스의 <b>판매자(merchant of record)</b>는 STRATO TRADINGS PTE. LTD.(싱가포르, UEN 202402989G)입니다. 결제 내역과 카드 명세서에는 PinWith로 표시되며, 모든
          결제 대금은 회사가 받습니다.
        </li>
        <li>
          Stripe를 통한 결제는 가게와 회사 사이의 거래뿐입니다. 결제 대금이 Stripe를 거쳐 큐레이터나 다른 제3자에게 바로 가는 일은 없습니다.
        </li>
        <li>
          큐레이터 보상은 회사가 자체 기준(이용약관 9조)에 따라 별도의 은행 송금으로 지급하는 회사의 비용입니다. 가게가 큐레이터에게 직접 돈을 보내거나, 큐레이터가 가게 대신
          결제를 받는 구조가 아닙니다.
        </li>
      </ul>

      <h2>6. 문의</h2>
      <ul>
        <li>이메일: <a href={`mailto:${SUPPORT}`}>{SUPPORT}</a></li>
        <li>문의 양식: <Link href="/support">pinwith.me/support</Link></li>
        <li>운영사: STRATO TRADINGS PTE. LTD.(싱가포르, UEN 202402989G)</li>
      </ul>
      <p>
        자세한 조건은 <Link href="/terms">이용약관</Link>(8조 가게 계정과 광고비, 9조 큐레이터 수익)과 <Link href="/privacy">개인정보처리방침</Link>을 확인하세요.
      </p>
    </>
  );
}

function En() {
  return (
    <>
      <h1>For businesses: PinWith ad credit</h1>
      <p className="note">Last updated: October 19, 2026</p>

      <p>
        PinWith is a service where people turn places they know into map lists and share them. Stores top up <b>ad credit</b> in advance and pay a set amount
        only when a guest actually takes an action through a curator’s list. This page explains what ad credit is for, how it is charged, and how to get
        unused credit refunded.
      </p>

      <h2>1. What ad credit is for</h2>
      <ul>
        <li>Ad credit is a <b>prepaid fee</b> for PinWith’s <b>advertising service</b>: exposure of your store and connections with guests through PinWith lists.</li>
        <li>Ad credit can only be used within PinWith. It cannot be exchanged for cash, used to pay for other services, or sent to anyone else. The balance does not earn interest.</li>
        <li>Ad credit does not expire.</li>
      </ul>

      <h2>2. How it is charged (performance-based)</h2>
      <ul>
        <li>Verified stores set billing conditions in the business console (directions or map opens, taps near the store, confirmed reservations), the amount for each, and a monthly budget.</li>
        <li>When a curator attaches these conditions to their list, the set amount is deducted from your balance each time a guest who saw the list takes a qualifying action.</li>
        <li>The same person is counted only once per day per condition. Actions by the curator or the store itself are not counted. Confirmed reservations are reversed if changed to a no-show or cancellation.</li>
        <li>If the balance runs low, new charges stop. You can see every charge at any time in the “Ad credit” tab of the console.</li>
      </ul>

      <h2>3. How to top up</h2>
      <ul>
        <li>
          <b>Card and wallets</b>: pay on the Stripe Checkout page. For stores in South Korea, Checkout opens in Korean won (KRW) and shows the methods Stripe
          supports there, such as Korean cards, Naver Pay, Samsung Pay and PAYCO. You may be redirected to your card issuer to authenticate and then back to PinWith.
        </li>
        <li><b>Bank transfer</b>: request a top-up in the console; we will send transfer instructions and add the amount once the transfer is confirmed.</li>
      </ul>

      <h2 id="refund">4. Refund policy for unused credit</h2>
      <ul>
        <li>You can request a refund of your unused ad credit balance <b>at any time</b>, in full or in part.</li>
        <li>
          How to request: use the <Link href="/support">support form</Link> or email <a href={`mailto:${SUPPORT}`}>{SUPPORT}</a> with your store name and the amount to refund.
        </li>
        <li>
          We refund the unused balance at the time of the request, minus payment and transfer fees. Card top-ups are refunded to the original payment method
          where possible; bank top-ups are refunded to a bank account in the store’s name.
        </li>
        <li>We process refunds within 10 business days of confirming the request. Charges against the requested amount stop while it is being processed.</li>
        <li>If you close your store account or we discontinue the service, any remaining balance is refunded in the same way. If an account is suspended for fraud (such as click manipulation), the balance is handled according to the outcome of our review.</li>
        <li>Charges already made follow the dispute process in the Terms of Service (no-show and cancellation reversals, dispute review).</li>
      </ul>

      <h2>5. Merchant of record and flow of funds</h2>
      <ul>
        <li>
          The <b>merchant of record</b> for the advertising service is STRATO TRADINGS PTE. LTD. (Singapore, UEN 202402989G). Payments appear as PinWith on
          receipts and card statements, and all payments are received by the Company.
        </li>
        <li>Payments through Stripe are only between the store and the Company. No payment flows through Stripe directly to curators or any other third party.</li>
        <li>
          Curator rewards are a cost of the Company, paid by the Company under its own criteria (Terms, section 9) by separate bank transfer. Stores do not pay
          curators directly, and curators do not collect payments on behalf of stores.
        </li>
      </ul>

      <h2>6. Contact</h2>
      <ul>
        <li>Email: <a href={`mailto:${SUPPORT}`}>{SUPPORT}</a></li>
        <li>Support form: <Link href="/support">pinwith.me/support</Link></li>
        <li>Operator: STRATO TRADINGS PTE. LTD. (Singapore, UEN 202402989G)</li>
      </ul>
      <p>
        For full conditions, see the <Link href="/terms">Terms of Service</Link> (section 8, store accounts and ad credit; section 9, curator earnings) and the{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </>
  );
}
