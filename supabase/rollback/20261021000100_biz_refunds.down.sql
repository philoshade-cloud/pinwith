-- 0.46-1 되돌리기: 환불 기록과 함수 제거, 잔액 계산을 예전(충전 − 과금)으로.
-- 주의: 환불 기록이 지워지므로, 이미 돌려준 금액이 잔액에 다시 나타난다.
drop function if exists public.cancel_biz_refund(uuid);
drop function if exists public.request_biz_refund(uuid, numeric, text);
create or replace function private.biz_balance(p_business uuid) returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce((select sum(amount) from public.biz_topups where business_id = p_business and status = 'paid'), 0)
       - coalesce((select sum(amount) from public.offer_charges where business_id = p_business), 0);
$$;
drop table if exists public.biz_refunds;
drop index if exists public.biz_topups_payment_intent_idx;
alter table public.biz_topups drop column if exists refunded_pay, drop column if exists refunded_amount, drop column if exists payment_intent;
