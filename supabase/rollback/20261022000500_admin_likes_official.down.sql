-- 0.57-1 되돌리기: 자동 좋아요를 멈춘다(이미 넣은 좋아요는 남겨 둔다)
drop trigger if exists lists_like_official on public.lists;
drop trigger if exists admins_like_official on public.admins;
drop function if exists public.sync_admin_official_likes();
drop function if exists private.on_official_list_public();
drop function if exists private.on_admin_added();
drop function if exists private.like_official_for_admins(uuid);
