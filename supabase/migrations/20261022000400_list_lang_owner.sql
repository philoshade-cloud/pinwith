-- 0.56-1 리스트마다 언어를 정한다: 주인이 편집 화면에서 고르고(공동 편집자는 못 바꿈),
-- 새 리스트는 만든 사람의 계정 언어로 시작한다. 공식·예시 리스트도 같은 칸(lists.lang)을 쓴다.
create or replace function private.guard_list_lang() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.lang := coalesce(new.lang, (select lang from public.profiles where id = new.owner_id), 'ko');
  elsif new.lang is distinct from old.lang
        and not private.is_admin() and (select auth.uid()) is not null
        and (select auth.uid()) is distinct from old.owner_id then
    raise exception 'only the owner can change the list language';
  end if;
  return new;
end $$;

-- 지금까지 언어가 비어 있던 사용자 리스트는 만든 사람의 계정 언어로 채운다
update public.lists l set lang = p.lang from public.profiles p where p.id = l.owner_id and l.lang is null;
