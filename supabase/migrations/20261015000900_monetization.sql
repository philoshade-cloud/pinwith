-- v0.16 광고 수익 나눔: 운영자, 수익화 자격 기준, 큐레이터별 분배율, 월별 정산, 신고 대상 기록
-- 되돌리기: supabase/rollback/20261015000900_monetization.down.sql

-- ── 0.16-1 운영자 ─────────────────────────
create table if not exists public.admins (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
create policy "see own admin row" on public.admins for select to authenticated using (user_id = (select auth.uid()));

create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

-- ── 0.16-2 수익화 자격 기준(운영자가 콘솔에서 바꿈) ──────
create table if not exists public.monetization_settings (
  id boolean primary key default true check (id),
  min_followers integer not null default 1000 check (min_followers >= 0),
  min_ad_views_30d integer not null default 10000 check (min_ad_views_30d >= 0),
  default_rate_pct numeric(5,2) not null default 50 check (default_rate_pct between 0 and 100),
  currency text not null default 'USD' check (char_length(currency) = 3),
  updated_at timestamptz not null default now()
);
insert into public.monetization_settings (id) values (true) on conflict do nothing;
alter table public.monetization_settings enable row level security;
create policy "anyone reads settings" on public.monetization_settings for select using (true);
create policy "admins change settings" on public.monetization_settings for update to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- 큐레이터별 분배율(없으면 기본 분배율). 운영자가 정하면 기준과 관계없이 수익화 자격을 준다.
create table if not exists public.curator_rates (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  rate_pct numeric(5,2) not null check (rate_pct between 0 and 100),
  note text check (note is null or char_length(note) <= 300),
  updated_at timestamptz not null default now()
);
alter table public.curator_rates enable row level security;
create policy "admins manage rates" on public.curator_rates for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy "see own rate" on public.curator_rates for select to authenticated using (user_id = (select auth.uid()));

-- ── 0.16-3 광고 노출 세는 기준 강화 ──────
-- 같은 사람(로그인 사용자 또는 브라우저별 무작위 번호)이 같은 리스트·자리를 30분 안에 다시 봐도 1번만 센다.
-- 주인과 공동 편집자의 열람은 세지 않는다. 자체 홍보(house:로 시작하는 자리)도 기록하되 정산에서는 뺀다.
create table if not exists private.ad_view_seen (
  viewer text not null,
  list_id uuid not null references public.lists (id) on delete cascade,
  slot text not null,
  seen_at timestamptz not null,
  primary key (viewer, list_id, slot)
);

create or replace function public.record_ad_view(p_list uuid, p_slot text, p_viewer text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  v text := coalesce(me::text, 'a:' || left(nullif(p_viewer, ''), 64));
  s text := left(p_slot, 40);
begin
  if v is null or s is null then return; end if;
  if not exists (select 1 from public.lists l where l.id = p_list and l.visibility <> 'private'
                 and l.owner_id is distinct from me) then return; end if;
  if me is not null and exists (select 1 from public.list_editors e where e.list_id = p_list and e.user_id = me) then return; end if;
  insert into private.ad_view_seen as x (viewer, list_id, slot, seen_at) values (v, p_list, s, now())
    on conflict (viewer, list_id, slot) do update set seen_at = now() where x.seen_at < now() - interval '30 minutes';
  if not found then return; end if;
  insert into public.ad_views_daily (day, list_id, slot, views)
    values ((now() at time zone 'Asia/Seoul')::date, p_list, s, 1)
    on conflict (day, list_id, slot) do update set views = public.ad_views_daily.views + 1;
end; $$;
grant execute on function public.record_ad_view(uuid, text, text) to anon, authenticated;
-- 예전 함수(중복 확인 없음)는 더 이상 세지 않는다
create or replace function public.record_ad_view(p_list uuid, p_slot text) returns void
language plpgsql security definer set search_path = '' as $$ begin return; end; $$;

-- ── 0.16-4 수익화 자격 ──────
create or replace function private.monetize_counts(p_user uuid, out followers integer, out views_30d integer)
language sql stable security definer set search_path = '' as $$
  select
    (select count(*)::int from public.follows where followee_id = p_user),
    (select coalesce(sum(v.views), 0)::int from public.ad_views_daily v join public.lists l on l.id = v.list_id
      where l.owner_id = p_user and v.day > (now() at time zone 'Asia/Seoul')::date - 30);
$$;

create or replace function private.monetize_eligible(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.curator_rates where user_id = p_user)
      or c.followers >= s.min_followers or c.views_30d >= s.min_ad_views_30d
  from private.monetize_counts(p_user) c, public.monetization_settings s;
$$;

-- 내 수익화 상태(알림 상단 고정 안내, 편집 화면의 수익화 체크 표시에 씀)
create or replace function public.my_monetization() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when (select auth.uid()) is null then null else jsonb_build_object(
    'eligible', private.monetize_eligible((select auth.uid())),
    'followers', c.followers,
    'views_30d', c.views_30d,
    'min_followers', s.min_followers,
    'min_ad_views_30d', s.min_ad_views_30d,
    'monetizing', exists (select 1 from public.lists where owner_id = (select auth.uid()) and monetize),
    'rate_pct', coalesce((select rate_pct from public.curator_rates where user_id = (select auth.uid())), s.default_rate_pct),
    'is_admin', private.is_admin()
  ) end
  from private.monetize_counts((select auth.uid())) c, public.monetization_settings s;
$$;
grant execute on function public.my_monetization() to authenticated;

-- 수익화는 주인만, 자격이 있을 때만 켤 수 있다(끄는 것은 언제나 가능)
create or replace function private.guard_monetize() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.monetize and (tg_op = 'INSERT' or not old.monetize) then
    if (select auth.uid()) is distinct from new.owner_id and not private.is_admin() then
      raise exception 'only the owner can monetize';
    end if;
    if not private.monetize_eligible(new.owner_id) and not private.is_admin() then
      raise exception 'not eligible to monetize';
    end if;
  end if;
  if tg_op = 'UPDATE' and old.monetize and not new.monetize
     and (select auth.uid()) is distinct from new.owner_id and not private.is_admin() then
    raise exception 'only the owner can monetize';
  end if;
  return new;
end; $$;
create trigger lists_guard_monetize before insert or update of monetize on public.lists
  for each row execute function private.guard_monetize();

-- ── 0.16-5 월별 광고 수익과 정산 ──────
create table if not exists public.ad_revenue_months (
  month date primary key check (extract(day from month) = 1),
  revenue numeric(14,2) not null check (revenue >= 0),
  currency text not null default 'USD' check (char_length(currency) = 3),
  note text check (note is null or char_length(note) <= 500),
  finalized_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.ad_revenue_months enable row level security;
create policy "admins manage revenue" on public.ad_revenue_months for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  month date not null references public.ad_revenue_months (month),
  user_id uuid references public.profiles (id) on delete set null,
  handle text not null,
  views integer not null default 0,
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null,
  detail jsonb not null default '[]',
  status text not null default 'pending' check (status in ('pending', 'paid', 'held')),
  method text check (method is null or char_length(method) <= 40),
  reference text check (reference is null or char_length(reference) <= 200),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (month, user_id)
);
alter table public.payouts enable row level security;
create policy "admins manage payouts" on public.payouts for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy "see own payouts" on public.payouts for select to authenticated using (user_id = (select auth.uid()));

-- 정산 미리보기: 그 달 '리스트 화면 광고 수익'을 수익화한 리스트의 실제 광고 노출 비중으로 나눈 뒤
-- 큐레이터 분배율을 곱한다. 공동 편집자 배분(%)은 그 리스트 몫에서 떼어 주고 나머지는 주인 몫.
-- 분모는 그 달 모든 리스트(수익화하지 않은 리스트 포함)의 실제 광고 노출이다.
create or replace function public.admin_payout_preview(p_month date)
returns table (user_id uuid, handle text, display_name text, views bigint, amount numeric, detail jsonb)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not private.is_admin() then raise exception 'not allowed'; end if;
  return query
  with v as (
    select a.list_id, sum(a.views)::bigint n from public.ad_views_daily a
    where a.day >= p_month and a.day < (p_month + interval '1 month')::date and a.slot not like 'house:%'
    group by a.list_id
  ),
  tot as (select nullif(sum(n), 0)::numeric t from v),
  rev as (select coalesce((select revenue from public.ad_revenue_months where month = p_month), 0) r),
  lv as (
    select l.id list_id, l.title, l.owner_id, v.n,
      (select r from rev) * v.n / (select t from tot)
        * coalesce(cr.rate_pct, (select default_rate_pct from public.monetization_settings)) / 100 amt
    from v join public.lists l on l.id = v.list_id
    left join public.curator_rates cr on cr.user_id = l.owner_id
    where l.monetize
  ),
  ed as (
    select e.list_id, e.user_id uid, e.revenue_share_pct pct from public.list_editors e
    join lv on lv.list_id = e.list_id where e.accepted_at is not null and e.revenue_share_pct > 0
  ),
  sh as (
    select lv.owner_id uid, lv.title, lv.n, 'owner' role,
      lv.amt * greatest(0, 100 - coalesce((select sum(pct) from ed where ed.list_id = lv.list_id), 0)) / 100 amt
    from lv
    union all
    select ed.uid, lv.title, lv.n, 'editor', lv.amt * least(ed.pct, 100) / 100 from ed join lv on lv.list_id = ed.list_id
  )
  select sh.uid, p.handle, p.display_name,
    sum(case when sh.role = 'owner' then sh.n else 0 end)::bigint,
    round(sum(sh.amt), 2),
    jsonb_agg(jsonb_build_object('list', sh.title, 'views', sh.n, 'role', sh.role, 'amount', round(sh.amt, 2)))
  from sh join public.profiles p on p.id = sh.uid
  group by sh.uid, p.handle, p.display_name
  order by 5 desc;
end; $$;
revoke all on function public.admin_payout_preview(date) from public, anon;
grant execute on function public.admin_payout_preview(date) to authenticated;

-- 정산 확정: 미리보기 결과를 지급 목록으로 굳힌다(한 달에 한 번)
create or replace function public.admin_finalize_month(p_month date) returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer; cur text;
begin
  if not private.is_admin() then raise exception 'not allowed'; end if;
  select currency into cur from public.ad_revenue_months where month = p_month and finalized_at is null for update;
  if cur is null then raise exception 'month missing or already finalized'; end if;
  insert into public.payouts (month, user_id, handle, views, amount, currency, detail)
    select p_month, x.user_id, x.handle, x.views, x.amount, cur, x.detail
    from public.admin_payout_preview(p_month) x where x.amount > 0;
  get diagnostics n = row_count;
  update public.ad_revenue_months set finalized_at = now() where month = p_month;
  return n;
end; $$;
revoke all on function public.admin_finalize_month(date) from public, anon;
grant execute on function public.admin_finalize_month(date) to authenticated;

-- 운영자용 큐레이터 목록(팔로워·최근 30일 노출·자격·분배율)
create or replace function public.admin_curators(p_query text default null)
returns table (user_id uuid, handle text, display_name text, followers integer, views_30d integer,
               eligible boolean, monetized_lists integer, rate_pct numeric)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not private.is_admin() then raise exception 'not allowed'; end if;
  return query
  select p.id, p.handle, p.display_name, c.followers, c.views_30d, private.monetize_eligible(p.id),
    (select count(*)::int from public.lists l where l.owner_id = p.id and l.monetize),
    cr.rate_pct
  from public.profiles p
  cross join lateral private.monetize_counts(p.id) c
  left join public.curator_rates cr on cr.user_id = p.id
  where p_query is null or p_query = '' or p.handle ilike '%' || p_query || '%' or p.display_name ilike '%' || p_query || '%'
  order by c.views_30d desc, c.followers desc
  limit 200;
end; $$;
revoke all on function public.admin_curators(text) from public, anon;
grant execute on function public.admin_curators(text) to authenticated;

-- ── 0.16-6 신고 대상 기록, 운영자가 문의·신고 보기 ──────
alter table public.support_requests add column if not exists list_id uuid references public.lists (id) on delete set null;
create policy "admins see support requests" on public.support_requests for select to authenticated using (private.is_admin());
create policy "admins handle support requests" on public.support_requests for update to authenticated
  using (private.is_admin()) with check (private.is_admin());
