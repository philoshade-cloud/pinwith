-- 0.46-1 광고비 환불: 가게가 쓰지 않은 잔액의 환불을 요청 → 운영자가 Stripe(카드 충전분) 또는 계좌로 돌려줌.
-- 요청한 순간부터 그 금액은 잔액에서 빠진다(처리 중에는 그만큼 과금이 멈춤, /for-businesses#refund).
-- Stripe 대시보드에서 직접 환불한 것도 웹훅(charge.refunded)으로 잔액에 반영한다.

-- 충전 기록: Stripe 결제 id와 이미 환불된 금액(기본 통화·결제 통화)
alter table public.biz_topups
  add column if not exists payment_intent text,
  add column if not exists refunded_amount numeric(14,2) not null default 0 check (refunded_amount >= 0),
  add column if not exists refunded_pay numeric(14,2) not null default 0 check (refunded_pay >= 0);
create index if not exists biz_topups_payment_intent_idx on public.biz_topups (payment_intent) where payment_intent is not null;

create table if not exists public.biz_refunds (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  -- 잔액에서 빠지는 금액(기본 통화). 돌려주는 돈은 amount - fee
  amount numeric(14,2) not null check (amount > 0),
  fee numeric(14,2) not null default 0 check (fee >= 0 and fee <= amount),
  currency text not null,
  status text not null default 'requested' check (status in ('requested', 'processing', 'refunded', 'cancelled', 'failed')),
  method text check (method is null or method in ('stripe', 'bank')),
  source text not null default 'store' check (source in ('store', 'stripe_dashboard', 'admin')),
  reason text check (reason is null or char_length(reason) <= 500),
  admin_note text check (admin_note is null or char_length(admin_note) <= 1000),
  requested_by uuid references public.profiles (id) on delete set null,
  external_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists biz_refunds_business_idx on public.biz_refunds (business_id, created_at desc);
alter table public.biz_refunds enable row level security;
create policy "business sees refunds" on public.biz_refunds for select to authenticated
  using (private.owns_business(business_id) or private.is_admin());
-- 계좌 환불 완료·취소 표시는 운영자만(카드 환불은 서버가 service_role로)
create policy "admin updates refunds" on public.biz_refunds for update to authenticated
  using (private.is_admin()) with check (private.is_admin());
-- 2026-10-30부터 새 테이블은 Data API 권한을 직접 줘야 한다
grant select, update on public.biz_refunds to authenticated;
grant select, insert, update, delete on public.biz_refunds to service_role;

-- 잔액 = 결제된 충전 − 과금 − 환불(요청·처리 중·완료)
create or replace function private.biz_balance(p_business uuid) returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce((select sum(amount) from public.biz_topups where business_id = p_business and status = 'paid'), 0)
       - coalesce((select sum(amount) from public.offer_charges where business_id = p_business), 0)
       - coalesce((select sum(amount) from public.biz_refunds where business_id = p_business and status in ('requested', 'processing', 'refunded')), 0);
$$;

-- 가게: 환불 요청(잔액 이하만)
create or replace function public.request_biz_refund(p_business uuid, p_amount numeric, p_reason text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_amount numeric := round(p_amount, 2);
  v_currency text;
  v_id uuid;
begin
  if not private.owns_business(p_business) then raise exception 'not_owner'; end if;
  -- 같은 가게의 요청·과금이 동시에 들어와도 잔액을 넘지 않게
  perform 1 from public.businesses where id = p_business for update;
  if v_amount is null or v_amount <= 0 then raise exception 'amount'; end if;
  if v_amount > private.biz_balance(p_business) then raise exception 'insufficient'; end if;
  v_currency := coalesce((select currency from public.biz_topups where business_id = p_business and status = 'paid' order by paid_at desc limit 1),
                         (select currency from public.monetization_settings limit 1), 'USD');
  insert into public.biz_refunds (business_id, amount, currency, reason, requested_by)
  values (p_business, v_amount, v_currency, nullif(left(trim(coalesce(p_reason, '')), 500), ''), (select auth.uid()))
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.request_biz_refund(uuid, numeric, text) from public, anon;
grant execute on function public.request_biz_refund(uuid, numeric, text) to authenticated;

-- 가게: 아직 처리 전인 요청 취소
create or replace function public.cancel_biz_refund(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.biz_refunds set status = 'cancelled', processed_at = now()
  where id = p_id and status = 'requested' and private.owns_business(business_id);
  if not found then raise exception 'not_cancellable'; end if;
end $$;
revoke execute on function public.cancel_biz_refund(uuid) from public, anon;
grant execute on function public.cancel_biz_refund(uuid) to authenticated;
