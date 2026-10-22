-- 테스트 계정(test1~9@pinwith.test)과 그 계정이 만든 모든 것(리스트·장소·가게·충전·광고 기록 등)을 지운다.
-- Supabase 대시보드 → SQL Editor에 붙여 넣고 Run. 공식 계정(pinwith*), 예시 계정(ex_*), 본인 계정은 건드리지 않는다.
-- 참고: test7(store_mdkj) 가게의 $1 실제 결제(전액 환불됨) 기록도 DB에서는 함께 사라진다. Stripe 대시보드에는 그대로 남는다.
-- 공동 편집 초대(list_editors.invited_by)와 담은 사람(list_items.added_by)은 계정을 지울 때 자동으로 안 지워져서 먼저 지운다(10-22 오류 23503).

begin;
delete from public.list_editors
 where invited_by in (select id from auth.users where email like 'test%@pinwith.test')
    or user_id in (select id from auth.users where email like 'test%@pinwith.test');
delete from public.lists
 where owner_id in (select id from auth.users where email like 'test%@pinwith.test');
delete from public.list_items
 where added_by in (select id from auth.users where email like 'test%@pinwith.test');
delete from auth.users where email like 'test%@pinwith.test';
commit;

-- 확인: 0이 나와야 한다
select count(*) as left_over from auth.users where email like 'test%@pinwith.test';
