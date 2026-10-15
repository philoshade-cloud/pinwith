-- (적용 완료) 좌표 갱신을 '최근 30일 안에 누가 본 리스트'의 장소로만 한정
alter table public.lists add column if not exists last_viewed_at timestamptz;
update public.lists set last_viewed_at = now() where last_viewed_at is null;

create or replace function public.touch_lists(ids uuid[])
returns void language sql security definer set search_path = '' as $$
  update public.lists set last_viewed_at = now()
  where id = any(ids)
    and (last_viewed_at is null or last_viewed_at < now() - interval '12 hours')
    and private.can_view_list(id);
$$;
revoke all on function public.touch_lists(uuid[]) from public;
grant execute on function public.touch_lists(uuid[]) to anon, authenticated;

create or replace function public.places_to_refresh(lim integer)
returns table (google_place_id text) language sql security definer set search_path = '' as $$
  select p.google_place_id from public.places p
  where (p.coords_fetched_at is null or p.coords_fetched_at < now() - interval '25 days')
    and exists (
      select 1 from public.list_items i join public.lists l on l.id = i.list_id
      where i.place_id = p.google_place_id and l.last_viewed_at > now() - interval '30 days'
    )
  order by p.coords_fetched_at nulls first
  limit lim;
$$;
revoke all on function public.places_to_refresh(integer) from public, anon, authenticated;
grant execute on function public.places_to_refresh(integer) to service_role;

create or replace function public.expire_unviewed_coords()
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  update public.places p set lat = null, lng = null
  where p.lat is not null
    and p.coords_fetched_at < now() - interval '30 days'
    and not exists (
      select 1 from public.list_items i join public.lists l on l.id = i.list_id
      where i.place_id = p.google_place_id and l.last_viewed_at > now() - interval '30 days'
    );
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.expire_unviewed_coords() from public, anon, authenticated;
grant execute on function public.expire_unviewed_coords() to service_role;
