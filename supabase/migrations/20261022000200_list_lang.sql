-- 0.54-1 공식·예시 리스트의 언어(lists.lang). '타인의 핀' 목록은 화면 언어와 같은 언어의 공식·예시 리스트만 보여 준다.
-- 사용자 리스트는 비워 둔다(어느 언어에서나 보임). 운영자만 정할 수 있다.
alter table public.lists add column if not exists lang text
  check (lang is null or lang in ('ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'pt', 'fr', 'de', 'it', 'ru', 'ar', 'hi', 'tr', 'th', 'vi', 'id'));

create or replace function private.guard_list_lang() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if private.is_admin() or (select auth.uid()) is null then return new; end if;
  if tg_op = 'INSERT' then
    new.lang := null;
  elsif new.lang is distinct from old.lang then
    raise exception 'not allowed';
  end if;
  return new;
end $$;
create or replace trigger lists_guard_lang before insert or update on public.lists
  for each row execute function private.guard_list_lang();
