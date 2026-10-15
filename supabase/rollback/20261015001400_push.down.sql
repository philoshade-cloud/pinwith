-- v0.21(0.21-4 ~ 0.21-5) DB 되돌리기. Supabase SQL Editor에서 실행한다.
drop trigger if exists notifications_push on public.notifications;
drop function if exists private.on_notification_push();
drop table if exists public.push_subscriptions;
drop table if exists public.app_secrets;   -- 웹 푸시 키도 함께 지워진다(다시 켜면 새 키가 만들어지고, 기존 구독은 다시 해야 함)
drop trigger if exists payout_requests_notify_status on public.payout_requests;
drop function if exists private.on_payout_status();
drop trigger if exists biz_topups_notify_paid on public.biz_topups;
drop function if exists private.on_topup_paid();
drop trigger if exists businesses_notify_status on public.businesses;
drop function if exists private.on_business_status();
alter table public.notifications drop column if exists pushed_at;
-- delete from public.notifications where kind in ('biz_review', 'topup_paid', 'payout');
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('follow', 'like', 'comment', 'reply', 'invite', 'invite_accepted', 'share_changed', 'notice', 'resolved',
                  'reservation', 'reservation_new', 'reservation_msg', 'biz_block', 'biz_alert'));
