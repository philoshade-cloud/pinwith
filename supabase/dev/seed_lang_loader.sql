-- 언어별 공식 계정·예시 계정·예시 리스트를 넣는 도구(데이터 전용, 운영자가 SQL 편집기에서 실행).
-- private.seed_account: 이메일로 계정을 찾거나 만들고 핸들·이름·소개·언어·공식 여부를 맞춘다.
-- private.seed_lang_examples(언어, 핸들 접미사, 문서): 공식 계정 pinwith_<접미사>, 예시 계정 ex_<접미사>1~3,
--   리스트 4개(평범·크리에이터·친구 의논·먹거리)를 넣는다. 같은 주인·주소의 리스트가 있으면 건너뛴다(다시 실행해도 중복 없음).
create or replace function private.seed_account(p_email text, p_handle text, p_name text, p_bio text, p_lang text, p_official boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  uid := (select id from auth.users where email = p_email);
  if uid is null then
    uid := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', p_email, '', now(), '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', p_name), now() - interval '20 days', now(), '', '', '', '');
    insert into auth.identities (user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (uid, uid::text, jsonb_build_object('sub', uid::text, 'email', p_email, 'email_verified', true), 'email', now(), now(), now());
  end if;
  update public.profiles set handle = p_handle, display_name = p_name, bio = coalesce(p_bio, ''), lang = p_lang, is_official = p_official where id = uid;
  return uid;
end $$;

create or replace function private.seed_lang_examples(p_lang text, p_suffix text, doc jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare
  off_uid uuid; ex uuid[] := array[null, null, null]::uuid[]; i int; j int;
  rec jsonb; sec jsonb; it jsonb; cm jsonb; rp jsonb;
  lid uuid; sid uuid; iid uuid; cid uuid; pos int; si int; n int; owner_uid uuid; made int := 0;
begin
  off_uid := private.seed_account('official-' || lower(p_lang) || '@pinwith.me', 'pinwith_' || p_suffix,
    doc->'official'->>'display_name', doc->'official'->>'bio', p_lang, true);
  for i in 1..3 loop
    ex[i] := private.seed_account('example-' || lower(p_lang) || i || '@pinwith.me', 'ex_' || p_suffix || i,
      doc->'samples'->(i - 1)->>'display_name', doc->'samples'->(i - 1)->>'bio', p_lang, false);
  end loop;
  -- 예시 친구 셋은 서로 맞팔로우(공동 편집 조건)
  for i in 1..3 loop for j in 1..3 loop
    if i <> j then insert into public.follows (follower_id, followee_id) values (ex[i], ex[j]) on conflict do nothing; end if;
  end loop; end loop;

  for rec in select * from jsonb_array_elements(doc->'lists') loop
    owner_uid := case rec->>'owner' when 'ex1' then ex[1] else off_uid end;
    continue when exists (select 1 from public.lists where owner_id = owner_uid and slug = rec->>'slug');
    insert into public.lists (owner_id, slug, title, description, visibility, kind, themes, public_comments, is_example, lang)
    values (owner_uid, rec->>'slug', rec->>'title', rec->>'desc', 'public', (rec->>'kind')::public.list_kind,
            array(select jsonb_array_elements_text(rec->'themes')), rec->>'role' = 'friends', true, p_lang)
    returning id into lid;
    if rec->>'role' = 'friends' then
      insert into public.list_editors (list_id, user_id, invited_by, accepted_at) values
        (lid, ex[2], ex[1], now() - interval '6 days'), (lid, ex[3], ex[1], now() - interval '6 days') on conflict do nothing;
    end if;
    pos := 0; si := 0;
    for sec in select * from jsonb_array_elements(rec->'sections') loop
      insert into public.sections (list_id, name, position) values (lid, sec->>'name', si) returning id into sid;
      for it in select * from jsonb_array_elements(sec->'items') loop
        insert into public.places (google_place_id, lat, lng, coords_fetched_at)
        values (it->>'place_id', (it->>'lat')::float8, (it->>'lng')::float8, now()) on conflict (google_place_id) do nothing;
        insert into public.list_items (list_id, section_id, place_id, position, added_by, custom_title, memo, tags)
        values (lid, sid, it->>'place_id', pos,
                case sec->>'by' when 'ex1' then ex[1] when 'ex2' then ex[2] when 'ex3' then ex[3] else off_uid end,
                left(it->>'title', 120), coalesce(it->>'memo', ''), array(select jsonb_array_elements_text(coalesce(it->'tags', '[]'::jsonb))))
        on conflict do nothing;
        pos := pos + 1;
      end loop;
      si := si + 1;
    end loop;
    n := 0;
    for cm in select * from jsonb_array_elements(coalesce(rec->'comments', '[]'::jsonb)) loop
      iid := (select id from public.list_items where list_id = lid and place_id = cm->>'place_id');
      continue when iid is null;
      n := n + 1;
      insert into public.item_comments (item_id, author_id, body, created_at)
      values (iid, ex[(substr(cm->>'by', 3))::int], cm->>'body', now() - interval '5 days' + make_interval(hours => n * 5))
      returning id into cid;
      for rp in select * from jsonb_array_elements(coalesce(cm->'replies', '[]'::jsonb)) loop
        n := n + 1;
        insert into public.item_comments (item_id, author_id, body, parent_id, created_at)
        values (iid, ex[(substr(rp->>'by', 3))::int], rp->>'body', cid, now() - interval '5 days' + make_interval(hours => n * 5));
      end loop;
    end loop;
    made := made + 1;
  end loop;
  return 'pinwith_' || p_suffix || ': ' || made || ' lists';
end $$;
revoke execute on function private.seed_account(text, text, text, text, text, boolean) from public, anon, authenticated;
revoke execute on function private.seed_lang_examples(text, text, jsonb) from public, anon, authenticated;
