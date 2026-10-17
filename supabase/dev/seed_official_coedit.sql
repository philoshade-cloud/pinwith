-- 공동 편집·댓글 예시: 예시 계정(busan_trip 등)이 만든 부산 루트 리스트를 PinWith 공식 계정 리스트로 옮겨 싣는다.
-- 섹션·장소·댓글(대댓글 포함)을 그대로 복사한다(담은 사람은 공식 계정으로: 테스트 계정 삭제를 막지 않게)(편집자 초대는 맞팔로우가 필요해 복사하지 않음). 테스트 계정을 지우면 댓글도 함께 사라진다.
-- 그 다음, 예시 계정들의 공개 리스트는 '나만 보기'로 바꿔 공개 화면에는 공식 계정 리스트만 남긴다(기능 시험용으로는 그대로 남음).
do $seed$
declare
  o uuid := (select id from public.profiles where handle = 'pinwith');
  src uuid := (select l.id from public.lists l join public.profiles p on p.id = l.owner_id where p.handle = 'busan_trip' and l.slug = 'busan-3-routes');
  lid uuid;
begin
  if src is null or exists (select 1 from public.lists where owner_id = o and slug = 'busan-3-routes') then return; end if;
  insert into public.lists (owner_id, slug, title, description, visibility, kind, themes, public_comments, copied_from_list_id)
  values (o, 'busan-3-routes', '부산 1박 2일, 세 가지 루트 (공동 편집·댓글 예시)',
    E'PinWith의 공동 편집과 댓글을 보여 주는 예시예요. 예시 계정 세 명이 바다·시장·골목 취향대로 루트를 하나씩 짜고(섹션), 장소마다 댓글로 동선을 정했어요.\n섹션을 눌러 루트별로 보고, 장소의 댓글을 열어 대화를 확인해 보세요.',
    'public', 'course', array['부산','여행','공동편집','예시'], true, src)
  returning id into lid;

  create temp table _sec on commit drop as select id as old_id, gen_random_uuid() as new_id, name, position from public.sections where list_id = src;
  insert into public.sections (id, list_id, name, position) select new_id, lid, name, position from _sec;

  create temp table _item on commit drop as select i.*, gen_random_uuid() as new_id from public.list_items i where i.list_id = src;
  insert into public.list_items (id, list_id, section_id, place_id, position, added_by, custom_title, memo, tags, copied_from_item_id)
  select it.new_id, lid, s.new_id, it.place_id, it.position, o, it.custom_title, it.memo, it.tags, it.id
  from _item it left join _sec s on s.old_id = it.section_id;

  create temp table _cm on commit drop as
    select c.*, gen_random_uuid() as new_id from public.item_comments c join _item it on it.id = c.item_id;
  insert into public.item_comments (id, item_id, author_id, body, created_at, parent_id)
  select c.new_id, it.new_id, c.author_id, c.body, c.created_at, null from _cm c join _item it on it.id = c.item_id where c.parent_id is null;
  insert into public.item_comments (id, item_id, author_id, body, created_at, parent_id)
  select c.new_id, it.new_id, c.author_id, c.body, c.created_at, p.new_id from _cm c join _item it on it.id = c.item_id join _cm p on p.id = c.parent_id;
end $seed$;

-- 예시 계정의 공개 리스트를 '나만 보기'로(주인만 공개 범위를 바꿀 수 있어서 주인으로 실행)
do $hide$
declare r record;
begin
  for r in select l.id, l.owner_id from public.lists l join public.profiles p on p.id = l.owner_id
           where p.handle in ('busan_trip','cafe_hopper','jeju_walk','seoul_foodie','tokyo_eats','newbie_kim') and l.visibility <> 'private' loop
    perform set_config('request.jwt.claims', json_build_object('sub', r.owner_id, 'role', 'authenticated')::text, true);
    update public.lists set visibility = 'private' where id = r.id;
  end loop;
  perform set_config('request.jwt.claims', '', true);
end $hide$;
