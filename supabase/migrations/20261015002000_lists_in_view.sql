-- 0.28-2 지금 지도에 보이는 지역에 핀이 있는 공개 리스트(타인의 핀에서 먼저 보여 주기)
create index if not exists places_latlng_idx on public.places (lat, lng) where lat is not null;

create or replace function public.lists_in_view(p_s double precision, p_w double precision, p_n double precision, p_e double precision, p_limit integer default 30)
returns table (list_id uuid, pins integer)
language sql stable security definer set search_path = '' as $$
  select i.list_id, count(*)::integer as pins
  from public.places p
  join public.list_items i on i.place_id = p.google_place_id
  join public.lists l on l.id = i.list_id
  where l.visibility = 'public'
    and p.lat between least(p_s, p_n) and greatest(p_s, p_n)
    and (case when p_w <= p_e then p.lng between p_w and p_e else (p.lng >= p_w or p.lng <= p_e) end)
    and not private.item_blocked(i.list_id, i.place_id)
  group by i.list_id
  order by pins desc, max(l.like_count) desc
  limit least(greatest(coalesce(p_limit, 30), 1), 60);
$$;
revoke all on function public.lists_in_view(double precision, double precision, double precision, double precision, integer) from public;
grant execute on function public.lists_in_view(double precision, double precision, double precision, double precision, integer) to anon, authenticated;
