-- v0.28(0.28-2) DB 되돌리기. Supabase SQL Editor에서 실행한다.
drop function if exists public.lists_in_view(double precision, double precision, double precision, double precision, integer);
drop index if exists public.places_latlng_idx;
