-- 0.57-1 운영자 계정은 PinWith 공식 계정(is_official)의 공개 리스트를 항상 모두 좋아요한다.
-- 공식 리스트가 새로 공개될 때·운영자가 생길 때 바로 넣고, 매일 자동 작업에서 다시 맞춘다(운영자가 좋아요를 취소해도 다음 날 되돌아옴).
create or replace function private.like_official_for_admins(p_list uuid default null) returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  insert into public.list_likes (user_id, list_id)
  select a.user_id, l.id
  from public.admins a
  cross join public.lists l
  join public.profiles p on p.id = l.owner_id
  where p.is_official and l.visibility = 'public' and (p_list is null or l.id = p_list)
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function private.on_official_list_public() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.visibility = 'public' and exists (select 1 from public.profiles where id = new.owner_id and is_official) then
    perform private.like_official_for_admins(new.id);
  end if;
  return null;
end $$;
create or replace trigger lists_like_official after insert or update of visibility on public.lists
  for each row execute function private.on_official_list_public();

create or replace function private.on_admin_added() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.like_official_for_admins(null);
  return null;
end $$;
create or replace trigger admins_like_official after insert on public.admins
  for each row execute function private.on_admin_added();

-- 매일 자동 작업(/api/cron)에서 부른다
create or replace function public.sync_admin_official_likes() returns integer
language sql security definer set search_path = '' as $$ select private.like_official_for_admins(null); $$;
revoke execute on function public.sync_admin_official_likes() from public, anon, authenticated;
grant execute on function public.sync_admin_official_likes() to service_role;

select private.like_official_for_admins(null);
