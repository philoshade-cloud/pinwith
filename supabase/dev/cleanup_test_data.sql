-- 출시 전에 SQL Editor에서 실행: 임시 표와 테스트 계정(test1~6@pinwith.test)을 지운다.
-- 테스트 계정의 리스트·장소·팔로우·좋아요는 계정과 함께 지워진다(on delete cascade).
-- 함께 할 일: Vercel 환경 변수 NEXT_PUBLIC_TEST_LOGIN=false (로그인 화면의 test1 바로 로그인 끄기)
-- (임시 표 dev_seed는 20261015000400 마이그레이션에서 지움)
delete from auth.users where email like 'test%@pinwith.test';
