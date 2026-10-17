drop trigger if exists profiles_guard_official on public.profiles;
drop function if exists private.guard_profile_official();
alter table public.profiles drop column if exists is_official;
