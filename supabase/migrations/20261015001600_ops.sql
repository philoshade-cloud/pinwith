-- v0.23 운영자 조치 잠금, 서비스 사용량·예산 알림, 오류 기록, 요청 제한
-- 되돌리기: supabase/rollback/20261015001600_ops.down.sql

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('follow', 'like', 'comment', 'reply', 'invite', 'invite_accepted', 'share_changed', 'notice', 'resolved',
                  'reservation', 'reservation_new', 'reservation_msg', 'biz_block', 'biz_alert',
                  'biz_review', 'topup_paid', 'payout', 'dispute', 'biz_admin', 'ops'));

-- ── 0.23-1 운영자 조치 잠금: 운영자가 끈 예약 제휴·예약 기능은 운영자가 풀기 전까지 가게가 다시 켤 수 없다 ──
alter table public.businesses
  add column if not exists lock_reservation_offer boolean not null default false,
  add column if not exists lock_reservations boolean not null default false;

create or replace function private.guard_business() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if private.is_admin() then
    if new.status is distinct from old.status then new.reviewed_at := now(); end if;
    return new;
  end if;
  if new.owner_id <> old.owner_id or new.reviewed_at is distinct from old.reviewed_at
     or new.review_note is distinct from old.review_note or new.admin_note is distinct from old.admin_note
     or new.lock_reservation_offer is distinct from old.lock_reservation_offer or new.lock_reservations is distinct from old.lock_reservations then
    raise exception 'not allowed';
  end if;
  if new.status <> old.status and not (old.status = 'rejected' and new.status = 'pending') then
    raise exception 'not allowed';
  end if;
  if old.status = 'approved' and (new.place_id <> old.place_id) then
    raise exception 'not allowed';
  end if;
  if new.reservations_enabled and not old.reservations_enabled and new.lock_reservations then
    raise exception 'locked by admin';
  end if;
  return new;
end; $$;

create or replace function private.guard_offer_lock() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.model = 'reservation' and new.active and not private.is_admin()
     and (select lock_reservation_offer from public.businesses where id = new.business_id) then
    raise exception 'locked by admin';
  end if;
  return new;
end; $$;
create trigger biz_offers_guard_lock before insert or update on public.biz_offers
  for each row execute function private.guard_offer_lock();

-- 운영자 조치: 잠그면 기능을 끄고, 가게와 그 가게 예약 제휴를 붙인 큐레이터들에게 알린다. 풀면 가게가 다시 켤 수 있다.
create or replace function public.admin_set_lock(p_business uuid, p_what text, p_on boolean, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare b public.businesses; what text; note text := nullif(trim(coalesce(p_note, '')), ''); c record;
begin
  if not private.is_admin() then raise exception 'not allowed'; end if;
  if p_what not in ('offer', 'reservations') then raise exception 'bad target'; end if;
  select * into b from public.businesses where id = p_business for update;
  if b.id is null then raise exception 'not found'; end if;
  what := case p_what when 'offer' then '예약 제휴(큐레이터 보상)' else '예약 문의 기능' end;
  if p_what = 'offer' then
    update public.businesses set lock_reservation_offer = p_on where id = b.id;
    if p_on then update public.biz_offers set active = false, updated_at = now() where business_id = b.id and model = 'reservation'; end if;
  else
    update public.businesses set lock_reservations = p_on, reservations_enabled = case when p_on then false else reservations_enabled end where id = b.id;
  end if;
  perform private.notify(b.owner_id, 'biz_admin', null, null, null,
    b.place_name || ': 운영자가 ' || what || case when p_on then '을(를) 껐어요. 운영자가 풀기 전까지 다시 켤 수 없어요. 이의가 있으면 가게 콘솔에서 이의 제기를 해 주세요.'
                                                     else ' 잠금을 풀었어요. 다시 켤 수 있어요.' end || coalesce(' 사유: ' || note, ''));
  for c in
    select distinct a.curator_id from public.offer_attachments a join public.biz_offers o on o.id = a.offer_id
    where o.business_id = b.id and o.model = 'reservation'
  loop
    perform private.notify(c.curator_id, 'biz_admin', null, null, null,
      b.place_name || ': 운영자 조치로 ' || what || case when p_on then '이(가) 꺼졌어요. 이 가게의 예약 보상은 당분간 없어요.' else '이(가) 다시 가능해졌어요.' end
      || coalesce(' 사유: ' || note, ''));
  end loop;
end; $$;
revoke all on function public.admin_set_lock(uuid, text, boolean, text) from public, anon;
grant execute on function public.admin_set_lock(uuid, text, boolean, text) to authenticated;

-- ── 0.23-2 요청 제한(남용 방지) ──
create table if not exists public.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count integer not null default 0
);
alter table public.rate_limits enable row level security;

-- 한 키(예: 'support:1.2.3.4')가 p_seconds 동안 p_limit번까지만 통과
create or replace function private.rate_ok(p_key text, p_limit integer, p_seconds integer) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  insert into public.rate_limits as r (key, window_start, count) values (left(p_key, 200), now(), 1)
  on conflict (key) do update set
    count = case when r.window_start < now() - make_interval(secs => p_seconds) then 1 else r.count + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_seconds) then now() else r.window_start end
  returning count into n;
  return n <= p_limit;
end; $$;

-- 서버(API)에서 쓰는 요청 제한
create or replace function public.rate_hit(p_key text, p_limit integer, p_seconds integer) returns boolean
language sql security definer set search_path = '' as $$ select private.rate_ok(p_key, p_limit, p_seconds); $$;
revoke all on function public.rate_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_hit(text, integer, integer) to service_role;

-- 링크 반응 기록: 같은 기기·사람이 1분에 60번 넘게 보내면 조용히 버린다(통계·과금 부풀리기 방지)
create or replace function private.limit_link_events() returns trigger language plpgsql security definer set search_path = '' as $$
declare k text := coalesce(new.user_id::text, new.device_id);
begin
  if k is not null and not private.rate_ok('ev:' || k, 60, 60) then return null; end if;
  return new;
end; $$;
create trigger link_events_rate before insert on public.link_events for each row execute function private.limit_link_events();

-- 댓글: 1분에 10개까지
create or replace function private.limit_comments() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not private.rate_ok('cm:' || new.author_id, 10, 60) then raise exception 'too many comments'; end if;
  return new;
end; $$;
create trigger item_comments_rate before insert on public.item_comments for each row execute function private.limit_comments();

-- 리스트 만들기: 1시간에 30개까지
create or replace function private.limit_lists() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() and not private.rate_ok('ls:' || new.owner_id, 30, 3600) then raise exception 'too many lists'; end if;
  return new;
end; $$;
create trigger lists_rate before insert on public.lists for each row execute function private.limit_lists();

-- ── 0.23-3 서비스 사용량과 예산 알림 ──
-- 외부 서비스 요금이 나가는 동작을 날짜별로 센다(구글 지도 장소 카드·검색 등). 요금표·예산은 운영자가 바꾼다.
create table if not exists public.usage_daily (
  day date not null,
  kind text not null,
  count integer not null default 0,
  primary key (day, kind)
);
alter table public.usage_daily enable row level security;
create policy "admins read usage" on public.usage_daily for select to authenticated using (private.is_admin());

create table if not exists public.usage_prices (
  kind text primary key,
  service text not null,
  label text not null,
  usd_per_1000 numeric(10,4) not null check (usd_per_1000 >= 0),
  free_per_month integer not null default 0 check (free_per_month >= 0)
);
alter table public.usage_prices enable row level security;
create policy "admins manage prices" on public.usage_prices for all to authenticated using (private.is_admin()) with check (private.is_admin());
insert into public.usage_prices (kind, service, label, usd_per_1000, free_per_month) values
  ('maps_card', 'google', '구글 장소 카드(UI Kit, 사진·평점)', 1.0, 10000),
  ('autocomplete', 'google', '구글 장소 검색 제안(세션)', 2.83, 10000),
  ('text_search', 'google', '구글 장소 여러 곳 찾기(Enter)', 32.0, 5000),
  ('place_details', 'google', '구글 좌표 다시 받기(서버)', 5.0, 10000),
  ('maps_js', 'google', '구글 지도 스크립트 불러오기', 0, 0)
on conflict (kind) do nothing;

create table if not exists public.service_budgets (
  service text primary key,
  label text not null,
  monthly_budget_usd numeric(10,2) not null default 0 check (monthly_budget_usd >= 0),
  alert_pct integer not null default 80 check (alert_pct between 10 and 200),
  last_alert_on date
);
alter table public.service_budgets enable row level security;
create policy "admins manage budgets" on public.service_budgets for all to authenticated using (private.is_admin()) with check (private.is_admin());
insert into public.service_budgets (service, label, monthly_budget_usd, alert_pct) values
  ('google', 'Google Maps Platform', 50, 80),
  ('supabase_db', 'Supabase 데이터베이스 용량(MB)', 500, 80)
on conflict (service) do nothing;

-- 브라우저·서버가 사용량을 1씩(최대 20) 보탠다. 같은 기기에서 1분에 120번까지만 센다.
create or replace function public.log_usage(p_kind text, p_n integer default 1, p_key text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.usage_prices where kind = p_kind) then return; end if;
  if not private.rate_ok('us:' || coalesce((select auth.uid())::text, left(p_key, 64), 'anon'), 120, 60) then return; end if;
  insert into public.usage_daily (day, kind, count) values ((now() at time zone 'Asia/Seoul')::date, p_kind, greatest(1, least(coalesce(p_n, 1), 20)))
  on conflict (day, kind) do update set count = public.usage_daily.count + excluded.count;
end; $$;
grant execute on function public.log_usage(text, integer, text) to anon, authenticated;

-- 자동 작업 실행 기록(매일 작업이 돌았는지 확인용)
create table if not exists public.job_runs (
  id bigint generated always as identity primary key,
  job text not null,
  ran_at timestamptz not null default now(),
  ok boolean not null,
  detail jsonb
);
create index if not exists job_runs_idx on public.job_runs (job, ran_at desc);
alter table public.job_runs enable row level security;
create policy "admins read job runs" on public.job_runs for select to authenticated using (private.is_admin());

-- 운영자 화면: 이번 달 사용량·예상 요금·월말 예상, DB 용량, 최근 자동 작업
create or replace function public.admin_usage() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare m0 date := date_trunc('month', now() at time zone 'Asia/Seoul')::date; d int; dim int;
begin
  if not private.is_admin() then raise exception 'not allowed'; end if;
  d := extract(day from now() at time zone 'Asia/Seoul')::int;
  dim := extract(day from (m0 + interval '1 month' - interval '1 day'))::int;
  return jsonb_build_object(
    'day_of_month', d, 'days_in_month', dim,
    'items', coalesce((select jsonb_agg(jsonb_build_object(
        'kind', p.kind, 'service', p.service, 'label', p.label, 'usd_per_1000', p.usd_per_1000, 'free', p.free_per_month,
        'month', coalesce(u.n, 0),
        'projected', round(coalesce(u.n, 0)::numeric * dim / greatest(d, 1)),
        'cost', round(greatest(coalesce(u.n, 0) - p.free_per_month, 0) * p.usd_per_1000 / 1000, 2),
        'projected_cost', round(greatest(round(coalesce(u.n, 0)::numeric * dim / greatest(d, 1)) - p.free_per_month, 0) * p.usd_per_1000 / 1000, 2),
        'last7', (select coalesce(jsonb_agg(jsonb_build_object('d', x.day, 'n', x.count) order by x.day), '[]') from public.usage_daily x where x.kind = p.kind and x.day > (now() at time zone 'Asia/Seoul')::date - 7)
      ) order by p.service, p.kind)
      from public.usage_prices p
      left join (select kind, sum(count) n from public.usage_daily where day >= m0 group by kind) u on u.kind = p.kind), '[]'),
    'budgets', (select jsonb_agg(to_jsonb(b) order by service) from public.service_budgets b),
    'db_mb', round(pg_database_size(current_database()) / 1048576.0, 1),
    'jobs', coalesce((select jsonb_agg(jsonb_build_object('job', j.job, 'ran_at', j.ran_at, 'ok', j.ok, 'detail', j.detail) order by j.ran_at desc)
                      from (select * from public.job_runs order by ran_at desc limit 10) j), '[]')
  );
end; $$;
revoke all on function public.admin_usage() from public, anon;
grant execute on function public.admin_usage() to authenticated;

-- 매일 자동 작업에서 부른다: 월말 예상이 예산의 alert_pct%를 넘거나 DB 용량이 넘으면 운영자에게 알림(하루 1번)
create or replace function public.run_budget_check() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u jsonb; g numeric; dbmb numeric; b public.service_budgets; out jsonb := '[]'; msg text;
begin
  u := (select jsonb_agg(x) from (
    select p.service, sum(round(greatest(round(coalesce(n, 0)::numeric * dim / greatest(d, 1)) - p.free_per_month, 0) * p.usd_per_1000 / 1000, 2)) cost
    from public.usage_prices p
    left join (select kind, sum(count) n from public.usage_daily where day >= date_trunc('month', now() at time zone 'Asia/Seoul')::date group by kind) s on s.kind = p.kind
    cross join (select extract(day from now() at time zone 'Asia/Seoul')::int d,
                       extract(day from (date_trunc('month', now() at time zone 'Asia/Seoul') + interval '1 month' - interval '1 day'))::int dim) t
    group by p.service) x);
  g := coalesce((select (e->>'cost')::numeric from jsonb_array_elements(u) e where e->>'service' = 'google'), 0);
  dbmb := round(pg_database_size(current_database()) / 1048576.0, 1);
  for b in select * from public.service_budgets loop
    msg := null;
    if b.service = 'google' and b.monthly_budget_usd > 0 and g >= b.monthly_budget_usd * b.alert_pct / 100 then
      msg := '구글 지도 요금이 이번 달 약 $' || g || '로 예상돼요(예산 $' || b.monthly_budget_usd || '의 ' || round(g * 100 / b.monthly_budget_usd) || '%).';
    elsif b.service = 'supabase_db' and b.monthly_budget_usd > 0 and dbmb >= b.monthly_budget_usd * b.alert_pct / 100 then
      msg := '데이터베이스 용량이 ' || dbmb || 'MB예요(한도 ' || b.monthly_budget_usd || 'MB의 ' || round(dbmb * 100 / b.monthly_budget_usd) || '%).';
    end if;
    if msg is not null and b.last_alert_on is distinct from (now() at time zone 'Asia/Seoul')::date then
      insert into public.notifications (user_id, kind, body) select a.user_id, 'ops', '💰 예산 확인: ' || msg || ' 운영자 콘솔 → 서비스 사용량에서 확인하세요.' from public.admins a;
      update public.service_budgets set last_alert_on = (now() at time zone 'Asia/Seoul')::date where service = b.service;
      out := out || jsonb_build_array(msg);
    end if;
  end loop;
  return jsonb_build_object('google_projected', g, 'db_mb', dbmb, 'alerts', out);
end; $$;
revoke all on function public.run_budget_check() from public, anon, authenticated;
grant execute on function public.run_budget_check() to service_role;

-- ── 0.23-4 오류 기록: 화면·서버에서 난 오류를 모아 운영자 콘솔에서 본다(같은 오류는 횟수만 늘림, 새 오류는 운영자에게 알림) ──
create table if not exists public.error_logs (
  fingerprint text primary key,
  source text not null check (source in ('client', 'server')),
  message text not null,
  stack text,
  url text,
  user_agent text,
  count integer not null default 1,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  resolved boolean not null default false
);
alter table public.error_logs enable row level security;
create policy "admins manage errors" on public.error_logs for all to authenticated using (private.is_admin()) with check (private.is_admin());

create or replace function public.log_error(p_source text, p_message text, p_stack text, p_url text, p_ua text, p_key text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare fp text := md5(coalesce(p_source, 'client') || left(coalesce(p_message, ''), 300) || left(split_part(coalesce(p_stack, ''), E'\n', 2), 200)); is_new boolean;
begin
  if not private.rate_ok('er:' || coalesce((select auth.uid())::text, left(p_key, 64), 'anon'), 20, 60) then return; end if;
  insert into public.error_logs (fingerprint, source, message, stack, url, user_agent)
  values (fp, case when p_source = 'server' then 'server' else 'client' end, left(coalesce(p_message, '(no message)'), 1000), left(p_stack, 4000), left(p_url, 500), left(p_ua, 300))
  on conflict (fingerprint) do update set count = public.error_logs.count + 1, last_at = now(), url = excluded.url,
    resolved = false
  returning (xmax = 0) into is_new;
  if is_new then
    insert into public.notifications (user_id, kind, body)
    select a.user_id, 'ops', '🐞 새 오류: ' || left(coalesce(p_message, ''), 120) from public.admins a;
  end if;
end; $$;
grant execute on function public.log_error(text, text, text, text, text, text) to anon, authenticated;


-- ── 0.23-1 예약 품질 목록에 운영자 잠금 상태를 함께 낸다 ──
create or replace function public.admin_store_quality() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'not allowed'; end if;
  return coalesce((select jsonb_agg(x order by (x->>'flagged')::boolean desc, (x->>'rate')::numeric desc nulls last) from (
    select jsonb_build_object(
      'business_id', b.id, 'place_name', b.place_name, 'business', b.business_name, 'status', b.status, 'owner', p.handle,
      'reservations_enabled', b.reservations_enabled, 'admin_note', b.admin_note,
      'lock_reservation_offer', b.lock_reservation_offer, 'lock_reservations', b.lock_reservations,
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
