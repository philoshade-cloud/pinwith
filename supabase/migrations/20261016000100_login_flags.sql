-- 0.35-2 로그인 방식 스위치: Apple·Facebook·카카오 로그인 버튼을 운영자 콘솔에서 켜고 끈다(Supabase에 설정을 마친 뒤 켠다).
insert into public.app_flags (key, value) values ('login', '{"apple": false, "facebook": false, "kakao": false}')
on conflict (key) do nothing;
