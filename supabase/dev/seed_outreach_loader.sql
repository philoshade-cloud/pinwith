-- 접근대상(크리에이터·블로그·숙소·커뮤니티)에게 보낼 예시 리스트를 넣는 도구(데이터 전용).
-- private.seed_outreach_list(문서): 언어별 공식 계정(owner 핸들) 아래에 '링크 있는 사람만'(unlisted) 리스트 하나를 만든다.
--   같은 주인·주소의 리스트가 있으면 건너뛴다(다시 실행해도 중복 없음). 상대가 받아들이면 그 계정으로 넘겨 준다.
-- 문서 모양: {owner, lang, slug, title, desc, kind, themes[], sections:[{name|null, items:[{place_id, lat, lng, title, memo, ts_url}]}]}
create or replace function private.seed_outreach_list(doc jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare off_uid uuid; lid uuid; sid uuid; sec jsonb; it jsonb; pos int := 0; si int := 0;
begin
  off_uid := (select id from public.profiles where handle = doc->>'owner');
  if off_uid is null then return 'no owner ' || (doc->>'owner'); end if;
  if exists (select 1 from public.lists where owner_id = off_uid and slug = doc->>'slug') then
    return 'skip ' || (doc->>'slug');
  end if;
  insert into public.lists (owner_id, slug, title, description, visibility, kind, themes, lang)
  values (off_uid, doc->>'slug', doc->>'title', coalesce(doc->>'desc', ''), 'unlisted', (doc->>'kind')::public.list_kind,
          array(select jsonb_array_elements_text(coalesce(doc->'themes', '[]'::jsonb))), doc->>'lang')
  returning id into lid;
  for sec in select * from jsonb_array_elements(doc->'sections') loop
    sid := null;
    if coalesce(sec->>'name', '') <> '' then
      insert into public.sections (list_id, name, position) values (lid, sec->>'name', si) returning id into sid;
      si := si + 1;
    end if;
    for it in select * from jsonb_array_elements(sec->'items') loop
      insert into public.places (google_place_id, lat, lng, coords_fetched_at)
      values (it->>'place_id', (it->>'lat')::float8, (it->>'lng')::float8, now()) on conflict (google_place_id) do nothing;
      -- 같은 장소가 한 리스트에 두 번 들어가지 않게
      continue when exists (select 1 from public.list_items where list_id = lid and place_id = it->>'place_id');
      insert into public.list_items (list_id, section_id, place_id, position, added_by, custom_title, memo, video_ts_url)
      values (lid, sid, it->>'place_id', pos, off_uid, left(it->>'title', 120), coalesce(it->>'memo', ''), nullif(it->>'ts_url', ''));
      pos := pos + 1;
    end loop;
  end loop;
  return 'made ' || (doc->>'slug') || ' (' || pos || ')';
end $$;
revoke execute on function private.seed_outreach_list(jsonb) from public, anon, authenticated;
