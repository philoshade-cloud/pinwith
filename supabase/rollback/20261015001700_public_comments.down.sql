-- v0.24(0.24-1) DB 되돌리기. Supabase SQL Editor에서 실행한다.
drop policy if exists "public comments on open lists" on public.item_comments;
drop trigger if exists lists_guard_public_comments on public.lists;
drop function if exists private.guard_public_comments();
alter table public.lists drop column if exists public_comments;
