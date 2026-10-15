-- v0.20 예약을 수익화와 분리, 예약 시간대, 환불·이상 패턴 알림, 큐레이터 차단, '광고비 지급될 때만 공개', 예약 대화
-- 되돌리기: supabase/rollback/20261015001300_commerce_v2.down.sql

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('follow', 'like', 'comment', 'reply', 'invite', 'invite_accepted', 'share_changed', 'notice', 'resolved',
                  'reservation', 'reservation_new', 'reservation_msg', 'biz_block', 'biz_alert'));

-- ── 0.20-1 예약 기능은 인증된 가게라면 수익화와 관계없이 켜고 끈다 + 예약 가능 요일·시간대 ──
-- reservation_hours: {"0":[["11:00","21:00"]], ...} 0=일요일 … 6=토요일. 비어 있으면 아무 때나 문의 가능.
alter table public.businesses
  add column if not exists reservations_enabled boolean not null default false,
  add column if not exists reservation_hours jsonb not null default '{}',
  add column if not exists reservation_slot_minutes integer not null default 30 check (reservation_slot_minutes in (15, 30, 60)),
  add column if not exists reservation_max_party integer not null default 20 check (reservation_max_party between 1 and 100),
  add column if not exists reservation_note text check (reservation_note is null or char_length(reservation_note) <= 300);

alter table public.reservations
  add column if not exists confirmed_at timestamptz,
  add column if not exists cancelled_by text check (cancelled_by is null or cancelled_by in ('guest', 'business'));

-- 장소에 예약 문의를 받는 가게가 있으면 안내 정보(어느 리스트에서 보든, 검색해서 보든 같다)
create or replace function public.reservation_offer(p_place text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'business', b.business_name, 'place_name', b.place_name, 'message', b.reservation_note,
    'hours', b.reservation_hours, 'slot', b.reservation_slot_minutes, 'max_party', b.reservation_max_party)
  from public.businesses b
  where b.place_id = p_place and b.status = 'approved' and b.reservations_enabled
  limit 1;
$$;
grant execute on function public.reservation_offer(text) to anon, authenticated;

-- 예전 예약 문의 함수(리스트 항목 기준)는 닫는다
revoke execute on function public.request_reservation(uuid, text, text, date, text, integer, text) from authenticated;

-- 예약 문의: 장소 기준. 리스트 항목(p_item)에서 왔고 그 리스트에 예약 제휴가 붙어 있으면 큐레이터 몫으로 기록.
create or replace function public.request_reservation(
  p_place text, p_item uuid, p_name text, p_phone text, p_date date, p_time text, p_party integer, p_note text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid()); b public.businesses; it public.list_items; o public.biz_offers; att public.offer_attachments;
  rid uuid; slots jsonb; ok boolean := false; s jsonb; t text := nullif(trim(coalesce(p_time, '')), '');
begin
  if me is null then raise exception 'not signed in'; end if;
  select * into b from public.businesses where place_id = p_place and status = 'approved' and reservations_enabled limit 1;
  if b.id is null then raise exception 'no reservation'; end if;
  if b.owner_id = me then raise exception 'own business'; end if;
  if p_date < (now() at time zone 'Asia/Seoul')::date then raise exception 'past date'; end if;
  if p_date > (now() at time zone 'Asia/Seoul')::date + 90 then raise exception 'too far'; end if;
  if coalesce(p_party, 0) < 1 or p_party > b.reservation_max_party then raise exception 'party size'; end if;
  -- 예약 가능 요일·시간대
  if b.reservation_hours <> '{}'::jsonb then
    slots := b.reservation_hours -> extract(dow from p_date)::int::text;
    if slots is null or jsonb_array_length(slots) = 0 then raise exception 'closed day'; end if;
    if t is null then raise exception 'time required'; end if;
    for s in select * from jsonb_array_elements(slots) loop
      if t >= (s ->> 0) and t < (s ->> 1) then ok := true; end if;
    end loop;
    if not ok then raise exception 'closed time'; end if;
  end if;
  if (select count(*) from public.reservations where user_id = me and created_at > now() - interval '1 day') >= 5 then
    raise exception 'too many';
  end if;
  if p_item is not null then
    select * into it from public.list_items where id = p_item and place_id = p_place;
    if it.id is not null and private.can_view_list(it.list_id) then
      select o2.* into o from public.biz_offers o2 where o2.business_id = b.id and o2.model = 'reservation' and o2.active;
      if o.id is not null then
        select * into att from public.offer_attachments where offer_id = o.id and list_id = it.list_id and active;
      end if;
    else
      it := null;
    end if;
  end if;
  insert into public.reservations (business_id, offer_id, user_id, list_id, item_id, attachment_id, curator_id,
                                   name, phone, visit_date, visit_time, party_size, note)
  values (b.id, case when att.id is not null then o.id end, me, it.list_id, it.id, att.id, att.curator_id,
          left(trim(p_name), 60), left(trim(p_phone), 30), p_date, left(t, 10), p_party, nullif(left(trim(coalesce(p_note, '')), 500), ''))
  returning id into rid;
  perform private.notify(b.owner_id, 'reservation_new', me, it.list_id, it.id,
    to_char(p_date, 'MM/DD') || coalesce(' ' || t, '') || ' · ' || p_party || '명 · ' || b.place_name);
  return rid;
end; $$;
revoke all on function public.request_reservation(text, uuid, text, text, date, text, integer, text) from public, anon;
grant execute on function public.request_reservation(text, uuid, text, text, date, text, integer, text) to authenticated;

-- ── 0.20-2 확정은 잔액이 있을 때만, 확정 뒤 노쇼·취소면 큐레이터 보상을 되돌린다 ──
create or replace function private.refund_reservation(r public.reservations) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.offer_charges;
begin
  select * into c from public.offer_charges where viewer = 'r:' || r.id and amount > 0 limit 1;
  if c.id is null then return; end if;
  insert into public.offer_charges (offer_id, attachment_id, business_id, curator_id, list_id, model, amount, curator_amount, viewer, day)
  values (c.offer_id, c.attachment_id, c.business_id, c.curator_id, c.list_id, 'reservation', -c.amount, -c.curator_amount,
          'r:' || r.id || ':refund', (now() at time zone 'Asia/Seoul')::date)
  on conflict (offer_id, viewer, day) do nothing;
end; $$;

-- 이상 패턴: 이 가게의 노쇼·가게 쪽 취소 비율이 주변(3km) 가게들보다 눈에 띄게 높으면 연결된 큐레이터에게 알림(주 1회까지)
create table if not exists public.biz_alerts (
  business_id uuid not null references public.businesses (id) on delete cascade,
  curator_id uuid not null references public.profiles (id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (business_id, curator_id)
);
alter table public.biz_alerts enable row level security;

create or replace function private.reservation_quality(p_business uuid, out confirmed integer, out bad integer)
language sql stable security definer set search_path = '' as $$
  select
    count(*) filter (where confirmed_at is not null and (status in ('visited', 'no_show') or (status = 'cancelled' and cancelled_by = 'business')))::int,
    count(*) filter (where confirmed_at is not null and (status = 'no_show' or (status = 'cancelled' and cancelled_by = 'business')))::int
  from public.reservations where business_id = p_business and created_at > now() - interval '90 days';
$$;

create or replace function private.peer_reservation_rate(p_business uuid) returns numeric
language sql stable security definer set search_path = '' as $$
  with me as (select lat, lng from public.businesses where id = p_business),
  peers as (
    select b.id from public.businesses b, me
    where b.id <> p_business and b.status = 'approved'
      and (me.lat is null or b.lat is null or
           6371000 * 2 * asin(sqrt(power(sin(radians(b.lat - me.lat) / 2), 2) + cos(radians(me.lat)) * cos(radians(b.lat)) * power(sin(radians(b.lng - me.lng) / 2), 2))) < 3000)
  ),
  q as (select sum(x.confirmed) n, sum(x.bad) bad from peers, private.reservation_quality(peers.id) x),
  allq as (select sum(x.confirmed) n, sum(x.bad) bad from public.businesses b2, private.reservation_quality(b2.id) x where b2.id <> p_business)
  select case when (select n from q) >= 10 then (select bad::numeric / n from q)
              when (select n from allq) > 0 then (select bad::numeric / n from allq)
              else 0.1 end;
$$;

create or replace function private.check_reservation_anomaly(p_business uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare q record; peer numeric; rate numeric; b public.businesses; c record;
begin
  select * into q from private.reservation_quality(p_business);
  if q.confirmed < 5 then return; end if;
  rate := q.bad::numeric / q.confirmed;
  peer := private.peer_reservation_rate(p_business);
  if rate < greatest(peer * 2, peer + 0.2) then return; end if;
  select * into b from public.businesses where id = p_business;
  for c in
    select distinct a.curator_id from public.offer_attachments a join public.biz_offers o on o.id = a.offer_id
    where o.business_id = p_business and o.model = 'reservation' and a.active
  loop
    if exists (select 1 from public.biz_alerts where business_id = p_business and curator_id = c.curator_id and sent_at > now() - interval '7 days') then
      continue;
    end if;
    insert into public.biz_alerts (business_id, curator_id, sent_at) values (p_business, c.curator_id, now())
      on conflict (business_id, curator_id) do update set sent_at = now();
    perform private.notify(c.curator_id, 'biz_alert', null, null, null,
      b.place_name || ': 최근 90일 확정 예약 ' || q.confirmed || '건 중 노쇼·가게 취소 ' || q.bad || '건(' || round(rate * 100) || '%). 주변 가게 평균은 '
      || round(peer * 100) || '%예요. 큐레이터 콘솔 → 연결된 가게에서 확인하고, 이상하면 연결을 끊을 수 있어요.');
  end loop;
end; $$;

create or replace function public.set_reservation_status(p_id uuid, p_status text, p_reply text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.reservations; o public.biz_offers; b public.businesses; fee numeric; charged boolean := false;
begin
  select * into r from public.reservations where id = p_id for update;
  if r.id is null or not private.owns_business(r.business_id) then raise exception 'not allowed'; end if;
  if not (
    (r.status = 'new' and p_status in ('confirmed', 'declined')) or
    (r.status = 'confirmed' and p_status in ('visited', 'no_show', 'cancelled'))
  ) then raise exception 'invalid status change'; end if;
  select * into b from public.businesses where id = r.business_id;
  -- 수익화 예약(큐레이터 제휴)이면 잔액이 보상 금액 이상일 때만 확정할 수 있다
  if p_status = 'confirmed' and r.attachment_id is not null then
    select * into o from public.biz_offers where id = r.offer_id and active;
    if o.id is not null and exists (select 1 from public.offer_attachments where id = r.attachment_id and active) then
      if private.biz_balance(r.business_id) < o.rate then raise exception 'insufficient balance'; end if;
      charged := true;
    end if;
  end if;
  update public.reservations
  set status = p_status, updated_at = now(),
      confirmed_at = case when p_status = 'confirmed' then now() else confirmed_at end,
      cancelled_by = case when p_status = 'cancelled' then 'business' else cancelled_by end,
      reply = coalesce(nullif(left(trim(coalesce(p_reply, '')), 300), ''), reply)
  where id = p_id;
  if charged then
    fee := (select platform_fee_pct from public.monetization_settings);
    insert into public.offer_charges (offer_id, attachment_id, business_id, curator_id, list_id, model, amount, curator_amount, viewer, day)
    values (o.id, r.attachment_id, r.business_id, r.curator_id, r.list_id, 'reservation', o.rate,
            round(o.rate * (100 - fee) / 100, 2), 'r:' || r.id, (now() at time zone 'Asia/Seoul')::date)
    on conflict (offer_id, viewer, day) do nothing;
  end if;
  if p_status in ('no_show', 'cancelled') then
    perform private.refund_reservation(r);
    perform private.check_reservation_anomaly(r.business_id);
  end if;
  perform private.notify(r.user_id, 'reservation', b.owner_id, r.list_id, r.item_id,
    b.place_name || ' 예약 문의: ' ||
    case p_status when 'confirmed' then '확정됐어요' when 'declined' then '어렵다고 답했어요' when 'visited' then '방문 완료'
                  when 'no_show' then '노쇼로 기록됐어요' else '가게가 취소했어요' end ||
    coalesce(' — ' || nullif(trim(coalesce(p_reply, '')), ''), ''));
end; $$;
revoke all on function public.set_reservation_status(uuid, text, text) from public, anon;
grant execute on function public.set_reservation_status(uuid, text, text) to authenticated;

create or replace function public.cancel_reservation(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.reservations;
begin
  select * into r from public.reservations where id = p_id for update;
  if r.id is null or r.user_id is distinct from (select auth.uid()) or r.status not in ('new', 'confirmed') then
    raise exception 'not allowed';
  end if;
  update public.reservations set status = 'cancelled', cancelled_by = 'guest', updated_at = now() where id = p_id;
  perform private.refund_reservation(r);
  perform private.notify((select owner_id from public.businesses where id = r.business_id), 'reservation_new', r.user_id, r.list_id, r.item_id,
    '예약 문의를 취소했어요 · ' || to_char(r.visit_date, 'MM/DD'));
end; $$;
revoke all on function public.cancel_reservation(uuid) from public, anon;
grant execute on function public.cancel_reservation(uuid) to authenticated;

-- ── 0.20-3 예약 문의 대화(확정·거절 전에도 손님과 가게가 주고받는다) ──
create table if not exists public.reservation_messages (
  id bigint generated always as identity primary key,
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists reservation_messages_idx on public.reservation_messages (reservation_id, created_at);
alter table public.reservation_messages enable row level security;
create policy "reservation parties read messages" on public.reservation_messages for select to authenticated
  using (exists (select 1 from public.reservations r where r.id = reservation_id
                 and (r.user_id = (select auth.uid()) or private.owns_business(r.business_id) or private.is_admin())));

create or replace function public.send_reservation_message(p_id uuid, p_body text) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.reservations; me uuid := (select auth.uid()); owner uuid; to_user uuid; body text := left(trim(coalesce(p_body, '')), 1000);
begin
  select * into r from public.reservations where id = p_id;
  if r.id is null or body = '' then raise exception 'not allowed'; end if;
  owner := (select owner_id from public.businesses where id = r.business_id);
  if me = r.user_id then to_user := owner;
  elsif me = owner then to_user := r.user_id;
  else raise exception 'not allowed'; end if;
  if (select count(*) from public.reservation_messages where sender_id = me and created_at > now() - interval '1 minute') >= 10 then
    raise exception 'too many';
  end if;
  insert into public.reservation_messages (reservation_id, sender_id, body) values (p_id, me, body);
  perform private.notify(to_user, 'reservation_msg', me, r.list_id, r.item_id,
    (select place_name from public.businesses where id = r.business_id) || ' 예약 문의 · ' || left(body, 100));
end; $$;
revoke all on function public.send_reservation_message(uuid, text) from public, anon;
grant execute on function public.send_reservation_message(uuid, text) to authenticated;

-- ── 0.20-4 '광고비 지급될 때만 공개': 가게 잔액이 모자라면 그 장소를 리스트에서 숨긴다(주인·편집자에겐 보임) ──
alter table public.list_items add column if not exists paid_only boolean not null default false;

create or replace function private.item_funded(p_item uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.offer_attachments a
    join public.biz_offers o on o.id = a.offer_id
    join public.businesses b on b.id = o.business_id
    where a.item_id = p_item and a.active and o.active and b.status = 'approved' and private.biz_balance(b.id) >= o.rate
  );
$$;


-- ── 0.20-5 가게가 큐레이터 차단: 그 큐레이터의 리스트에서 가게가 숨겨지고(지우지 않음), 풀 때까지 다시 담을 수 없다 ──
create table if not exists public.biz_blocks (
  business_id uuid not null references public.businesses (id) on delete cascade,
  curator_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  active boolean not null default true,
  primary key (business_id, curator_id)
);
alter table public.biz_blocks enable row level security;
create policy "business sees blocks" on public.biz_blocks for select to authenticated
  using (private.owns_business(business_id) or private.is_admin());

create or replace function private.guard_blocked_item() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.biz_blocks k join public.businesses b on b.id = k.business_id
    join public.lists l on l.id = new.list_id
    where b.place_id = new.place_id and b.status = 'approved' and k.curator_id = l.owner_id and k.active
  ) then
    raise exception 'blocked by business';
  end if;
  return new;
end; $$;
create trigger list_items_guard_blocked before insert or update of place_id on public.list_items
  for each row execute function private.guard_blocked_item();

create or replace function private.item_blocked(p_list uuid, p_place text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.biz_blocks k join public.businesses b on b.id = k.business_id
    join public.lists l on l.id = p_list
    where b.place_id = p_place and k.curator_id = l.owner_id and k.active
  );
$$;

-- 리스트 항목 보기: 차단된 가게는 숨기고, '지급될 때만 공개'는 잔액이 있을 때만(주인·편집자에겐 보임)
alter policy "view items of visible lists" on public.list_items
  using (private.can_view_list(list_id) and not private.item_blocked(list_id, place_id)
         and (not paid_only or private.can_edit_list(list_id) or private.item_funded(id)));

create or replace function public.block_curator(p_business uuid, p_curator uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare b public.businesses; n integer;
begin
  select * into b from public.businesses where id = p_business;
  if b.id is null or not private.owns_business(p_business) then raise exception 'not allowed'; end if;
  if p_curator = b.owner_id then raise exception 'not allowed'; end if;
  insert into public.biz_blocks (business_id, curator_id, active, created_at) values (p_business, p_curator, true, now())
  on conflict (business_id, curator_id) do update set active = true, created_at = now();
  update public.offer_attachments a set active = false
  from public.biz_offers o where o.id = a.offer_id and o.business_id = p_business and a.curator_id = p_curator;
  select count(*) into n from public.list_items i join public.lists l on l.id = i.list_id
  where l.owner_id = p_curator and i.place_id = b.place_id;
  perform private.notify(p_curator, 'biz_block', null, null, null,
    b.place_name || ' 가게의 요청으로 내 리스트에서 빠졌어요(' || n || '곳). 가게가 풀어 주기 전까지는 보이지 않고 다시 담을 수도 없어요.');
  return n;
end; $$;
revoke all on function public.block_curator(uuid, uuid) from public, anon;
grant execute on function public.block_curator(uuid, uuid) to authenticated;

create or replace function public.unblock_curator(p_business uuid, p_curator uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.owns_business(p_business) then raise exception 'not allowed'; end if;
  update public.biz_blocks set active = false where business_id = p_business and curator_id = p_curator;
end; $$;
revoke all on function public.unblock_curator(uuid, uuid) from public, anon;
grant execute on function public.unblock_curator(uuid, uuid) to authenticated;

-- 우리 가게를 담은 리스트(공개·링크 공개) + 차단한 큐레이터
create or replace function public.biz_lists(p_business uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare b public.businesses;
begin
  select * into b from public.businesses where id = p_business;
  if b.id is null or not (private.owns_business(p_business) or private.is_admin()) then raise exception 'not allowed'; end if;
  return jsonb_build_object(
    'lists', coalesce((select jsonb_agg(jsonb_build_object(
        'list_id', l.id, 'title', l.title, 'slug', l.slug, 'visibility', l.visibility,
        'curator_id', p.id, 'handle', p.handle, 'name', p.display_name, 'paid_only', i.paid_only,
        'models', (select coalesce(jsonb_agg(o.model), '[]') from public.offer_attachments a join public.biz_offers o on o.id = a.offer_id
                   where a.item_id = i.id and a.active and o.business_id = b.id),
        'events_30d', (select count(*) from public.link_events e where e.item_id = i.id and e.created_at > now() - interval '30 days'))
        order by l.title)
      from public.list_items i join public.lists l on l.id = i.list_id join public.profiles p on p.id = l.owner_id
      where i.place_id = b.place_id and l.visibility <> 'private'
        and not exists (select 1 from public.biz_blocks k where k.business_id = b.id and k.curator_id = l.owner_id and k.active)), '[]'),
    'blocked', coalesce((select jsonb_agg(jsonb_build_object('curator_id', p.id, 'handle', p.handle, 'name', p.display_name, 'at', k.created_at))
      from public.biz_blocks k join public.profiles p on p.id = k.curator_id where k.business_id = b.id and k.active), '[]')
  );
end; $$;
revoke all on function public.biz_lists(uuid) from public, anon;
grant execute on function public.biz_lists(uuid) to authenticated;

-- ── 0.20-6 큐레이터: 내 리스트에 없는 가게를 바로 담고 제휴 붙이기 ──
create or replace function public.add_place_and_attach(p_offer uuid, p_list uuid, p_paid_only boolean default false) returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); o public.biz_offers; b public.businesses; l public.lists; iid uuid;
begin
  select * into o from public.biz_offers where id = p_offer and active;
  select * into b from public.businesses where id = o.business_id and status = 'approved';
  select * into l from public.lists where id = p_list;
  if me is null or o.id is null or b.id is null or l.id is null or l.owner_id <> me then raise exception 'not allowed'; end if;
  if l.visibility = 'private' then raise exception 'private list'; end if;
  if exists (select 1 from public.biz_blocks where business_id = b.id and curator_id = me and active) then raise exception 'blocked by business'; end if;
  insert into public.places (google_place_id, lat, lng, coords_fetched_at)
  values (b.place_id, b.lat, b.lng, case when b.lat is not null then now() end)
  on conflict (google_place_id) do nothing;
  select id into iid from public.list_items where list_id = l.id and place_id = b.place_id limit 1;
  if iid is null then
    insert into public.list_items (list_id, place_id, position, added_by, custom_title, paid_only)
    values (l.id, b.place_id, coalesce((select max(position) + 1 from public.list_items where list_id = l.id), 0), me, b.place_name, coalesce(p_paid_only, false))
    returning id into iid;
  elsif p_paid_only then
    update public.list_items set paid_only = true where id = iid;
  end if;
  insert into public.offer_attachments (offer_id, list_id, item_id, curator_id) values (o.id, l.id, iid, me)
  on conflict (offer_id, list_id) do update set active = true, item_id = excluded.item_id;
  return iid;
end; $$;
revoke all on function public.add_place_and_attach(uuid, uuid, boolean) from public, anon;
grant execute on function public.add_place_and_attach(uuid, uuid, boolean) to authenticated;

-- 제휴 목록: 나를 차단한 가게는 빼고, 붙인 항목의 제휴 id와 '지급될 때만 공개' 여부를 함께
create or replace function public.offer_market() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x order by x->>'mine' desc, (x->>'curator_rate')::numeric desc), '[]') from (
    select jsonb_build_object(
      'offer_id', o.id, 'model', o.model, 'rate', o.rate,
      'curator_rate', round(o.rate * (100 - (select platform_fee_pct from public.monetization_settings)) / 100, 2),
      'message', o.message, 'business', b.business_name, 'place_id', b.place_id, 'place_name', b.place_name,
      'place_address', b.place_address, 'lat', b.lat, 'lng', b.lng,
      'budget_left', case when o.monthly_budget is null then null else o.monthly_budget - coalesce((
          select sum(amount) from public.offer_charges c where c.offer_id = o.id
            and c.day >= date_trunc('month', now() at time zone 'Asia/Seoul')::date), 0) end,
      'my_items', coalesce((
        select jsonb_agg(jsonb_build_object('list_id', l.id, 'list_title', l.title, 'item_id', i.id, 'visibility', l.visibility, 'paid_only', i.paid_only,
               'attachment_id', (select a.id from public.offer_attachments a where a.offer_id = o.id and a.list_id = l.id and a.active),
               'attached', exists (select 1 from public.offer_attachments a where a.offer_id = o.id and a.list_id = l.id and a.active)))
        from public.list_items i join public.lists l on l.id = i.list_id
        where l.owner_id = (select auth.uid()) and i.place_id = b.place_id), '[]'),
      'mine', exists (select 1 from public.list_items i join public.lists l on l.id = i.list_id
                      where l.owner_id = (select auth.uid()) and i.place_id = b.place_id)
    ) x
    from public.biz_offers o join public.businesses b on b.id = o.business_id
    where o.active and b.status = 'approved' and private.biz_balance(b.id) >= o.rate
      and not exists (select 1 from public.biz_blocks k where k.business_id = b.id and k.curator_id = (select auth.uid()) and k.active)
  ) t;
$$;
revoke execute on function public.offer_market() from public, anon;
grant execute on function public.offer_market() to authenticated;

-- ── 0.20-7 큐레이터: 연결된 가게별 통계(예약 확정·방문·노쇼·취소, 주변 평균, 이상 표시) ──
create or replace function public.my_connected_stores(p_days integer default 90) returns jsonb
language sql stable security definer set search_path = '' as $$
  with mine as (
    select distinct o.business_id from public.offer_attachments a join public.biz_offers o on o.id = a.offer_id
    where a.curator_id = (select auth.uid())
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'business_id', b.id, 'place_name', b.place_name, 'business', b.business_name,
    'attachments', (select jsonb_agg(jsonb_build_object('attachment_id', a.id, 'model', o.model, 'list_title', l.title, 'active', a.active, 'item_id', a.item_id))
                    from public.offer_attachments a join public.biz_offers o on o.id = a.offer_id join public.lists l on l.id = a.list_id
                    where o.business_id = b.id and a.curator_id = (select auth.uid())),
    'inquiries', (select count(*) from public.reservations r where r.business_id = b.id and r.curator_id = (select auth.uid()) and r.created_at > now() - make_interval(days => p_days)),
    'confirmed', (select count(*) from public.reservations r where r.business_id = b.id and r.curator_id = (select auth.uid()) and r.confirmed_at is not null and r.created_at > now() - make_interval(days => p_days)),
    'visited', (select count(*) from public.reservations r where r.business_id = b.id and r.curator_id = (select auth.uid()) and r.status = 'visited' and r.created_at > now() - make_interval(days => p_days)),
    'no_show', (select count(*) from public.reservations r where r.business_id = b.id and r.curator_id = (select auth.uid()) and r.status = 'no_show' and r.created_at > now() - make_interval(days => p_days)),
    'cancel_business', (select count(*) from public.reservations r where r.business_id = b.id and r.curator_id = (select auth.uid()) and r.status = 'cancelled' and r.cancelled_by = 'business' and r.created_at > now() - make_interval(days => p_days)),
    'cancel_guest', (select count(*) from public.reservations r where r.business_id = b.id and r.curator_id = (select auth.uid()) and r.status = 'cancelled' and r.cancelled_by = 'guest' and r.created_at > now() - make_interval(days => p_days)),
    'store_rate', (select case when q.confirmed > 0 then round(q.bad::numeric / q.confirmed, 3) end from private.reservation_quality(b.id) q),
    'store_confirmed', (select q.confirmed from private.reservation_quality(b.id) q),
    'peer_rate', round(private.peer_reservation_rate(b.id), 3),
    'clicks', (select count(*) from public.offer_charges c where c.business_id = b.id and c.curator_id = (select auth.uid()) and c.model in ('click', 'visit') and c.amount > 0 and c.created_at > now() - make_interval(days => p_days)),
    'earned', coalesce((select sum(curator_amount) from public.offer_charges c where c.business_id = b.id and c.curator_id = (select auth.uid()) and c.created_at > now() - make_interval(days => p_days)), 0),
    'alerted_at', (select sent_at from public.biz_alerts k where k.business_id = b.id and k.curator_id = (select auth.uid()))
  ) order by b.place_name), '[]')
  from public.businesses b join mine on mine.business_id = b.id;
$$;
revoke execute on function public.my_connected_stores(integer) from public, anon;
grant execute on function public.my_connected_stores(integer) to authenticated;

-- 큐레이터 상세: 제휴 수익 기록(되돌린 금액 포함)
create or replace function public.my_charges(p_days integer default 30, p_model text default null) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('at', c.created_at, 'place_name', b.place_name, 'list_title', l.title, 'model', c.model,
                                               'amount', c.curator_amount) order by c.created_at desc), '[]')
  from public.offer_charges c join public.businesses b on b.id = c.business_id left join public.lists l on l.id = c.list_id
  where c.curator_id = (select auth.uid()) and c.created_at > now() - make_interval(days => p_days)
    and (p_model is null or (p_model = 'reservation' and c.model = 'reservation') or (p_model = 'traffic' and c.model in ('click', 'visit')));
$$;
revoke execute on function public.my_charges(integer, text) from public, anon;
grant execute on function public.my_charges(integer, text) to authenticated;

-- ── 0.20-8 가게 대시보드: 과금된 성과와 과금 없는 성과를 나눠서, 예약 상태별, 상세 기록 ──
create or replace function public.biz_dashboard(p_business uuid, p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare b public.businesses; since timestamptz := now() - make_interval(days => p_days);
begin
  select * into b from public.businesses where id = p_business;
  if b.id is null or not (b.owner_id = (select auth.uid()) or private.is_admin()) then raise exception 'not allowed'; end if;
  return jsonb_build_object(
    'currency', (select currency from public.monetization_settings),
    'balance', private.biz_balance(b.id),
    'min_rate', (select min(rate) from public.biz_offers where business_id = b.id and active),
    'spent_month', coalesce((select sum(amount) from public.offer_charges where business_id = b.id
                              and day >= date_trunc('month', now() at time zone 'Asia/Seoul')::date), 0),
    'lists_with_place', (select count(distinct i.list_id) from public.list_items i join public.lists l on l.id = i.list_id
                          where i.place_id = b.place_id and l.visibility <> 'private'),
    'paid_only_lists', (select count(*) from public.list_items i join public.lists l on l.id = i.list_id
                          where i.place_id = b.place_id and l.visibility <> 'private' and i.paid_only),
    'attached_lists', (select count(*) from public.offer_attachments a join public.biz_offers o on o.id = a.offer_id
                        where o.business_id = b.id and a.active),
    'organic', (select jsonb_build_object(
        'taps', count(*) filter (where e.event = 'tap'),
        'opens', count(*) filter (where e.event in ('directions', 'google_open', 'naver_open', 'kakao_open') and not exists (select 1 from public.offer_charges c where c.event_id = e.id)),
        'nearby', count(*) filter (where e.in_radius and not exists (select 1 from public.offer_charges c where c.event_id = e.id)))
      from public.link_events e join public.list_items i on i.id = e.item_id
      where i.place_id = b.place_id and e.created_at > since),
    'by_model', coalesce((select jsonb_agg(jsonb_build_object('model', model, 'count', n, 'cost', cost)) from (
        select model, count(*) filter (where amount > 0) n, sum(amount) cost from public.offer_charges where business_id = b.id and created_at > since group by model) t), '[]'),
    'reservations', (select jsonb_build_object(
        'total', count(*), 'new', count(*) filter (where status = 'new'), 'confirmed', count(*) filter (where confirmed_at is not null),
        'visited', count(*) filter (where status = 'visited'), 'no_show', count(*) filter (where status = 'no_show'),
        'cancelled', count(*) filter (where status = 'cancelled'), 'declined', count(*) filter (where status = 'declined'),
        'via_curator', count(*) filter (where curator_id is not null))
      from public.reservations where business_id = b.id and created_at > since),
    'by_list', coalesce((select jsonb_agg(jsonb_build_object('list', title, 'handle', handle, 'slug', slug, 'count', n, 'cost', cost) order by cost desc) from (
        select l.title, p.handle, l.slug, count(*) filter (where c.amount > 0) n, sum(c.amount) cost
        from public.offer_charges c join public.lists l on l.id = c.list_id join public.profiles p on p.id = l.owner_id
        where c.business_id = b.id and c.created_at > since group by l.title, p.handle, l.slug) t), '[]'),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('d', day, 'count', n, 'cost', cost) order by day) from (
        select day, count(*) filter (where amount > 0) n, sum(amount) cost from public.offer_charges where business_id = b.id and created_at > since group by day) t), '[]')
  );
end; $$;
revoke all on function public.biz_dashboard(uuid, integer) from public, anon;
grant execute on function public.biz_dashboard(uuid, integer) to authenticated;

create or replace function public.biz_charges(p_business uuid, p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (private.owns_business(p_business) or private.is_admin()) then raise exception 'not allowed'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('at', c.created_at, 'model', c.model, 'amount', c.amount,
                                                      'list_title', l.title, 'handle', p.handle) order by c.created_at desc)
    from public.offer_charges c left join public.lists l on l.id = c.list_id left join public.profiles p on p.id = c.curator_id
    where c.business_id = p_business and c.created_at > now() - make_interval(days => p_days)), '[]');
end; $$;
revoke all on function public.biz_charges(uuid, integer) from public, anon;
grant execute on function public.biz_charges(uuid, integer) to authenticated;

-- 내 제휴 성과: 과금 횟수는 되돌린 건을 빼고 센다
create or replace function public.my_offer_stats(p_days integer default 30) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'attachment_id', a.id, 'active', a.active, 'model', o.model, 'rate', o.rate, 'offer_active', o.active, 'item_id', a.item_id,
    'paid_only', (select paid_only from public.list_items where id = a.item_id),
    'curator_rate', round(o.rate * (100 - (select platform_fee_pct from public.monetization_settings)) / 100, 2),
    'place_name', b.place_name, 'business', b.business_name, 'list_id', l.id, 'list_title', l.title,
    'count', (select count(*) from public.offer_charges c where c.attachment_id = a.id and c.amount > 0 and c.created_at > now() - make_interval(days => p_days))
           - (select count(*) from public.offer_charges c where c.attachment_id = a.id and c.amount < 0 and c.created_at > now() - make_interval(days => p_days)),
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
