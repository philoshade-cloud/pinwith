-- 0.54-1 되돌리기
drop trigger if exists lists_guard_lang on public.lists;
drop function if exists private.guard_list_lang();
alter table public.lists drop column if exists lang;
