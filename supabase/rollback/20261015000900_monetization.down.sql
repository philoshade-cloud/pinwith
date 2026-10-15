-- v0.16(0.16-1 ~ 0.16-6) DB 되돌리기. Supabase SQL Editor에서 실행한다.
-- 주의: 정산 기록(payouts), 월별 수익, 분배율이 함께 지워진다. 먼저 백업이 필요하면 표를 CSV로 내려받는다.

-- 0.16-6
drop policy if exists "admins handle support requests" on public.support_requests;
drop policy if exists "admins see support requests" on public.support_requests;
alter table public.support_requests drop column if exists list_id;

-- 0.16-5
drop function if exists public.admin_curators(text);
drop function if exists public.admin_finalize_month(date);
drop function if exists public.admin_payout_preview(date);
drop table if exists public.payouts;
drop table if exists public.ad_revenue_months;

-- 0.16-4
drop trigger if exists lists_guard_monetize on public.lists;
drop function if exists private.guard_monetize();
drop function if exists public.my_monetization();
drop function if exists private.monetize_eligible(uuid);
drop function if exists private.monetize_counts(uuid);

-- 0.16-3 (예전 집계 방식으로)
drop function if exists public.record_ad_view(uuid, text, text);
drop table if exists private.ad_view_seen;
create or replace function public.record_ad_view(p_list uuid, p_slot text) returns void
language sql security definer set search_path = '' as $$
  insert into public.ad_views_daily (day, list_id, slot, views)
  select (now() at time zone 'Asia/Seoul')::date, p_list, left(p_slot, 40), 1
  where exists (select 1 from public.lists l where l.id = p_list and l.visibility <> 'private'
                and l.owner_id is distinct from (select auth.uid()))
  on conflict (day, list_id, slot) do update set views = public.ad_views_daily.views + 1;
$$;

-- 0.16-2
drop table if exists public.curator_rates;
drop table if exists public.monetization_settings;

-- 0.16-1
drop function if exists private.is_admin();
drop table if exists public.admins;
