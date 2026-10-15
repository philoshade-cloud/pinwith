-- v0.17 DB 되돌리기. Supabase SQL Editor에서 실행한다.
-- 0.17-2 (이미 복사된 리스트는 그대로 남는다)
drop function if exists public.copy_list(uuid);
-- 0.17-1 (올린 사진 파일은 Storage → avatars에서 직접 지운다. 버킷은 비운 뒤 지울 수 있다)
drop policy if exists "avatar upload own folder" on storage.objects;
drop policy if exists "avatar read own folder" on storage.objects;
drop policy if exists "avatar remove own folder" on storage.objects;
update public.profiles set avatar_url = null where avatar_url like '%/storage/v1/object/public/avatars/%';
