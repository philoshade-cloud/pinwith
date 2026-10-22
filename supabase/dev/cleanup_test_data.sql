-- 테스트 계정(test1~9@pinwith.test)과 그 계정이 만든 모든 것(리스트·장소·가게·충전·광고 기록 등)을 지운다.
-- Supabase 대시보드 → SQL Editor에 붙여 넣고 Run. 공식 계정(pinwith*), 예시 계정(ex_*), 본인 계정은 건드리지 않는다.
-- 참고: test7(store_mdkj) 가게의 $1 실제 결제(전액 환불됨) 기록도 DB에서는 함께 사라진다. Stripe 대시보드에는 그대로 남는다.

begin;
delete from auth.users where email like 'test%@pinwith.test';
-- 남은 게 0이면 commit, 아니면 rollback
select count(*) as left_over from auth.users where email like 'test%@pinwith.test';
commit;
