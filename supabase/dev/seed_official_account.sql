-- PinWith 공식 계정(@pinwith, official@pinwith.me). 운영팀이 직접 만든 예시·큐레이션 리스트를 올린다.
-- 로그인: 로그인 화면에서 official@pinwith.me로 이메일 링크(Cloudflare Email Routing에 official@ 주소를 만들어 두면 Gmail로 받음).
-- 테스트 데이터 정리(cleanup_test_data.sql)에서 지워지지 않는다.
do $$
declare u uuid := (select id from auth.users where email = 'official@pinwith.me');
begin
  if u is null then
    u := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated', 'official@pinwith.me', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"PinWith"}', now(), now(), '', '', '', '');
    insert into auth.identities (user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (u, u::text, jsonb_build_object('sub', u::text, 'email', 'official@pinwith.me', 'email_verified', true), 'email', now(), now(), now());
  end if;
  update public.profiles set handle = 'pinwith', display_name = 'PinWith', is_official = true,
    avatar_url = 'https://pinwith.me/brand/pinwith-icon-1024.png',
    bio = 'PinWith 운영팀이 직접 다니고 고른 장소 리스트예요. Lists hand-picked by the PinWith team.'
  where id = u;
end $$;

-- 기능 시험용 테스트 계정은 실제 사용자처럼 보이지 않게 '예시 사용자'로 표시한다(출시 전 cleanup_test_data.sql로 삭제).
update public.profiles p set display_name = '예시 사용자 · ' || x.nm, bio = 'PinWith가 기능을 보여 주려고 만든 예시 계정이에요. (Sample account)'
from (values ('seoul_foodie','지수'), ('cafe_hopper','하루'), ('busan_trip','민호'), ('jeju_walk','소연'), ('tokyo_eats','도쿄'), ('newbie_kim','김')) x(h, nm)
where p.handle = x.h;
