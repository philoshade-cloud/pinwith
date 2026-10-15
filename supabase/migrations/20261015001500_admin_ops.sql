-- v0.22 운영자 콘솔 보강: 예약 품질(이상 패턴) 가게 목록·조치, 차단 현황, 이의 제기(분쟁) 처리
-- 되돌리기: supabase/rollback/20261015001500_admin_ops.down.sql

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('follow', 'like', 'comment', 'reply', 'invite', 'invite_accepted', 'share_changed', 'notice', 'resolved',
                  'reservation', 'reservation_new', 'reservation_msg', 'biz_block', 'biz_alert',
                  'biz_review', 'topup_paid', 'payout', 'dispute'));

-- ── 0.22-1 운영자: 예약 품질(노쇼·가게 취소 비율)과 주변 평균, 이상 표시, 운영 메모 ──
alter table public.businesses add column if not exists admin_note text check (admin_note is null or char_length(admin_note) <= 1000);

create or replace function public.admin_store_quality() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'not allowed'; end if;
  return coalesce((select jsonb_agg(x order by (x->>'flagged')::boolean desc, (x->>'rate')::numeric desc nulls last) from (
    select jsonb_build_object(
      'business_id', b.id, 'place_name', b.place_name, 'business', b.business_name, 'status', b.status, 'owner', p.handle,
      'reservations_enabled', b.reservations_enabled, 'admin_note', b.admin_note,
      'confirmed', q.confirmed, 'bad', q.bad,
      'no_show', (select count(*) from public.reservations r where r.business_id = b.id and r.status = 'no_show' and r.created_at > now() - interval '90 days'),
      'cancel_business', (select count(*) from public.reservations r where r.business_id = b.id and r.status = 'cancelled' and r.cancelled_by = 'business' and r.confirmed_at is not null and r.created_at > now() - interval '90 days'),
      'rate', case when q.confirmed > 0 then round(q.bad::numeric / q.confirmed, 3) end,
      'peer', round(private.peer_reservation_rate(b.id), 3),
      'flagged', q.confirmed >= 5 and q.bad::numeric / greatest(q.confirmed, 1) >= greatest(private.peer_reservation_rate(b.id) * 2, private.peer_reservation_rate(b.id) + 0.2),
      'alerts', (select count(*) from public.biz_alerts k where k.business_id = b.id),
      'reservation_offer_active', exists (select 1 from public.biz_offers o where o.business_id = b.id and o.model = 'reservation' and o.active),
      'curators', (select count(distinct a.curator_id) from public.offer_attachments a join public.biz_offers o on o.id = a.offer_id where o.business_id = b.id and a.active),
      'open_disputes', (select count(*) from public.disputes d where d.business_id = b.id and d.status = 'open')
    ) x
    from public.businesses b
    join public.profiles p on p.id = b.owner_id
    cross join lateral private.reservation_quality(b.id) q
    where b.status in ('approved', 'suspended')
  ) t), '[]');
end; $$;

-- ── 0.22-2 운영자: 차단 현황(풀기 가능) ──
create policy "admin manages blocks" on public.biz_blocks for update to authenticated
  using (private.is_admin()) with check (private.is_admin());

create or replace function public.admin_blocks() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'not allowed'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'business_id', b.id, 'place_name', b.place_name, 'curator_id', p.id, 'handle', p.handle, 'name', p.display_name,
      'active', k.active, 'at', k.created_at,
      'blocks_by_this_business', (select count(*) from public.biz_blocks k2 where k2.business_id = b.id and k2.active),
      'blocked_curator_total', (select count(*) from public.biz_blocks k3 where k3.curator_id = p.id and k3.active)
    ) order by k.active desc, k.created_at desc)
    from public.biz_blocks k join public.businesses b on b.id = k.business_id join public.profiles p on p.id = k.curator_id), '[]');
end; $$;

-- ── 0.22-3 이의 제기(분쟁): 큐레이터·가게가 과금·되돌림·노쇼 기록에 이의를 내고, 운영자가 조정 ──
create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  filer_id uuid references public.profiles (id) on delete set null,
  filer_role text not null check (filer_role in ('curator', 'business')),
  business_id uuid not null references public.businesses (id) on delete cascade,
  curator_id uuid references public.profiles (id) on delete set null,
  charge_id bigint references public.offer_charges (id) on delete set null,
  reservation_id uuid references public.reservations (id) on delete set null,
  reason text not null check (char_length(reason) between 5 and 2000),
  status text not null default 'open' check (status in ('open', 'resolved', 'rejected')),
  resolution text check (resolution is null or char_length(resolution) <= 1000),
  adjustment numeric(12,2),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists disputes_status_idx on public.disputes (status, created_at desc);
alter table public.disputes enable row level security;
create policy "parties and admin read disputes" on public.disputes for select to authenticated
  using (filer_id = (select auth.uid()) or curator_id = (select auth.uid()) or private.owns_business(business_id) or private.is_admin());

-- 이의 제기: 가게 주인이면 'business', 그 가게와 제휴한(했던) 큐레이터면 'curator'
create or replace function public.file_dispute(p_business uuid, p_charge bigint default null, p_reservation uuid default null, p_reason text default '')
returns uuid language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); role text; cur uuid; c public.offer_charges; r public.reservations; did uuid; b public.businesses;
begin
  if me is null then raise exception 'not signed in'; end if;
  select * into b from public.businesses where id = p_business;
  if b.id is null then raise exception 'not found'; end if;
  if p_charge is not null then
    select * into c from public.offer_charges where id = p_charge and business_id = p_business;
    if c.id is null then raise exception 'not found'; end if;
  end if;
  if p_reservation is not null then
    select * into r from public.reservations where id = p_reservation and business_id = p_business;
    if r.id is null then raise exception 'not found'; end if;
  end if;
  if b.owner_id = me then
    role := 'business';
    cur := coalesce(c.curator_id, r.curator_id);
  elsif c.curator_id = me or r.curator_id = me or exists (
    select 1 from public.offer_attachments a join public.biz_offers o on o.id = a.offer_id where o.business_id = p_business and a.curator_id = me
  ) then
    role := 'curator';
    cur := me;
  else
    raise exception 'not allowed';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'reason too short'; end if;
  if (select count(*) from public.disputes where filer_id = me and status = 'open') >= 10 then raise exception 'too many'; end if;
  insert into public.disputes (filer_id, filer_role, business_id, curator_id, charge_id, reservation_id, reason)
  values (me, role, p_business, cur, c.id, r.id, left(trim(p_reason), 2000))
  returning id into did;
  -- 운영자들에게 알림
  insert into public.notifications (user_id, kind, actor_id, body)
  select a.user_id, 'dispute', me, b.place_name || ' 이의 제기(' || case role when 'business' then '가게' else '큐레이터' end || '): ' || left(trim(p_reason), 100)
  from public.admins a where a.user_id <> me;
  return did;
end; $$;
revoke all on function public.file_dispute(uuid, bigint, uuid, text) from public, anon;
grant execute on function public.file_dispute(uuid, bigint, uuid, text) to authenticated;

-- 운영자 처리: 기각 / 큐레이터에게 지급(보상 복원) / 가게에 돌려줌(광고비 환불). 금액 조정은 과금 기록 한 줄로 남긴다.
create or replace function public.admin_resolve_dispute(p_id uuid, p_action text, p_amount numeric, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare d public.disputes; o uuid; fee numeric := (select platform_fee_pct from public.monetization_settings); amt numeric := round(coalesce(p_amount, 0), 2);
begin
  if not private.is_admin() then raise exception 'not allowed'; end if;
  select * into d from public.disputes where id = p_id for update;
  if d.id is null or d.status <> 'open' then raise exception 'not open'; end if;
  if p_action not in ('reject', 'pay_curator', 'refund_business') then raise exception 'bad action'; end if;
  if p_action <> 'reject' and amt <= 0 then raise exception 'amount'; end if;
  if p_action <> 'reject' then
    o := coalesce((select offer_id from public.offer_charges where id = d.charge_id),
                  (select offer_id from public.reservations where id = d.reservation_id),
                  (select id from public.biz_offers where business_id = d.business_id order by created_at limit 1));
    if o is null then raise exception 'no offer'; end if;
    -- pay_curator: 가게 잔액에서 빼서 큐레이터에게(수수료 적용). refund_business: 가게 잔액을 돌려주고 큐레이터 몫도 그만큼 줄인다.
    insert into public.offer_charges (offer_id, business_id, curator_id, model, amount, curator_amount, viewer, day)
    values (o, d.business_id, d.curator_id, 'adjustment',
            case p_action when 'pay_curator' then amt else -amt end,
            case when d.curator_id is null then 0 when p_action = 'pay_curator' then round(amt * (100 - fee) / 100, 2) else -round(amt * (100 - fee) / 100, 2) end,
            'dispute:' || d.id, (now() at time zone 'Asia/Seoul')::date);
  end if;
  update public.disputes
  set status = case when p_action = 'reject' then 'rejected' else 'resolved' end,
      resolution = nullif(left(trim(coalesce(p_note, '')), 1000), ''),
      adjustment = case p_action when 'pay_curator' then amt when 'refund_business' then -amt end,
      resolved_at = now()
  where id = p_id;
  -- 양쪽에 결과 알림
  perform private.notify(u, 'dispute', null, null, null,
    (select place_name from public.businesses where id = d.business_id) || ' 이의 제기 처리: ' ||
    case p_action when 'reject' then '받아들이지 않았어요' when 'pay_curator' then '큐레이터에게 ' || amt || ' 지급' else '가게에 ' || amt || ' 환불' end ||
    coalesce(' — ' || nullif(trim(coalesce(p_note, '')), ''), ''))
  from unnest(array[(select owner_id from public.businesses where id = d.business_id), d.curator_id]) u
  where u is not null;
end; $$;
revoke all on function public.admin_resolve_dispute(uuid, text, numeric, text) from public, anon;
grant execute on function public.admin_resolve_dispute(uuid, text, numeric, text) to authenticated;

-- 운영자: 이의 제기 목록(관련 과금·예약·양쪽 정보 포함)
create or replace function public.admin_disputes(p_open_only boolean default true) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'not allowed'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', d.id, 'filer_role', d.filer_role, 'filer', fp.handle, 'place_name', b.place_name, 'business_id', b.id,
      'curator', cp.handle, 'reason', d.reason, 'status', d.status, 'resolution', d.resolution, 'adjustment', d.adjustment,
      'created_at', d.created_at, 'resolved_at', d.resolved_at,
      'charge', case when c.id is not null then jsonb_build_object('model', c.model, 'amount', c.amount, 'at', c.created_at) end,
      'reservation', case when r.id is not null then jsonb_build_object('status', r.status, 'visit_date', r.visit_date, 'visit_time', r.visit_time,
                                                                        'party_size', r.party_size, 'cancelled_by', r.cancelled_by, 'reply', r.reply) end,
      'store_rate', (select case when q.confirmed > 0 then round(q.bad::numeric / q.confirmed, 3) end from private.reservation_quality(b.id) q),
      'peer_rate', round(private.peer_reservation_rate(b.id), 3)
    ) order by d.created_at desc)
    from public.disputes d
    join public.businesses b on b.id = d.business_id
    left join public.profiles fp on fp.id = d.filer_id
    left join public.profiles cp on cp.id = d.curator_id
    left join public.offer_charges c on c.id = d.charge_id
    left join public.reservations r on r.id = d.reservation_id
    where not p_open_only or d.status = 'open'), '[]');
end; $$;

revoke all on function public.admin_store_quality() from public, anon;
revoke all on function public.admin_blocks() from public, anon;
revoke all on function public.admin_disputes(boolean) from public, anon;
grant execute on function public.admin_store_quality() to authenticated;
grant execute on function public.admin_blocks() to authenticated;
grant execute on function public.admin_disputes(boolean) to authenticated;

-- 과금 기록에 운영자 조정이 섞이므로 큐레이터 상세에 id를 내어 준다(이의 제기 대상 지정용)
create or replace function public.my_charges(p_days integer default 30, p_model text default null) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'business_id', c.business_id, 'at', c.created_at, 'place_name', b.place_name,
                                               'list_title', l.title, 'model', c.model, 'amount', c.curator_amount,
                                               'disputed', exists (select 1 from public.disputes d where d.charge_id = c.id and d.status = 'open'))
                            order by c.created_at desc), '[]')
  from public.offer_charges c join public.businesses b on b.id = c.business_id left join public.lists l on l.id = c.list_id
  where c.curator_id = (select auth.uid()) and c.created_at > now() - make_interval(days => p_days)
    and (p_model is null or (p_model = 'reservation' and c.model in ('reservation', 'adjustment')) or (p_model = 'traffic' and c.model in ('click', 'visit')));
$$;
revoke execute on function public.my_charges(integer, text) from public, anon;
grant execute on function public.my_charges(integer, text) to authenticated;

create or replace function public.biz_charges(p_business uuid, p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (private.owns_business(p_business) or private.is_admin()) then raise exception 'not allowed'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'at', c.created_at, 'model', c.model, 'amount', c.amount,
                                                      'list_title', l.title, 'handle', p.handle,
                                                      'disputed', exists (select 1 from public.disputes d where d.charge_id = c.id and d.status = 'open'))
                                   order by c.created_at desc)
    from public.offer_charges c left join public.lists l on l.id = c.list_id left join public.profiles p on p.id = c.curator_id
    where c.business_id = p_business and c.created_at > now() - make_interval(days => p_days)), '[]');
end; $$;
revoke all on function public.biz_charges(uuid, integer) from public, anon;
grant execute on function public.biz_charges(uuid, integer) to authenticated;
