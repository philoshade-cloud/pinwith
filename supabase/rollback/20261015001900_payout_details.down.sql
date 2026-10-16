-- v0.26(0.26-1, 0.26-2) DB 되돌리기. Supabase SQL Editor에서 실행한다.
drop function if exists public.my_deletion_check();
alter table public.payout_profiles drop column if exists holder_name_latin, drop column if exists birth_date, drop column if exists phone;
