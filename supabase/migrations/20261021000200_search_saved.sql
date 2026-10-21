-- 0.49-1 저장한 핀 검색: 위쪽 검색창에 글자를 치면 구글 결과 위에 '내 핀에서' 결과를 함께 보여 준다.
-- 범위(p_scopes): mine = 내 리스트(공동 편집 포함), following = 팔로우하는 사람의 공개 리스트, liked = 좋아요한 리스트.
-- 검색 대상: 장소 이름·메모·태그·섹션 이름(장소 결과), 리스트 이름(리스트 결과). 남의 리스트는 볼 수 있는 것만.
create or replace function public.search_saved(p_q text, p_scopes text[] default array['mine', 'following', 'liked'], p_limit int default 40)
returns table (
  kind text, scope text, list_id uuid, list_title text, slug text, owner_handle text, owner_name text,
  item_id uuid, place_id text, item_title text, memo text, tags text[], section_name text, lat float8, lng float8, matched text
)
language sql stable security definer set search_path = '' as $$
  with me as (select (select auth.uid()) as id),
  term as (
    select '%' || replace(replace(replace(trim(coalesce(p_q, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pat
  ),
  scoped as (
    select l.id, l.title, l.slug, l.owner_id, 'mine'::text as scope
    from public.lists l, me
    where 'mine' = any(p_scopes)
      and (l.owner_id = me.id or exists (select 1 from public.list_editors e where e.list_id = l.id and e.user_id = me.id and e.accepted_at is not null))
    union all
    select l.id, l.title, l.slug, l.owner_id, 'following'
    from public.lists l join public.follows f on f.followee_id = l.owner_id, me
    where 'following' = any(p_scopes) and f.follower_id = me.id and l.visibility = 'public'
    union all
    select l.id, l.title, l.slug, l.owner_id, 'liked'
    from public.lists l join public.list_likes k on k.list_id = l.id, me
    where 'liked' = any(p_scopes) and k.user_id = me.id and l.visibility in ('public', 'unlisted') and l.owner_id <> me.id
  ),
  lists_in as (
    select distinct on (s.id) s.*, pr.handle, pr.display_name
    from scoped s join public.profiles pr on pr.id = s.owner_id
    order by s.id, case s.scope when 'mine' then 0 when 'liked' then 1 else 2 end
  ),
  list_hits as (
    select 'list'::text as kind, li.scope, li.id as list_id, li.title as list_title, li.slug, li.handle as owner_handle, li.display_name as owner_name,
           null::uuid as item_id, null::text as place_id, null::text as item_title, null::text as memo, null::text[] as tags, null::text as section_name,
           null::float8 as lat, null::float8 as lng, 'list'::text as matched, 0 as rank
    from lists_in li, term
    where li.title ilike term.pat
    limit 10
  ),
  place_hits as (
    select 'place'::text, li.scope, li.id, li.title, li.slug, li.handle, li.display_name,
           i.id, i.place_id, i.custom_title, left(i.memo, 200), i.tags, sec.name, p.lat, p.lng,
           case when i.custom_title ilike term.pat then 'title'
                when array_to_string(i.tags, ' ') ilike term.pat then 'tag'
                when sec.name ilike term.pat then 'section'
                else 'memo' end,
           case when i.custom_title ilike term.pat then 1
                when array_to_string(i.tags, ' ') ilike term.pat then 2
                when sec.name ilike term.pat then 3
                else 4 end
    from lists_in li
    join public.list_items i on i.list_id = li.id
    left join public.sections sec on sec.id = i.section_id
    left join public.places p on p.google_place_id = i.place_id,
    term
    where i.custom_title ilike term.pat or i.memo ilike term.pat
       or array_to_string(i.tags, ' ') ilike term.pat or sec.name ilike term.pat
  )
  select kind, scope, list_id, list_title, slug, owner_handle, owner_name, item_id, place_id, item_title, memo, tags, section_name, lat, lng, matched
  from (
    select * from list_hits
    union all
    (select * from place_hits
     order by 17, case scope when 'mine' then 0 when 'liked' then 1 else 2 end, 10
     limit greatest(1, least(coalesce(p_limit, 40), 100)))
  ) r
  where (select id from me) is not null and char_length(trim(coalesce(p_q, ''))) >= 1
  order by rank, case scope when 'mine' then 0 when 'liked' then 1 else 2 end;
$$;
revoke execute on function public.search_saved(text, text[], int) from public, anon;
grant execute on function public.search_saved(text, text[], int) to authenticated;
