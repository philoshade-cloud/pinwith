drop trigger if exists lists_guard_example on public.lists;
drop function if exists private.guard_list_example();
alter table public.lists drop column if exists is_example;
delete from public.app_flags where key = 'examples';
