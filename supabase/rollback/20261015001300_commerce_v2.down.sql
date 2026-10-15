-- v0.20(0.20-1 ~ 0.20-8) DB 되돌리기. Supabase SQL Editor에서 실행한다.
-- 함수는 20261015001200_reservations_payments.sql의 정의로 다시 만든 뒤 실행한다(curator 통계·예약 함수 이전 버전).
alter policy "view items of visible lists" on public.list_items using (private.can_view_list(list_id));
drop trigger if exists list_items_guard_blocked on public.list_items;
drop function if exists private.guard_blocked_item();
drop function if exists private.item_blocked(uuid, text);
drop function if exists private.item_funded(uuid);
drop function if exists public.block_curator(uuid, uuid);
drop function if exists public.unblock_curator(uuid, uuid);
drop function if exists public.biz_lists(uuid);
drop function if exists public.add_place_and_attach(uuid, uuid, boolean);
drop function if exists public.my_connected_stores(integer);
drop function if exists public.anonymize_old_reservations();
drop function if exists public.my_charges(integer, text);
drop function if exists public.biz_charges(uuid, integer);
drop function if exists public.send_reservation_message(uuid, text);
drop function if exists private.check_reservation_anomaly(uuid);
drop function if exists private.peer_reservation_rate(uuid);
drop function if exists private.reservation_quality(uuid);
drop function if exists private.refund_reservation(public.reservations);
drop function if exists public.request_reservation(text, uuid, text, text, date, text, integer, text);
grant execute on function public.request_reservation(uuid, text, text, date, text, integer, text) to authenticated;
drop table if exists public.biz_blocks;
drop table if exists public.biz_alerts;
drop table if exists public.reservation_messages;
alter table public.list_items drop column if exists paid_only;
alter table public.reservations drop column if exists confirmed_at, drop column if exists cancelled_by;
alter table public.businesses drop column if exists reservations_enabled, drop column if exists reservation_hours,
  drop column if exists reservation_slot_minutes, drop column if exists reservation_max_party, drop column if exists reservation_note;
-- 알림 종류 되돌리기 전에 새 종류 알림을 지운다
-- delete from public.notifications where kind in ('reservation_msg', 'biz_block', 'biz_alert');
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('follow', 'like', 'comment', 'reply', 'invite', 'invite_accepted', 'share_changed', 'notice', 'resolved',
                  'reservation', 'reservation_new'));
