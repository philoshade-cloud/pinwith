-- v0.23(0.23-1 ~ 0.23-4) DB 되돌리기. Supabase SQL Editor에서 실행한다.
drop function if exists public.log_error(text, text, text, text, text, text);
drop table if exists public.error_logs;
drop function if exists public.run_budget_check();
drop function if exists public.admin_usage();
drop table if exists public.job_runs;
drop function if exists public.log_usage(text, integer, text);
drop table if exists public.service_budgets;
drop table if exists public.usage_prices;
drop table if exists public.usage_daily;
drop trigger if exists lists_rate on public.lists;
drop function if exists private.limit_lists();
drop trigger if exists item_comments_rate on public.item_comments;
drop function if exists private.limit_comments();
drop trigger if exists link_events_rate on public.link_events;
drop function if exists private.limit_link_events();
drop function if exists public.rate_hit(text, integer, integer);
drop function if exists private.rate_ok(text, integer, integer);
drop table if exists public.rate_limits;
drop function if exists public.admin_set_lock(uuid, text, boolean, text);
drop trigger if exists biz_offers_guard_lock on public.biz_offers;
drop function if exists private.guard_offer_lock();
-- guard_business는 20261015001100_commerce.sql의 정의로 다시 만든다
alter table public.businesses drop column if exists lock_reservation_offer, drop column if exists lock_reservations;
-- delete from public.notifications where kind in ('biz_admin', 'ops');
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('follow', 'like', 'comment', 'reply', 'invite', 'invite_accepted', 'share_changed', 'notice', 'resolved',
                  'reservation', 'reservation_new', 'reservation_msg', 'biz_block', 'biz_alert', 'biz_review', 'topup_paid', 'payout', 'dispute'));
