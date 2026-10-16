update public.app_flags set value = value || '{"kakao": false}' where key = 'login';
