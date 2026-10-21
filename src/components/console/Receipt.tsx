"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { money, useAuthed } from "./ui";
import { useFormat, useT } from "@/lib/i18n/client";

type Row = {
  id: string; amount: number; currency: string; pay_amount: number | null; pay_currency: string | null; provider: string; status: string;
  reference: string | null; external_id: string | null; created_at: string; paid_at: string | null; refunded_amount: number; refunded_pay: number;
  biz: { place_name: string; business_name: string; reg_number: string | null; place_address: string | null } | null;
};

// 광고비 충전 영수증(인쇄·PDF 저장용). 판매자는 STRATO TRADINGS PTE. LTD.(PinWith).
// 카드 결제는 Stripe도 따로 영수증 메일을 보낸다(대시보드 설정). 이 화면은 카드·계좌 충전 모두에 쓴다.
export function Receipt({ topupId }: { topupId: string }) {
  const t = useT();
  const fmt = useFormat();
  const { supabase } = useAuthed(`/biz/receipt/${topupId}`);
  const [row, setRow] = useState<Row | null | undefined>(undefined);
  useEffect(() => {
    supabase
      .from("biz_topups")
      .select("id, amount, currency, pay_amount, pay_currency, provider, status, reference, external_id, created_at, paid_at, refunded_amount, refunded_pay, biz:businesses(place_name, business_name, reg_number, place_address)")
      .eq("id", topupId)
      .maybeSingle()
      .then(({ data }) => setRow((data as unknown as Row) ?? null));
  }, [supabase, topupId]);

  if (row === undefined) return <p className="text-[14px] text-muted">{t("불러오는 중")}</p>;
  if (!row || row.status !== "paid")
    return (
      <div>
        <p className="text-[16px] text-ink">{t("영수증을 찾을 수 없어요. 결제가 끝난 충전만 영수증이 있어요.")}</p>
        <Link href="/biz/place?tab=billing" className="btn-quiet mt-4">{t("광고비 화면으로")}</Link>
      </div>
    );

  const charged = row.pay_amount && row.pay_currency ? money(row.pay_amount, row.pay_currency) : money(row.amount, row.currency);
  const refunded = Number(row.refunded_amount) > 0;
  const no = `PW-${row.id.slice(0, 8).toUpperCase()}`;
  return (
    <div className="mx-auto max-w-[640px]">
      <div className="mb-4 flex items-center gap-2 print:hidden">
        <Link href="/biz/place?tab=billing" className="btn-quiet">‹ {t("광고비 화면으로")}</Link>
        <button type="button" onClick={() => window.print()} className="btn-primary ml-auto">{t("인쇄 · PDF로 저장")}</button>
      </div>
      <article className="rounded-2xl border border-rule bg-white p-6 text-[14px] text-ink print:border-0 print:p-0">
        <header className="flex items-start justify-between gap-4 border-b border-rule pb-4">
          <div>
            <h1 className="text-[22px] font-semibold">{t("영수증")} <span className="text-[14px] font-normal text-muted">Receipt</span></h1>
            <p className="mt-1 text-muted">{t("영수증 번호")}: {no}</p>
          </div>
          <div className="text-right text-[13px] leading-relaxed">
            <p className="font-semibold">PinWith</p>
            <p>STRATO TRADINGS PTE. LTD.</p>
            <p>Singapore · UEN 202402989G</p>
            <p>support@pinwith.me</p>
          </div>
        </header>

        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 py-4">
          <dt className="text-muted">{t("결제일")}</dt>
          <dd>{fmt.date(row.paid_at ?? row.created_at)}</dd>
          <dt className="text-muted">{t("받는 분")}</dt>
          <dd>
            {row.biz?.business_name}
            {row.biz?.reg_number && <span className="text-muted"> · {row.biz.reg_number}</span>}
            <br />
            <span className="text-muted">{row.biz?.place_name}{row.biz?.place_address ? ` · ${row.biz.place_address}` : ""}</span>
          </dd>
          <dt className="text-muted">{t("결제 방법")}</dt>
          <dd>
            {row.provider === "bank" ? t("계좌 입금") : t("카드 결제(Stripe)")}
            {row.reference && row.provider === "bank" && <span className="text-muted"> · {row.reference}</span>}
          </dd>
        </dl>

        <table className="w-full border-y border-rule">
          <thead>
            <tr className="text-left text-[12px] text-muted">
              <th className="py-2 font-normal">{t("내용")}</th>
              <th className="py-2 text-right font-normal">{t("금액")}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-rule">
              <td className="py-3">
                {t("PinWith 광고비 충전(선불 광고 이용료)")}
                <br />
                <span className="text-[12px] text-muted">{t("광고비 잔액에 {amount} 적립", { amount: money(row.amount, row.currency) })}</span>
              </td>
              <td className="py-3 text-right font-semibold tabular-nums">{charged}</td>
            </tr>
            {refunded && (
              <tr className="border-t border-rule text-pin">
                <td className="py-3">{t("환불")}</td>
                <td className="py-3 text-right tabular-nums">
                  −{row.pay_currency && row.pay_amount ? money(row.refunded_pay, row.pay_currency) : money(row.refunded_amount, row.currency)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="mt-3 flex justify-between text-[16px] font-semibold">
          <span>{refunded ? t("환불 후 결제 금액") : t("결제 금액")}</span>
          <span className="tabular-nums">
            {refunded
              ? row.pay_currency && row.pay_amount
                ? money(Number(row.pay_amount) - Number(row.refunded_pay), row.pay_currency)
                : money(Number(row.amount) - Number(row.refunded_amount), row.currency)
              : charged}
          </span>
        </p>

        <p className="mt-6 text-[12px] leading-relaxed text-muted">
          {t("PinWith 광고 서비스의 판매자는 STRATO TRADINGS PTE. LTD.입니다. 쓰지 않은 광고비는 환불 정책에 따라 돌려받을 수 있어요: pinwith.me/for-businesses#refund")}
          {row.provider !== "bank" && row.external_id && <><br />Stripe: {row.external_id.slice(0, 24)}…</>}
        </p>
      </article>
    </div>
  );
}
