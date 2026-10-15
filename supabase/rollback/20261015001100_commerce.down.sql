-- v0.18(0.18-3 ~ 0.18-10) DB 되돌리기. Supabase SQL Editor에서 실행한다.
-- 주의: 가게 계정, 과금 모델, 충전·과금 기록, 지급 정보·요청이 모두 지워진다. 먼저 표를 CSV로 내려받아 두는 것을 권한다.

-- 0.18-10
drop function if exists public.biz_dashboard(uuid, integer);
drop function if exists public.my_offer_stats(integer);
drop function if exists public.offer_market();
drop function if exists public.curator_dashboard();
-- 0.18-9
drop function if exists public.request_payout();
drop function if exists private.curator_available(uuid);
drop table if exists public.payout_requests;
drop table if exists public.payout_profiles;
-- 0.18-8
drop trigger if exists link_events_charge on public.link_events;
drop function if exists private.on_link_event_charge();
drop function if exists private.biz_balance(uuid);
drop table if exists public.offer_charges;
-- 0.18-7
drop table if exists public.offer_attachments;
drop function if exists private.check_attachment();
-- 0.18-6
drop table if exists public.biz_topups;
-- 0.18-5
drop table if exists public.biz_offers;
-- 0.18-4 (올린 확인 자료는 Storage → biz-docs에서 직접 지운다)
drop policy if exists "biz doc upload own folder" on storage.objects;
drop policy if exists "biz doc read own or admin" on storage.objects;
drop function if exists private.owns_business(uuid);
drop table if exists public.businesses;
drop function if exists private.guard_business();
-- 0.18-3
alter table public.monetization_settings drop column if exists platform_fee_pct, drop column if exists min_payout, drop column if exists est_rpm;
-- 0.17-2 되돌림을 취소하려면(리스트 통째로 담기 다시 쓰기)
-- grant execute on function public.copy_list(uuid) to authenticated;
