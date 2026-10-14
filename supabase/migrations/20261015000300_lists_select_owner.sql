-- 새 리스트 insert ... returning 이 실패하던 문제:
-- can_view_list()는 별도 쿼리로 lists를 다시 읽는데, 같은 문장에서 막 넣은 행은 보이지 않는다.
-- 주인 판단은 행의 owner_id로 직접 한다.
alter policy "view visible lists" on public.lists
  using (
    visibility in ('public', 'unlisted')
    or owner_id = (select auth.uid())
    or private.can_edit_list(id)
  );
