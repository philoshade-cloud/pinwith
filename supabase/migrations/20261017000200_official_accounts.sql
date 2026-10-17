-- 0.41-1 PinWith 공식 계정 표시: 운영팀이 직접 올리는 리스트임을 화면에 밝힌다(가짜 사용자처럼 보이지 않게).
-- 운영자(또는 DB 직접)만 켤 수 있다. 본인이 프로필을 고쳐도 바뀌지 않는다.
alter table public.profiles add column if not exists is_official boolean not null default false;

create or replace function private.guard_profile_official() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- 로그인한 일반 사용자는 공식 표시를 켜거나 끌 수 없다(SQL 편집기·서비스 키는 auth.uid()가 없음)
  if (select auth.uid()) is not null and not private.is_admin() then
    if tg_op = 'INSERT' then new.is_official := false;
    elsif new.is_official is distinct from old.is_official then new.is_official := old.is_official;
    end if;
  end if;
  return new;
end; $$;
create or replace trigger profiles_guard_official before insert or update on public.profiles
  for each row execute function private.guard_profile_official();
