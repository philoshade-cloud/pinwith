-- v0.19(0.19-2 ~ 0.19-4) DB 되돌리기. Supabase SQL Editor에서 실행한다.
-- 주의: 예약 문의 기록이 지워진다. 예약 과금(offer_charges의 reservation)은 남는다.

-- 0.19-4
drop function if exists public.place_claim_status(text);
-- 0.19-3
drop index if exists public.biz_topups_external_idx;
alter table public.biz_topups drop column if exists provider, drop column if exists country, drop column if exists pay_amount,
  drop column if exists pay_currency, drop column if exists external_id;
alter table public.monetization_settings drop column if exists krw_per_unit;
-- 0.19-2 (curator_dashboard·my_offer_stats는 20261015001100_commerce.sql의 정의로 다시 만든다)
drop function if exists public.cancel_reservation(uuid);
drop function if exists public.set_reservation_status(uuid, text, text);
drop function if exists public.request_reservation(uuid, text, text, date, text, integer, text);
drop function if exists public.reservation_offer(text);
drop table if exists public.reservations;
-- 예약 모델 과금 기록을 지운 뒤 아래 두 제약을 되돌린다(남아 있으면 실패)
-- delete from public.biz_offers where model = 'reservation';
alter table public.biz_offers drop constraint if exists biz_offers_model_check;
alter table public.biz_offers add constraint biz_offers_model_check check (model in ('click', 'visit'));
-- delete from public.notifications where kind in ('reservation', 'reservation_new');
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('follow', 'like', 'comment', 'reply', 'invite', 'invite_accepted', 'share_changed', 'notice', 'resolved'));
