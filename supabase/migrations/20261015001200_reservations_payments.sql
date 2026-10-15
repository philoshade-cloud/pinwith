-- v0.19 예약 문의 모델, 카드 결제 준비, 가게 신청 안내
-- 되돌리기: supabase/rollback/20261015001200_reservations_payments.down.sql

-- ── 0.19-2 과금 모델에 '예약' 추가: PinWith로 들어온 예약 문의를 가게가 확정하면 1건당 ──
alter table public.biz_offers drop constraint if exists biz_offers_model_check;
alter table public.biz_offers add constraint biz_offers_model_check check (model in ('click', 'visit', 'reservation'));

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('follow', 'like', 'comment', 'reply', 'invite', 'invite_accepted', 'share_changed', 'notice', 'resolved',
                  'reservation', 'reservation_new'));

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  offer_id uuid references public.biz_offers (id) on delete set null,
  user_id uuid references public.profiles (id) on delete set null,
  list_id uuid references public.lists (id) on delete set null,
  item_id uuid references public.list_items (id) on delete set null,
  attachment_id uuid references public.offer_attachments (id) on delete set null,
  curator_id uuid references public.profiles (id) on delete set null,
  name text not null check (char_length(name) between 1 and 60),
  phone text not null check (char_length(phone) between 5 and 30),
  visit_date date not null,
  visit_time text check (visit_time is null or char_length(visit_time) <= 10),
  party_size integer not null default 2 check (party_size between 1 and 100),
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'new' check (status in ('new', 'confirmed', 'declined', 'visited', 'no_show', 'cancelled')),
  reply text check (reply is null or char_length(reply) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists reservations_business_idx on public.reservations (business_id, created_at desc);
create index if not exists reservations_user_idx on public.reservations (user_id, created_at desc);
alter table public.reservations enable row level security;
create policy "see related reservations" on public.reservations for select to authenticated
  using (user_id = (select auth.uid()) or private.owns_business(business_id) or private.is_admin());

-- 이 장소에 예약 문의를 받는 가게가 있는지(장소 카드의 '예약 문의' 버튼용)
create or replace function public.reservation_offer(p_place text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('business', b.business_name, 'place_name', b.place_name, 'message', o.message)
  from public.biz_offers o join public.businesses b on b.id = o.business_id
  where b.place_id = p_place and o.model = 'reservation' and o.active and b.status = 'approved'
  limit 1;
$$;
grant execute on function public.reservation_offer(text) to anon, authenticated;

-- 예약 문의 보내기(로그인 필요, 하루 5건까지). 그 리스트에 예약 제휴가 붙어 있으면 큐레이터 몫으로 기록된다.
create or replace function public.request_reservation(
  p_item uuid, p_name text, p_phone text, p_date date, p_time text, p_party integer, p_note text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); it public.list_items; o public.biz_offers; b public.businesses; att public.offer_attachments; rid uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  select * into it from public.list_items where id = p_item;
  if it.id is null or not private.can_view_list(it.list_id) then raise exception 'not found'; end if;
  select o2.* into o from public.biz_offers o2 join public.businesses b2 on b2.id = o2.business_id
    where b2.place_id = it.place_id and o2.model = 'reservation' and o2.active and b2.status = 'approved' limit 1;
  if o.id is null then raise exception 'no reservation offer'; end if;
  select * into b from public.businesses where id = o.business_id;
  if b.owner_id = me then raise exception 'own business'; end if;
  if p_date < (now() at time zone 'Asia/Seoul')::date then raise exception 'past date'; end if;
  if (select count(*) from public.reservations where user_id = me and created_at > now() - interval '1 day') >= 5 then
    raise exception 'too many';
  end if;
  select * into att from public.offer_attachments where offer_id = o.id and list_id = it.list_id and active;
  insert into public.reservations (business_id, offer_id, user_id, list_id, item_id, attachment_id, curator_id,
                                   name, phone, visit_date, visit_time, party_size, note)
  values (b.id, o.id, me, it.list_id, it.id, att.id, att.curator_id,
          left(trim(p_name), 60), left(trim(p_phone), 30), p_date, nullif(left(trim(coalesce(p_time, '')), 10), ''),
          greatest(1, least(coalesce(p_party, 2), 100)), nullif(left(trim(coalesce(p_note, '')), 500), ''))
  returning id into rid;
  perform private.notify(b.owner_id, 'reservation_new', me, it.list_id, it.id,
    to_char(p_date, 'MM/DD') || coalesce(' ' || nullif(trim(coalesce(p_time, '')), ''), '') || ' · ' || greatest(1, coalesce(p_party, 2)) || '명 · ' || b.place_name);
  return rid;
end; $$;
revoke all on function public.request_reservation(uuid, text, text, date, text, integer, text) from public, anon;
grant execute on function public.request_reservation(uuid, text, text, date, text, integer, text) to authenticated;

-- 가게가 상태를 바꾼다. '확정'하면 그 리스트에 예약 제휴를 붙인 큐레이터에게 보상이 기록된다(1건 1회).
create or replace function public.set_reservation_status(p_id uuid, p_status text, p_reply text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.reservations; o public.biz_offers; b public.businesses; fee numeric;
begin
  select * into r from public.reservations where id = p_id for update;
  if r.id is null or not private.owns_business(r.business_id) then raise exception 'not allowed'; end if;
  if not (
    (r.status = 'new' and p_status in ('confirmed', 'declined')) or
    (r.status = 'confirmed' and p_status in ('visited', 'no_show', 'cancelled'))
  ) then raise exception 'invalid status change'; end if;
  update public.reservations set status = p_status, reply = coalesce(nullif(left(trim(coalesce(p_reply, '')), 300), ''), reply), updated_at = now()
  where id = p_id;
  select * into b from public.businesses where id = r.business_id;
  if p_status = 'confirmed' and r.attachment_id is not null then
    select * into o from public.biz_offers where id = r.offer_id;
    fee := (select platform_fee_pct from public.monetization_settings);
    if o.id is not null then
      insert into public.offer_charges (offer_id, attachment_id, business_id, curator_id, list_id, model, amount, curator_amount, viewer, day)
      values (o.id, r.attachment_id, r.business_id, r.curator_id, r.list_id, 'reservation', o.rate,
              round(o.rate * (100 - fee) / 100, 2), 'r:' || r.id, (now() at time zone 'Asia/Seoul')::date)
      on conflict (offer_id, viewer, day) do nothing;
    end if;
  end if;
  perform private.notify(r.user_id, 'reservation', b.owner_id, r.list_id, r.item_id,
    b.place_name || ' 예약 문의: ' ||
    case p_status when 'confirmed' then '확정됐어요' when 'declined' then '어렵다고 답했어요' when 'visited' then '방문 완료'
                  when 'no_show' then '노쇼로 기록됐어요' else '취소됐어요' end ||
    coalesce(' — ' || nullif(trim(coalesce(p_reply, '')), ''), ''));
end; $$;
revoke all on function public.set_reservation_status(uuid, text, text) from public, anon;
grant execute on function public.set_reservation_status(uuid, text, text) to authenticated;

-- 손님이 자기 문의를 취소
create or replace function public.cancel_reservation(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.reservations;
begin
  select * into r from public.reservations where id = p_id for update;
  if r.id is null or r.user_id is distinct from (select auth.uid()) or r.status not in ('new', 'confirmed') then
    raise exception 'not allowed';
  end if;
  update public.reservations set status = 'cancelled', updated_at = now() where id = p_id;
  perform private.notify((select owner_id from public.businesses where id = r.business_id), 'reservation_new', r.user_id, r.list_id, r.item_id,
    '예약 문의를 취소했어요 · ' || to_char(r.visit_date, 'MM/DD'));
end; $$;
revoke all on function public.cancel_reservation(uuid) from public, anon;
grant execute on function public.cancel_reservation(uuid) to authenticated;

-- 큐레이터 대시보드에 예약 수익·건수 추가
create or replace function public.curator_dashboard() returns jsonb
language sql stable security definer set search_path = '' as $$
  with me as (select (select auth.uid()) id),
  s as (select * from public.monetization_settings),
  rate as (select coalesce((select rate_pct from public.curator_rates where user_id = (select id from me)), (select default_rate_pct from s)) r),
  m0 as (select date_trunc('month', now() at time zone 'Asia/Seoul')::date d),
  lv as (
    select l.id, l.title, l.slug, l.monetize, l.visibility,
      coalesce(sum(v.views) filter (where v.day >= (select d from m0) and v.slot not like 'house:%'), 0)::int paid_month,
      coalesce(sum(v.views) filter (where v.day >= (select d from m0)), 0)::int all_month,
      coalesce(sum(v.views) filter (where v.day > (now() at time zone 'Asia/Seoul')::date - 30), 0)::int all_30d
    from public.lists l left join public.ad_views_daily v on v.list_id = l.id
    where l.owner_id = (select id from me)
    group by l.id
  )
  select case when (select id from me) is null then null else jsonb_build_object(
    'currency', (select currency from s),
    'est_rpm', (select est_rpm from s),
    'rate_pct', (select r from rate),
    'platform_fee_pct', (select platform_fee_pct from s),
    'min_payout', (select min_payout from s),
    'eligible', private.monetize_eligible((select id from me)),
    'lists', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'title', title, 'slug', slug, 'monetize', monetize, 'visibility', visibility,
        'paid_month', paid_month, 'all_month', all_month, 'all_30d', all_30d,
        'est_month', round(paid_month / 1000.0 * (select est_rpm from s) * (select r from rate) / 100, 2))
        order by monetize desc, all_month desc) from lv), '[]'),
    'display_total', coalesce((select sum(amount) from public.payouts where user_id = (select id from me)), 0),
    'offer_total', coalesce((select sum(curator_amount) from public.offer_charges where curator_id = (select id from me)), 0),
    'offer_month', coalesce((select sum(curator_amount) from public.offer_charges where curator_id = (select id from me) and day >= (select d from m0) and model <> 'reservation'), 0),
    'reservation_month', coalesce((select sum(curator_amount) from public.offer_charges where curator_id = (select id from me) and day >= (select d from m0) and model = 'reservation'), 0),
    'reservations_month', (select count(*) from public.reservations where curator_id = (select id from me) and created_at >= (select d from m0)),
    'reservations_confirmed_month', (select count(*) from public.reservations where curator_id = (select id from me) and created_at >= (select d from m0) and status in ('confirmed', 'visited', 'no_show')),
    'requested', coalesce((select sum(amount) from public.payout_requests where user_id = (select id from me) and status = 'requested'), 0),
    'paid', coalesce((select sum(amount) from public.payout_requests where user_id = (select id from me) and status = 'paid'), 0),
    'available', round(private.curator_available((select id from me)), 2),
    'has_profile', exists (select 1 from public.payout_profiles where user_id = (select id from me))
  ) end;
$$;
revoke execute on function public.curator_dashboard() from public, anon;
grant execute on function public.curator_dashboard() to authenticated;

-- 내 제휴 성과에 예약 문의 건수 추가
create or replace function public.my_offer_stats(p_days integer default 30) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'attachment_id', a.id, 'active', a.active, 'model', o.model, 'rate', o.rate, 'offer_active', o.active,
    'curator_rate', round(o.rate * (100 - (select platform_fee_pct from public.monetization_settings)) / 100, 2),
    'place_name', b.place_name, 'business', b.business_name, 'list_id', l.id, 'list_title', l.title,
    'count', (select count(*) from public.offer_charges c where c.attachment_id = a.id and c.created_at > now() - make_interval(days => p_days)),
    'inquiries', (select count(*) from public.reservations r where r.attachment_id = a.id and r.created_at > now() - make_interval(days => p_days)),
    'earned', coalesce((select sum(curator_amount) from public.offer_charges c where c.attachment_id = a.id and c.created_at > now() - make_interval(days => p_days)), 0),
    'earned_total', coalesce((select sum(curator_amount) from public.offer_charges c where c.attachment_id = a.id), 0)
  ) order by a.created_at desc), '[]')
  from public.offer_attachments a
  join public.biz_offers o on o.id = a.offer_id
  join public.businesses b on b.id = o.business_id
  join public.lists l on l.id = a.list_id
  where a.curator_id = (select auth.uid());
$$;
revoke execute on function public.my_offer_stats(integer) from public, anon;
grant execute on function public.my_offer_stats(integer) to authenticated;

-- ── 0.19-3 카드 결제(나라에 따라 토스페이먼츠 또는 Stripe) ──
alter table public.biz_topups
  add column if not exists provider text not null default 'bank' check (provider in ('bank', 'stripe', 'toss')),
  add column if not exists country text check (country is null or char_length(country) = 2),
  add column if not exists pay_amount numeric(14,2),
  add column if not exists pay_currency text check (pay_currency is null or char_length(pay_currency) = 3),
  add column if not exists external_id text;
create unique index if not exists biz_topups_external_idx on public.biz_topups (provider, external_id) where external_id is not null;
-- 원화 결제(토스)를 기본 통화로 바꿀 때 쓰는 환율: 기본 통화 1단위 = 몇 원
alter table public.monetization_settings add column if not exists krw_per_unit numeric(12,4) not null default 1400 check (krw_per_unit > 0);

-- ── 0.19-4 가게 신청 안내: 이 장소가 이미 인증됐는지, 내가 신청 중인지 ──
create or replace function public.place_claim_status(p_place text) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when exists (select 1 from public.businesses where place_id = p_place and status = 'approved' and owner_id = (select auth.uid())) then 'mine_approved'
    when exists (select 1 from public.businesses where place_id = p_place and status = 'approved') then 'taken'
    when exists (select 1 from public.businesses where place_id = p_place and status = 'pending' and owner_id = (select auth.uid())) then 'mine_pending'
    else 'free' end;
$$;
revoke all on function public.place_claim_status(text) from public, anon;
grant execute on function public.place_claim_status(text) to authenticated;
