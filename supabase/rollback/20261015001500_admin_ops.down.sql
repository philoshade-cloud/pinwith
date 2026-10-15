-- v0.22(0.22-1 ~ 0.22-3) DB 되돌리기. Supabase SQL Editor에서 실행한다.
-- 주의: 이의 제기 기록이 지워진다. 운영자 조정으로 생긴 과금 기록(model='adjustment')은 남는다.
drop function if exists public.admin_disputes(boolean);
drop function if exists public.admin_resolve_dispute(uuid, text, numeric, text);
drop function if exists public.file_dispute(uuid, bigint, uuid, text);
drop table if exists public.disputes;
drop function if exists public.admin_blocks();
drop policy if exists "admin manages blocks" on public.biz_blocks;
drop function if exists public.admin_store_quality();
alter table public.businesses drop column if exists admin_note;
-- my_charges·biz_charges는 20261015001300_commerce_v2.sql의 정의로 다시 만든다
-- delete from public.notifications where kind = 'dispute';
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('follow', 'like', 'comment', 'reply', 'invite', 'invite_accepted', 'share_changed', 'notice', 'resolved',
                  'reservation', 'reservation_new', 'reservation_msg', 'biz_block', 'biz_alert', 'biz_review', 'topup_paid', 'payout'));
