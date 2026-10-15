-- 0.24-1 댓글 전체 공개 리스트(운영자만 지정): 예시 리스트처럼 댓글 논의 자체를 보여 줄 리스트는
-- 로그인하지 않은 사람을 포함해 누구나 댓글을 볼 수 있다(주인이 숨긴 댓글은 제외). 지금은 '부산 1박 2일, 셋이 짠 세 가지 루트'만.
alter table public.lists add column if not exists public_comments boolean not null default false;

-- 주인·편집자는 이 값을 바꿀 수 없다(운영자만)
create or replace function private.guard_public_comments() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if private.is_admin() or (select auth.uid()) is null then return new; end if;
  if tg_op = 'INSERT' then
    new.public_comments := false;
  elsif new.public_comments is distinct from old.public_comments then
    raise exception 'not allowed';
  end if;
  return new;
end; $$;
create trigger lists_guard_public_comments before insert or update on public.lists
  for each row execute function private.guard_public_comments();

create policy "public comments on open lists" on public.item_comments for select to anon, authenticated
  using (
    not hidden_by_owner
    and exists (select 1 from public.list_items i join public.lists l on l.id = i.list_id
                where i.id = item_id and l.public_comments and l.visibility = 'public')
  );

update public.lists set public_comments = true where slug = 'busan-3-routes';
