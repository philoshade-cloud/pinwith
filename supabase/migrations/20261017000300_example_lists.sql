-- 0.42-1 예시 리스트 표시: 운영팀이 만든 예시(공식 계정·예시 계정) 리스트에 '예시' 표시.
-- 로그인 전 화면에 언어별로 보여 줄 예시 3개(평범한 것·크리에이터 스타일·친구들이 의논한 것)는 app_flags.examples에 둔다.
alter table public.lists add column if not exists is_example boolean not null default false;

create or replace function private.guard_list_example() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- 로그인한 일반 사용자는 예시 표시를 바꿀 수 없다(운영자·SQL 편집기만)
  if (select auth.uid()) is not null and not private.is_admin() then
    if tg_op = 'INSERT' then new.is_example := false;
    elsif new.is_example is distinct from old.is_example then new.is_example := old.is_example;
    end if;
  end if;
  return new;
end; $$;
create or replace trigger lists_guard_example before insert or update on public.lists
  for each row execute function private.guard_list_example();

insert into public.app_flags (key, value) values ('examples', '{"ko": [], "en": []}') on conflict (key) do nothing;
