-- v0.18 상업 이용자 콘솔: 가게 계정(인증), 과금 모델, 광고비 충전, 큐레이터 제휴·수익·지급 요청
-- 되돌리기: supabase/rollback/20261015001100_commerce.down.sql

-- 0.17-2 되돌림(리스트 통째로 담기 제외, 사용자 요청): 함수 호출 권한을 회수했다
revoke execute on function public.copy_list(uuid) from authenticated;

-- ── 0.18-3 설정 추가: 플랫폼 수수료, 최소 지급액, 예상 광고 단가(RPM) ──
alter table public.monetization_settings
  add column if not exists platform_fee_pct numeric(5,2) not null default 20 check (platform_fee_pct between 0 and 100),
  add column if not exists min_payout numeric(14,2) not null default 50 check (min_payout >= 0),
  add column if not exists est_rpm numeric(10,4) not null default 1 check (est_rpm >= 0);

-- ── 0.18-4 가게 계정: 어느 가게인지(구글 장소) + 진위 확인 자료 → 운영자 승인 ──
create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  place_id text not null check (char_length(place_id) <= 300),
  place_name text not null check (char_length(place_name) <= 200),
  place_address text check (place_address is null or char_length(place_address) <= 300),
  lat double precision,
  lng double precision,
  business_name text not null check (char_length(business_name) between 1 and 120),
  reg_number text check (reg_number is null or char_length(reg_number) <= 40),
  contact_name text not null check (char_length(contact_name) between 1 and 60),
  contact_phone text not null check (char_length(contact_phone) between 5 and 30),
  role text not null default 'owner' check (role in ('owner', 'manager')),
  doc_path text check (doc_path is null or char_length(doc_path) <= 300),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'suspended')),
  review_note text check (review_note is null or char_length(review_note) <= 500),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
-- 한 가게에는 승인된 계정이 하나만
create unique index if not exists businesses_place_approved on public.businesses (place_id) where status = 'approved';
create index if not exists businesses_owner_idx on public.businesses (owner_id);
alter table public.businesses enable row level security;
create policy "own businesses" on public.businesses for select to authenticated
  using (owner_id = (select auth.uid()) or private.is_admin());
create policy "apply business" on public.businesses for insert to authenticated
  with check (owner_id = (select auth.uid()) and status = 'pending' and reviewed_at is null);
create policy "edit own pending business" on public.businesses for update to authenticated
  using (owner_id = (select auth.uid()) or private.is_admin())
  with check (owner_id = (select auth.uid()) or private.is_admin());

-- 승인 상태·검토 기록은 운영자만 바꾼다. 가게 주인은 반려됐을 때 고쳐서 다시 신청(pending)만 할 수 있다.
create or replace function private.guard_business() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if private.is_admin() then
    if new.status is distinct from old.status then new.reviewed_at := now(); end if;
    return new;
  end if;
  if new.owner_id <> old.owner_id or new.reviewed_at is distinct from old.reviewed_at
     or new.review_note is distinct from old.review_note then
    raise exception 'not allowed';
  end if;
  if new.status <> old.status and not (old.status = 'rejected' and new.status = 'pending') then
    raise exception 'not allowed';
  end if;
  if old.status = 'approved' and (new.place_id <> old.place_id) then
    raise exception 'not allowed';
  end if;
  return new;
end; $$;
create trigger businesses_guard before update on public.businesses for each row execute function private.guard_business();

create or replace function private.owns_business(p_business uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.businesses where id = p_business and owner_id = (select auth.uid()) and status = 'approved');
$$;

-- 진위 확인 자료(사업자등록증 등): 비공개 버킷, 자기 폴더에만 올리고 운영자만 함께 본다
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('biz-docs', 'biz-docs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;
create policy "biz doc upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'biz-docs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "biz doc read own or admin" on storage.objects for select to authenticated
  using (bucket_id = 'biz-docs' and ((storage.foldername(name))[1] = (select auth.uid())::text or private.is_admin()));

-- ── 0.18-5 과금 모델: 가게가 큐레이터에게 내건 조건 ──
-- click: 리스트에서 우리 가게의 길찾기·지도 열기 1회당
-- visit: 가게 500m 안에서 길찾기·지도 열기 1회당(방문 가능성이 높은 손님)
-- 같은 사람(로그인 사용자 또는 동의한 기기)은 모델별로 하루 1회만 과금한다.
create table if not exists public.biz_offers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  model text not null check (model in ('click', 'visit')),
  rate numeric(12,2) not null check (rate > 0),
  monthly_budget numeric(14,2) check (monthly_budget is null or monthly_budget > 0),
  message text check (message is null or char_length(message) <= 300),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, model)
);
alter table public.biz_offers enable row level security;
create policy "business manages offers" on public.biz_offers for all to authenticated
  using (private.owns_business(business_id) or private.is_admin())
  with check (private.owns_business(business_id) or private.is_admin());

-- ── 0.18-6 광고비 충전(선불). 결제 연동 전에는 '충전 요청' → 운영자가 입금 확인 후 '결제됨' ──
create table if not exists public.biz_topups (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null,
  method text not null default 'bank' check (method in ('bank', 'card')),
  status text not null default 'requested' check (status in ('requested', 'paid', 'cancelled')),
  reference text check (reference is null or char_length(reference) <= 200),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
alter table public.biz_topups enable row level security;
create policy "business sees topups" on public.biz_topups for select to authenticated
  using (private.owns_business(business_id) or private.is_admin());
create policy "business requests topup" on public.biz_topups for insert to authenticated
  with check (private.owns_business(business_id) and status = 'requested' and paid_at is null);
create policy "admin confirms topup" on public.biz_topups for update to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- ── 0.18-7 큐레이터가 리스트에 붙인 제휴(과금 모델) ──
create table if not exists public.offer_attachments (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.biz_offers (id) on delete cascade,
  list_id uuid not null references public.lists (id) on delete cascade,
  item_id uuid not null references public.list_items (id) on delete cascade,
  curator_id uuid not null references public.profiles (id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (offer_id, list_id)
);
create index if not exists offer_attachments_item_idx on public.offer_attachments (item_id) where active;
alter table public.offer_attachments enable row level security;
create policy "curator manages attachments" on public.offer_attachments for all to authenticated
  using (curator_id = (select auth.uid()) or private.is_admin())
  with check (curator_id = (select auth.uid()) and private.is_list_owner(list_id));

-- 붙일 수 있는지: 내 리스트에 그 가게가 들어 있어야 하고, 리스트는 공개 또는 링크 공개
create or replace function private.check_attachment() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.list_items i
    join public.lists l on l.id = i.list_id
    join public.biz_offers o on o.id = new.offer_id
    join public.businesses b on b.id = o.business_id
    where i.id = new.item_id and i.list_id = new.list_id and l.owner_id = new.curator_id
      and i.place_id = b.place_id and b.status = 'approved' and l.visibility <> 'private'
  ) then
    raise exception 'invalid attachment';
  end if;
  return new;
end; $$;
create trigger offer_attachments_check before insert or update of offer_id, list_id, item_id on public.offer_attachments
  for each row execute function private.check_attachment();

-- ── 0.18-8 과금 기록: 리스트에서 길찾기·지도 열기가 기록되면 조건에 맞는 제휴마다 과금 ──
create table if not exists public.offer_charges (
  id bigint generated always as identity primary key,
  offer_id uuid not null references public.biz_offers (id) on delete cascade,
  attachment_id uuid references public.offer_attachments (id) on delete set null,
  business_id uuid not null references public.businesses (id) on delete cascade,
  curator_id uuid references public.profiles (id) on delete set null,
  list_id uuid references public.lists (id) on delete set null,
  event_id bigint,
  model text not null,
  amount numeric(12,2) not null,
  curator_amount numeric(12,2) not null,
  viewer text not null,
  day date not null,
  created_at timestamptz not null default now(),
  unique (offer_id, viewer, day)
);
create index if not exists offer_charges_business_idx on public.offer_charges (business_id, created_at);
create index if not exists offer_charges_curator_idx on public.offer_charges (curator_id, created_at);
alter table public.offer_charges enable row level security;
create policy "see own charges" on public.offer_charges for select to authenticated
  using (curator_id = (select auth.uid()) or private.owns_business(business_id) or private.is_admin());

create or replace function private.biz_balance(p_business uuid) returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce((select sum(amount) from public.biz_topups where business_id = p_business and status = 'paid'), 0)
       - coalesce((select sum(amount) from public.offer_charges where business_id = p_business), 0);
$$;

create or replace function private.on_link_event_charge() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  r record;
  v_viewer text := coalesce(new.user_id::text, case when new.device_id is not null then 'd:' || left(new.device_id, 64) end);
  v_day date := (new.created_at at time zone 'Asia/Seoul')::date;
  fee numeric := (select platform_fee_pct from public.monetization_settings);
begin
  if v_viewer is null or new.item_id is null
     or new.event not in ('directions', 'google_open', 'naver_open', 'kakao_open') then
    return new;
  end if;
  for r in
    select a.id att, a.curator_id, o.id offer, o.model, o.rate, o.monthly_budget, b.id biz, b.owner_id biz_owner
    from public.offer_attachments a
    join public.biz_offers o on o.id = a.offer_id
    join public.businesses b on b.id = o.business_id
    where a.item_id = new.item_id and a.list_id = new.list_id and a.active and o.active and b.status = 'approved'
      and (o.model = 'click' or (o.model = 'visit' and new.in_radius is true))
  loop
    -- 큐레이터 본인·가게 주인 본인의 클릭은 과금하지 않는다
    if new.user_id is not null and (new.user_id = r.curator_id or new.user_id = r.biz_owner) then continue; end if;
    if private.biz_balance(r.biz) < r.rate then continue; end if;
    if r.monthly_budget is not null and coalesce((
      select sum(amount) from public.offer_charges
      where offer_id = r.offer and day >= date_trunc('month', v_day)::date), 0) + r.rate > r.monthly_budget then
      continue;
    end if;
    insert into public.offer_charges (offer_id, attachment_id, business_id, curator_id, list_id, event_id, model, amount, curator_amount, viewer, day)
    values (r.offer, r.att, r.biz, r.curator_id, new.list_id, new.id, r.model, r.rate,
            round(r.rate * (100 - fee) / 100, 2), v_viewer, v_day)
    on conflict (offer_id, viewer, day) do nothing;
  end loop;
  return new;
end; $$;
create trigger link_events_charge after insert on public.link_events for each row execute function private.on_link_event_charge();

-- ── 0.18-9 지급 정보와 지급 요청 ──
create table if not exists public.payout_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  method text not null check (method in ('wise', 'paypal', 'bank')),
  holder_name text not null check (char_length(holder_name) between 1 and 100),
  email text check (email is null or char_length(email) <= 200),
  bank_name text check (bank_name is null or char_length(bank_name) <= 100),
  account_number text check (account_number is null or char_length(account_number) <= 60),
  swift text check (swift is null or char_length(swift) <= 20),
  country text check (country is null or char_length(country) <= 2),
  currency text check (currency is null or char_length(currency) = 3),
  updated_at timestamptz not null default now()
);
alter table public.payout_profiles enable row level security;
create policy "own payout profile" on public.payout_profiles for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "admin reads payout profiles" on public.payout_profiles for select to authenticated using (private.is_admin());

create table if not exists public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null,
  status text not null default 'requested' check (status in ('requested', 'paid', 'rejected')),
  reference text check (reference is null or char_length(reference) <= 200),
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
alter table public.payout_requests enable row level security;
create policy "see own payout requests" on public.payout_requests for select to authenticated
  using (user_id = (select auth.uid()) or private.is_admin());
create policy "admin handles payout requests" on public.payout_requests for update to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- 받을 수 있는 금액 = 확정된 디스플레이 광고 정산 + 제휴 수익 − 이미 요청·지급된 금액
create or replace function private.curator_available(p_user uuid) returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce((select sum(amount) from public.payouts where user_id = p_user), 0)
       + coalesce((select sum(curator_amount) from public.offer_charges where curator_id = p_user), 0)
       - coalesce((select sum(amount) from public.payout_requests where user_id = p_user and status in ('requested', 'paid')), 0);
$$;

create or replace function public.request_payout() returns numeric
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); amt numeric; s public.monetization_settings;
begin
  if me is null then raise exception 'not signed in'; end if;
  select * into s from public.monetization_settings;
  if not exists (select 1 from public.payout_profiles where user_id = me) then raise exception 'no payout profile'; end if;
  if exists (select 1 from public.payout_requests where user_id = me and status = 'requested') then raise exception 'already requested'; end if;
  amt := round(private.curator_available(me), 2);
  if amt < s.min_payout or amt <= 0 then raise exception 'below minimum'; end if;
  insert into public.payout_requests (user_id, amount, currency) values (me, amt, s.currency);
  return amt;
end; $$;
revoke all on function public.request_payout() from public, anon;
grant execute on function public.request_payout() to authenticated;

-- ── 0.18-10 콘솔 화면용 조회 ──
-- 큐레이터 대시보드: 디스플레이 광고(리스트별 이번 달 노출·예상 수익) + 제휴 수익 + 지급 가능 금액
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
    'offer_month', coalesce((select sum(curator_amount) from public.offer_charges where curator_id = (select id from me) and day >= (select d from m0)), 0),
    'requested', coalesce((select sum(amount) from public.payout_requests where user_id = (select id from me) and status = 'requested'), 0),
    'paid', coalesce((select sum(amount) from public.payout_requests where user_id = (select id from me) and status = 'paid'), 0),
    'available', round(private.curator_available((select id from me)), 2),
    'has_profile', exists (select 1 from public.payout_profiles where user_id = (select id from me))
  ) end;
$$;
grant execute on function public.curator_dashboard() to authenticated;

-- 제휴 목록: 운영 중인 가게들의 과금 모델(잔액이 있는 것만) + 내 리스트 중 그 가게가 들어 있는 곳
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
        select jsonb_agg(jsonb_build_object('list_id', l.id, 'list_title', l.title, 'item_id', i.id, 'visibility', l.visibility,
               'attached', exists (select 1 from public.offer_attachments a where a.offer_id = o.id and a.list_id = l.id)))
        from public.list_items i join public.lists l on l.id = i.list_id
        where l.owner_id = (select auth.uid()) and i.place_id = b.place_id), '[]'),
      'mine', exists (select 1 from public.list_items i join public.lists l on l.id = i.list_id
                      where l.owner_id = (select auth.uid()) and i.place_id = b.place_id)
    ) x
    from public.biz_offers o join public.businesses b on b.id = o.business_id
    where o.active and b.status = 'approved' and private.biz_balance(b.id) >= o.rate
  ) t;
$$;
grant execute on function public.offer_market() to authenticated;

-- 내가 붙인 제휴의 성과(기간 안 과금 횟수·수익)
create or replace function public.my_offer_stats(p_days integer default 30) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'attachment_id', a.id, 'active', a.active, 'model', o.model, 'rate', o.rate, 'offer_active', o.active,
    'curator_rate', round(o.rate * (100 - (select platform_fee_pct from public.monetization_settings)) / 100, 2),
    'place_name', b.place_name, 'business', b.business_name, 'list_id', l.id, 'list_title', l.title,
    'count', (select count(*) from public.offer_charges c where c.attachment_id = a.id and c.created_at > now() - make_interval(days => p_days)),
    'earned', coalesce((select sum(curator_amount) from public.offer_charges c where c.attachment_id = a.id and c.created_at > now() - make_interval(days => p_days)), 0),
    'earned_total', coalesce((select sum(curator_amount) from public.offer_charges c where c.attachment_id = a.id), 0)
  ) order by a.created_at desc), '[]')
  from public.offer_attachments a
  join public.biz_offers o on o.id = a.offer_id
  join public.businesses b on b.id = o.business_id
  join public.lists l on l.id = a.list_id
  where a.curator_id = (select auth.uid());
$$;
grant execute on function public.my_offer_stats(integer) to authenticated;

-- 가게 대시보드: 잔액, 기간 안 성과(모델별·리스트별·날짜별), 우리 가게를 담은 리스트 수
create or replace function public.biz_dashboard(p_business uuid, p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare b public.businesses; since timestamptz := now() - make_interval(days => p_days);
begin
  select * into b from public.businesses where id = p_business;
  if b.id is null or not (b.owner_id = (select auth.uid()) or private.is_admin()) then raise exception 'not allowed'; end if;
  return jsonb_build_object(
    'currency', (select currency from public.monetization_settings),
    'balance', private.biz_balance(b.id),
    'spent_month', coalesce((select sum(amount) from public.offer_charges where business_id = b.id
                              and day >= date_trunc('month', now() at time zone 'Asia/Seoul')::date), 0),
    'lists_with_place', (select count(distinct i.list_id) from public.list_items i join public.lists l on l.id = i.list_id
                          where i.place_id = b.place_id and l.visibility = 'public'),
    'attached_lists', (select count(*) from public.offer_attachments a join public.biz_offers o on o.id = a.offer_id
                        where o.business_id = b.id and a.active),
    'organic', (select jsonb_build_object(
        'taps', count(*) filter (where e.event = 'tap'),
        'opens', count(*) filter (where e.event in ('directions', 'google_open', 'naver_open', 'kakao_open')),
        'nearby', count(*) filter (where e.in_radius))
      from public.link_events e join public.list_items i on i.id = e.item_id
      where i.place_id = b.place_id and e.created_at > since),
    'by_model', coalesce((select jsonb_agg(jsonb_build_object('model', model, 'count', n, 'cost', cost)) from (
        select model, count(*) n, sum(amount) cost from public.offer_charges where business_id = b.id and created_at > since group by model) t), '[]'),
    'by_list', coalesce((select jsonb_agg(jsonb_build_object('list', title, 'handle', handle, 'slug', slug, 'count', n, 'cost', cost) order by cost desc) from (
        select l.title, p.handle, l.slug, count(*) n, sum(c.amount) cost
        from public.offer_charges c join public.lists l on l.id = c.list_id join public.profiles p on p.id = l.owner_id
        where c.business_id = b.id and c.created_at > since group by l.title, p.handle, l.slug) t), '[]'),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('d', day, 'count', n, 'cost', cost) order by day) from (
        select day, count(*) n, sum(amount) cost from public.offer_charges where business_id = b.id and created_at > since group by day) t), '[]')
  );
end; $$;
revoke all on function public.biz_dashboard(uuid, integer) from public, anon;
grant execute on function public.biz_dashboard(uuid, integer) to authenticated;
