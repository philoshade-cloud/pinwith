-- 0.32-1 구글 장소 기능 스위치: 운영자 콘솔에서 끄면 사이트가 구글 장소 기능(장소 카드·검색·좌표 갱신)을 부르지 않는다.
-- 0.32-2 예산 넘으면 자동으로 끄기: PinWith가 센 사용량으로 이번 달 구글 요금(추정)이 예산 이상이 되면 끄고 운영자에게 알린다.
create table if not exists public.app_flags (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_flags enable row level security;
create policy "anyone reads flags" on public.app_flags for select using (true);
create policy "admins change flags" on public.app_flags for update to authenticated using (private.is_admin()) with check (private.is_admin());
insert into public.app_flags (key, value) values ('google_places', '{"enabled": true, "auto_off": true}')
on conflict (key) do nothing;

-- 이번 달 구글 요금 추정(무료 몫을 뺀 금액, 미화)
create or replace function private.google_month_cost() returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(round(greatest(coalesce(u.n, 0) - p.free_per_month, 0) * p.usd_per_1000 / 1000, 2)), 0)
  from public.usage_prices p
  left join (select kind, sum(count) n from public.usage_daily
             where day >= date_trunc('month', now() at time zone 'Asia/Seoul')::date group by kind) u on u.kind = p.kind
  where p.service = 'google';
$$;

-- 켜져 있고 자동 끄기가 켜져 있는데 이번 달 추정 요금이 예산 이상이면 끈다
create or replace function private.google_autostop() returns boolean
language plpgsql security definer set search_path = '' as $$
declare f jsonb; cost numeric; budget numeric;
begin
  select value into f from public.app_flags where key = 'google_places';
  if f is null or not coalesce((f->>'enabled')::boolean, true) or not coalesce((f->>'auto_off')::boolean, true) then return false; end if;
  select monthly_budget_usd into budget from public.service_budgets where service = 'google';
  if coalesce(budget, 0) <= 0 then return false; end if;
  cost := private.google_month_cost();
  if cost < budget then return false; end if;
  update public.app_flags
     set value = value || jsonb_build_object('enabled', false, 'reason', 'budget', 'changed_at', now(), 'cost', cost, 'budget', budget),
         updated_at = now()
   where key = 'google_places';
  insert into public.notifications (user_id, kind, body)
  select a.user_id, 'ops', '⛔ 구글 장소 기능을 자동으로 껐어요: 이번 달 추정 요금 $' || cost || '이 예산 $' || budget
    || '에 닿았어요. 장소 카드·검색이 멈췄어요. 운영자 콘솔 → 서비스 사용량에서 다시 켤 수 있어요.'
  from public.admins a;
  return true;
end; $$;
revoke all on function private.google_autostop() from public, anon, authenticated;

-- 사용량을 셀 때 가끔(구글 항목 기록의 약 2%) 확인해서 매일 작업을 기다리지 않고 멈춘다
create or replace function public.log_usage(p_kind text, p_n integer default 1, p_key text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.usage_prices where kind = p_kind) then return; end if;
  if not private.rate_ok('us:' || coalesce((select auth.uid())::text, left(p_key, 64), 'anon'), 120, 60) then return; end if;
  insert into public.usage_daily (day, kind, count) values ((now() at time zone 'Asia/Seoul')::date, p_kind, greatest(1, least(coalesce(p_n, 1), 20)))
  on conflict (day, kind) do update set count = public.usage_daily.count + excluded.count;
  if random() < 0.02 and exists (select 1 from public.usage_prices where kind = p_kind and service = 'google') then
    perform private.google_autostop();
  end if;
end; $$;

-- 매일 예산 확인에서도 자동 끄기를 먼저 확인한다
create or replace function public.run_budget_check() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u jsonb; g numeric; dbmb numeric; b public.service_budgets; out jsonb := '[]'; msg text; stopped boolean;
begin
  stopped := private.google_autostop();
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
  return jsonb_build_object('google_projected', g, 'google_month', private.google_month_cost(), 'google_stopped', stopped, 'db_mb', dbmb, 'alerts', out);
end; $$;
