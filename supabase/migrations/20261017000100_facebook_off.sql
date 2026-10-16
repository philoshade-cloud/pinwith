-- 0.37-2 Facebook 로그인은 Meta 비즈니스 인증 전까지 숨김(사용자 결정 2026-10-17).
update public.app_flags set value = value || '{"facebook": false}', updated_at = now() where key = 'login';
