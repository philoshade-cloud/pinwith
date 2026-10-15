-- v0.17 프로필 사진, 리스트 통째로 담기
-- 되돌리기: supabase/rollback/20261015001000_avatars_copy_list.down.sql

-- ── 0.17-1 프로필 사진: 공개 버킷 avatars, 각자 자기 폴더(<user id>/)에만 올리고 지울 수 있다 ──
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "avatar upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatar read own folder" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatar remove own folder" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ── 0.17-2 리스트 통째로 담기: 볼 수 있는 남의 리스트를 '나만 보기' 새 리스트로 복사(섹션·메모·태그·영상 포함, 원본 표시) ──
create or replace function public.copy_list(p_list uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  src public.lists;
  new_id uuid;
  sid uuid;
  s record;
  map jsonb := '{}';
begin
  if me is null then raise exception 'not signed in'; end if;
  select * into src from public.lists where id = p_list;
  if src.id is null or not private.can_view_list(p_list) then raise exception 'not found'; end if;
  if src.owner_id = me then raise exception 'own list'; end if;
  if (select count(*) from public.lists where owner_id = me) >= 200 then raise exception 'too many lists'; end if;

  insert into public.lists (owner_id, slug, title, description, kind, themes, region_ids, visibility, copied_from_list_id)
  values (me, 'copy-' || substr(md5(random()::text), 1, 8), src.title, src.description, src.kind, src.themes, src.region_ids,
          'private', src.id)
  returning id into new_id;

  for s in select id, name, position from public.sections where list_id = src.id order by position loop
    insert into public.sections (list_id, name, position) values (new_id, s.name, s.position) returning id into sid;
    map := map || jsonb_build_object(s.id::text, sid);
  end loop;

  insert into public.list_items (list_id, section_id, place_id, position, added_by, copied_from_item_id, custom_title, memo, video_ts_url, tags)
  select new_id, (map ->> i.section_id::text)::uuid, i.place_id, i.position, me, i.id, i.custom_title, i.memo, i.video_ts_url, i.tags
  from public.list_items i where i.list_id = src.id
  order by i.position
  limit 300;

  return new_id;
end; $$;
revoke all on function public.copy_list(uuid) from public, anon;
grant execute on function public.copy_list(uuid) to authenticated;
