-- 0.49-1 되돌리기: 저장한 핀 검색 함수 제거
drop function if exists public.search_saved(text, text[], int);
