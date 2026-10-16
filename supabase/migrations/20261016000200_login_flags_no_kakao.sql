-- 0.36-1 카카오 로그인은 하지 않기로 함(사용자 결정 2026-10-16): 스위치에서 뺀다.
update public.app_flags set value = value - 'kakao', updated_at = now() where key = 'login';
