-- 보안 점검 2단계: 권한 회수와 sections 정책 분리.
-- 도구 승인 단계에서 막혀 Supabase 대시보드 SQL Editor에서 직접 실행한다.

-- 트리거 함수는 API로 직접 부를 수 없게
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.sync_like_count() from public, anon, authenticated;
revoke execute on function public.check_editor_invite() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;

-- 댓글 숨기기는 로그인한 리스트 주인만 쓰는 RPC
revoke execute on function public.set_comment_hidden(uuid, boolean) from public, anon;
grant execute on function public.set_comment_hidden(uuid, boolean) to authenticated;

-- sections: 같은 동작에 정책이 겹치지 않게 'for all'을 쪼갠다
drop policy "editors manage sections" on public.sections;
create policy "editors add sections" on public.sections for insert to authenticated
  with check (private.can_edit_list(list_id));
create policy "editors update sections" on public.sections for update to authenticated
  using (private.can_edit_list(list_id)) with check (private.can_edit_list(list_id));
create policy "editors delete sections" on public.sections for delete to authenticated
  using (private.can_edit_list(list_id));

