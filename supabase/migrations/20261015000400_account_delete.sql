-- SQL Editor에서 직접 실행 필요(도구에서는 삭제 문이 들어간 SQL이 막힘).
-- 1) 본인 계정 삭제(개인정보 삭제 요청). 프로필·리스트·팔로우 등은 on delete cascade로 함께 지워진다.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- 2) 테스트 데이터용 임시 표 정리(이미 비공개로 막아 둠)
drop table if exists public.dev_seed;
