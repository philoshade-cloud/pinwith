-- (적용 완료) 큐레이터 통계: 내 리스트의 링크 반응을 기간별로 모아 한 번에 돌려준다.
-- security invoker: link_events·short_links의 RLS(편집자만 조회)가 그대로 적용된다.
create or replace function public.my_stats(days integer default 30)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with mine as (
    select id, title, slug from public.lists where owner_id = auth.uid()
  ),
  ev as (
    select e.* from public.link_events e
    join mine m on m.id = e.list_id
    where e.created_at > now() - make_interval(days => greatest(1, least(days, 365)))
  )
  select jsonb_build_object(
    'totals', (select jsonb_build_object(
        'open', count(*) filter (where event = 'open'),
        'tap', count(*) filter (where event = 'tap'),
        'directions', count(*) filter (where event = 'directions'),
        'google', count(*) filter (where event = 'google_open'),
        'naver', count(*) filter (where event = 'naver_open'),
        'kakao', count(*) filter (where event = 'kakao_open'),
        'onsite', count(*) filter (where in_radius),
        'devices', count(distinct device_id) filter (where event = 'open')
      ) from ev),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('d', d, 'open', o, 'act', a) order by d) from (
        select (created_at at time zone 'Asia/Seoul')::date as d,
               count(*) filter (where event = 'open') as o,
               count(*) filter (where event in ('directions','google_open','naver_open','kakao_open')) as a
        from ev group by 1) t), '[]'::jsonb),
    'lists', coalesce((select jsonb_agg(jsonb_build_object(
        'id', m.id, 'title', m.title, 'slug', m.slug,
        'open', coalesce(s.o, 0), 'tap', coalesce(s.t, 0), 'act', coalesce(s.a, 0), 'onsite', coalesce(s.r, 0)
      ) order by coalesce(s.o, 0) desc, m.title) from mine m left join (
        select list_id,
               count(*) filter (where event = 'open') o,
               count(*) filter (where event = 'tap') t,
               count(*) filter (where event in ('directions','google_open','naver_open','kakao_open')) a,
               count(*) filter (where in_radius) r
        from ev group by list_id) s on s.list_id = m.id), '[]'::jsonb),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
        'id', i.id, 'title', i.custom_title, 'list', i.list_id,
        'tap', s.t, 'act', s.a, 'onsite', s.r
      ) order by s.a desc, s.t desc) from (
        select item_id,
               count(*) filter (where event = 'tap') t,
               count(*) filter (where event in ('directions','google_open','naver_open','kakao_open')) a,
               count(*) filter (where in_radius) r
        from ev where item_id is not null group by item_id) s
        join public.list_items i on i.id = s.item_id), '[]'::jsonb),
    'links', coalesce((select jsonb_agg(jsonb_build_object(
        'code', sl.code, 'label', sl.channel_label, 'list', sl.target_list_id,
        'open', (select count(*) from ev where ev.code = sl.code and ev.event = 'open')
      ) order by sl.created_at desc) from public.short_links sl
        where sl.owner_id = auth.uid()), '[]'::jsonb),
    'referrers', coalesce((select jsonb_agg(jsonb_build_object('host', host, 'open', n) order by n desc) from (
        select coalesce(nullif(substring(referrer from '^[a-z]+://([^/:?#]+)'), ''), '직접·앱') as host, count(*) n
        from ev where event = 'open' group by 1 order by 2 desc limit 8) t), '[]'::jsonb)
  );
$$;
grant execute on function public.my_stats(integer) to authenticated;
