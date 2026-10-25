-- 0.66 리스트 반응 기록 되돌리기. 새 동작으로 쌓인 기록은 먼저 지워야 예전 제약을 다시 걸 수 있다.
drop function if exists public.admin_list_events(uuid, integer);
drop function if exists public.admin_list_activity(integer, text);
delete from public.link_events where event not in ('open', 'tap', 'directions', 'google_open', 'naver_open', 'kakao_open');
alter table public.link_events drop constraint if exists link_events_event_check;
alter table public.link_events add constraint link_events_event_check check (event in ('open', 'tap', 'directions', 'google_open', 'naver_open', 'kakao_open'));
alter table public.link_events drop constraint if exists link_events_session_len;
alter table public.link_events drop constraint if exists link_events_meta_size;
alter table public.link_events drop column if exists session_id;
alter table public.link_events drop column if exists meta;
drop index if exists public.link_events_created_idx;
create or replace function private.limit_link_events() returns trigger language plpgsql security definer set search_path = '' as $$
declare k text := coalesce(new.user_id::text, new.device_id);
begin
  if k is not null and not private.rate_ok('ev:' || k, 60, 60) then return null; end if;
  return new;
end; $$;
