-- 0.56-1 되돌리기: 언어는 다시 운영자만 정하고, 새 리스트는 비워 둔다(채워 넣은 값은 그대로 둠)
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
