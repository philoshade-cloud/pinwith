-- 0.66 리스트 반응 기록: 더 많은 동작, 방문(탭) 단위 묶음, 나라, 머문 시간.
-- 운영자 콘솔 '리스트 반응' 탭이 읽는다. 리스트 주인과 운영자 본인의 기록은 집계에서 뺀다.

alter table public.link_events add column if not exists session_id text;
alter table public.link_events add column if not exists meta jsonb;

alter table public.link_events drop constraint if exists link_events_event_check;
alter table public.link_events add constraint link_events_event_check check (event in (
  'open', 'tap', 'directions', 'google_open', 'naver_open', 'kakao_open',
  'view', 'leave', 'video', 'share', 'like', 'follow', 'save_place', 'section', 'sort_near'
));
alter table public.link_events add constraint link_events_session_len check (session_id is null or length(session_id) <= 64);
alter table public.link_events add constraint link_events_meta_size check (meta is null or pg_column_size(meta) <= 1024);

create index if not exists link_events_created_idx on public.link_events (created_at);

-- 같은 사람·기기·방문(탭)이 1분에 60번 넘게 보내면 조용히 버린다
create or replace function private.limit_link_events() returns trigger language plpgsql security definer set search_path = '' as $$
declare k text := coalesce(new.user_id::text, new.device_id, new.session_id);
begin
  if k is not null and not private.rate_ok('ev:' || k, 60, 60) then return null; end if;
  return new;
end; $$;

-- 리스트별 요약. p_scope: 'outreach'(공식 계정의 링크 전용 리스트) | 'all'
create or replace function public.admin_list_activity(p_days integer default 30, p_scope text default 'outreach')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'not allowed'; end if;
  return coalesce((
    with target as (
      select l.id, l.title, l.slug, l.visibility, l.owner_id, p.handle
      from public.lists l join public.profiles p on p.id = l.owner_id
      where p_scope = 'all' or (l.visibility = 'unlisted' and p.is_official)
    ),
    ev as (
      select e.* from public.link_events e
      join target t on t.id = e.list_id
      where e.created_at > now() - make_interval(days => greatest(1, least(p_days, 365)))
        and (e.user_id is null or (e.user_id <> t.owner_id and not exists (select 1 from public.admins a where a.user_id = e.user_id)))
    ),
    agg as (
      select list_id,
        count(*) filter (where event = 'view') views,
        count(distinct coalesce(session_id, id::text)) filter (where event in ('view', 'open')) visits,
        count(distinct device_id) filter (where device_id is not null) devices,
        count(distinct user_id) filter (where user_id is not null) members,
        count(*) filter (where event = 'tap') taps,
        count(*) filter (where event in ('directions', 'google_open', 'naver_open', 'kakao_open')) maps,
        count(*) filter (where event = 'video') videos,
        count(*) filter (where event = 'section') sections,
        count(*) filter (where event = 'share') shares,
        count(*) filter (where event = 'like') likes,
        count(*) filter (where event = 'follow') follows,
        count(*) filter (where event = 'save_place') saves,
        -- 방문(탭) 하나에서 화면을 보던 시간을 모두 더한 뒤 평균
        (select round(avg(s)) from (
           select sum(least((e4.meta->>'sec')::numeric, 3600)) s from ev e4
           where e4.list_id = ev.list_id and e4.event = 'leave' and e4.meta ? 'sec'
           group by coalesce(e4.session_id, e4.id::text)) z) avg_sec,
        min(created_at) first_at, max(created_at) last_at,
        (select string_agg(c, ' ' order by n desc) from (
           select e2.country c, count(*) n from ev e2 where e2.list_id = ev.list_id and e2.country is not null group by 1 order by 2 desc limit 3) x) countries,
        (select string_agg(h, ' ' order by n desc) from (
           select coalesce(nullif(substring(e3.referrer from '^[a-z]+://([^/:?#]+)'), ''), 'direct') h, count(*) n
           from ev e3 where e3.list_id = ev.list_id and e3.event = 'view' group by 1 order by 2 desc limit 3) y) refs
      from ev group by list_id
    )
    select jsonb_agg(jsonb_build_object(
      'id', t.id, 'title', t.title, 'slug', t.slug, 'handle', t.handle, 'visibility', t.visibility,
      'views', coalesce(a.views, 0), 'visits', coalesce(a.visits, 0), 'devices', coalesce(a.devices, 0), 'members', coalesce(a.members, 0),
      'taps', coalesce(a.taps, 0), 'maps', coalesce(a.maps, 0), 'videos', coalesce(a.videos, 0), 'sections', coalesce(a.sections, 0),
      'shares', coalesce(a.shares, 0), 'likes', coalesce(a.likes, 0), 'follows', coalesce(a.follows, 0), 'saves', coalesce(a.saves, 0),
      'avg_sec', a.avg_sec, 'first_at', a.first_at, 'last_at', a.last_at, 'countries', a.countries, 'refs', a.refs
    ) order by a.last_at desc nulls last, t.title)
    from target t left join agg a on a.list_id = t.id
    where p_scope = 'outreach' or a.list_id is not null
  ), '[]'::jsonb);
end; $$;
revoke all on function public.admin_list_activity(integer, text) from public, anon;
grant execute on function public.admin_list_activity(integer, text) to authenticated;

-- 한 리스트의 기록을 시간순으로(최근 500개)
create or replace function public.admin_list_events(p_list uuid, p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'not allowed'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'at', e.created_at, 'event', e.event, 'session', left(e.session_id, 8), 'device', left(e.device_id, 8),
      'member', e.user_id is not null, 'country', e.country, 'meta', e.meta,
      'place', i.custom_title,
      'ref', nullif(substring(e.referrer from '^[a-z]+://([^/:?#]+)'), '')
    ) order by e.created_at desc)
    from (
      select e.* from public.link_events e join public.lists l on l.id = e.list_id
      where e.list_id = p_list
        and e.created_at > now() - make_interval(days => greatest(1, least(p_days, 365)))
        and (e.user_id is null or (e.user_id <> l.owner_id and not exists (select 1 from public.admins a where a.user_id = e.user_id)))
      order by e.created_at desc limit 500
    ) e left join public.list_items i on i.id = e.item_id
  ), '[]'::jsonb);
end; $$;
revoke all on function public.admin_list_events(uuid, integer) from public, anon;
grant execute on function public.admin_list_events(uuid, integer) to authenticated;
