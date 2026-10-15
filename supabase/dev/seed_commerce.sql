-- 테스트용 상업 데이터(2026-10-15). 출시 전 cleanup_test_data.sql로 계정과 함께 지워진다.
-- 가게 계정: test7(명동교자), test8(어니언 안국), test9(우래옥 + 하동관 신청 대기)  비밀번호는 다른 테스트 계정과 같다.
do $$
declare
  r record; u uuid; b uuid; o uuid; pw text := extensions.crypt('pinwith-test-2026', extensions.gen_salt('bf'));
  curator uuid := (select id from auth.users where email = 'test1@pinwith.test');
  nopo uuid := (select id from public.lists where owner_id = (select id from auth.users where email = 'test1@pinwith.test') and slug = 'euljiro-nopo');
  anguk uuid := (select id from public.lists where owner_id = (select id from auth.users where email = 'test1@pinwith.test') and slug = 'anguk-walk');
  it uuid; att uuid; i int;
begin
  -- 1) 가게 주인 계정
  for r in select * from (values
      (7, 'store_mdkj', '명동교자 사장님'),
      (8, 'store_onion', '어니언 안국 매니저'),
      (9, 'store_wooraeok', '우래옥 사장님')) t(n, h, nm) loop
    if not exists (select 1 from auth.users where email = 'test' || r.n || '@pinwith.test') then
      u := gen_random_uuid();
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
      values ('00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated', 'test' || r.n || '@pinwith.test', pw, now(), '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', r.nm), now(), now(), '', '', '', '');
      insert into auth.identities (user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (u, u::text, jsonb_build_object('sub', u::text, 'email', 'test' || r.n || '@pinwith.test', 'email_verified', true), 'email', now(), now(), now());
    end if;
    update public.profiles set handle = r.h, display_name = r.nm, bio = '테스트 가게 계정'
    where id = (select id from auth.users where email = 'test' || r.n || '@pinwith.test');
  end loop;

  -- 2) 인증된 가게 + 과금 모델 + 충전(입금 확인)
  for r in select * from (values
      (7, '명동교자', '명동교자 본점', '(주)명동교자', '101-81-00001', '김명동', '02-776-5348', nopo),
      (8, '어니언 안국', '어니언 안국', '어니언', '101-81-00002', '이어니', '070-7543-2123', anguk),
      (9, '우래옥', '우래옥', '우래옥', '101-81-00003', '박우래', '02-2265-0151', nopo)) t(n, title, pname, bname, reg, cname, phone, lst) loop
    u := (select id from auth.users where email = 'test' || r.n || '@pinwith.test');
    it := (select id from public.list_items where list_id = r.lst and custom_title = r.title limit 1);
    if it is null or exists (select 1 from public.businesses where owner_id = u and status = 'approved') then continue; end if;
    insert into public.businesses (owner_id, place_id, place_name, place_address, lat, lng, business_name, reg_number, contact_name, contact_phone, role, status, review_note, reviewed_at)
    select u, i2.place_id, r.pname, '서울', p.lat, p.lng, r.bname, r.reg, r.cname, r.phone, 'owner', 'approved', '테스트 데이터', now()
    from public.list_items i2 left join public.places p on p.google_place_id = i2.place_id where i2.id = it
    returning id into b;
    insert into public.biz_topups (business_id, amount, currency, method, provider, status, reference, paid_at, created_at)
    values (b, 100, 'USD', 'bank', 'bank', 'paid', '테스트 입금', now() - interval '5 days', now() - interval '6 days');
  end loop;

  -- 명동교자: 길찾기 0.3, 근처 1.0 / 어니언: 길찾기 0.2, 근처 0.8(월 예산 30) / 우래옥: 예약 5.0, 길찾기 0.3
  insert into public.biz_offers (business_id, model, rate, monthly_budget, message)
  select b2.id, x.model, x.rate, x.budget, x.msg
  from public.businesses b2
  join (values
    ('test7@pinwith.test', 'click', 0.3, null::numeric, '만두는 꼭 같이 주문하세요. 오후 2~4시가 덜 붐벼요.'),
    ('test7@pinwith.test', 'visit', 1.0, null, null),
    ('test8@pinwith.test', 'click', 0.2, 30, '한옥 마당 자리 사진 환영해요.'),
    ('test8@pinwith.test', 'visit', 0.8, 30, null),
    ('test9@pinwith.test', 'reservation', 5.0, null, '단체 예약(6인 이상)은 하루 전까지 문의 주세요.'),
    ('test9@pinwith.test', 'click', 0.3, null, null)) x(email, model, rate, budget, msg)
    on b2.owner_id = (select id from auth.users where email = x.email) and b2.status = 'approved'
  on conflict (business_id, model) do nothing;

  -- 3) test1이 일부 제휴를 붙임(명동교자 길찾기·근처, 우래옥 예약). 어니언은 붙이지 않아 직접 붙여 볼 수 있게 둠.
  insert into public.offer_attachments (offer_id, list_id, item_id, curator_id)
  select o2.id, nopo, i3.id, curator
  from public.biz_offers o2 join public.businesses b3 on b3.id = o2.business_id
  join public.list_items i3 on i3.list_id = nopo and i3.place_id = b3.place_id
  where b3.owner_id in (select id from auth.users where email in ('test7@pinwith.test', 'test9@pinwith.test'))
    and o2.model in ('click', 'visit', 'reservation')
    and not (b3.owner_id = (select id from auth.users where email = 'test9@pinwith.test') and o2.model = 'click')
  on conflict (offer_id, list_id) do nothing;

  -- 4) 손님 행동(과금은 트리거가 계산): 지난 6일 동안 명동교자 길찾기·근처
  it := (select i4.id from public.list_items i4 join public.businesses b4 on b4.place_id = i4.place_id
         where i4.list_id = nopo and b4.owner_id = (select id from auth.users where email = 'test7@pinwith.test') limit 1);
  if it is not null and not exists (select 1 from public.link_events where device_id like 'seed-biz-%') then
    for i in 1..14 loop
      insert into public.link_events (list_id, item_id, device_id, event, in_radius, created_at)
      values (nopo, it, 'seed-biz-' || i, (array['google_open', 'naver_open', 'directions', 'kakao_open'])[1 + i % 4],
              i % 3 = 0, now() - make_interval(days => i % 6, hours => i));
    end loop;
  end if;

  -- 5) 우래옥 예약 문의: 확정 1건(큐레이터 보상), 새 문의 2건, 거절 1건
  it := (select i5.id from public.list_items i5 join public.businesses b5 on b5.place_id = i5.place_id
         where i5.list_id = nopo and b5.owner_id = (select id from auth.users where email = 'test9@pinwith.test') limit 1);
  b := (select id from public.businesses where owner_id = (select id from auth.users where email = 'test9@pinwith.test') and status = 'approved');
  o := (select id from public.biz_offers where business_id = b and model = 'reservation');
  att := (select id from public.offer_attachments where offer_id = o and list_id = nopo);
  if it is not null and not exists (select 1 from public.reservations where business_id = b) then
    insert into public.reservations (business_id, offer_id, user_id, list_id, item_id, attachment_id, curator_id, name, phone, visit_date, visit_time, party_size, note, status, reply, created_at)
    values
      (b, o, (select id from auth.users where email = 'test3@pinwith.test'), nopo, it, att, curator, '민호', '010-1111-2222', current_date + 3, '18:30', 4, '창가 자리 가능할까요?', 'confirmed', '네, 창가로 준비할게요.', now() - interval '2 days'),
      (b, o, (select id from auth.users where email = 'test4@pinwith.test'), nopo, it, att, curator, '서연', '010-3333-4444', current_date + 5, '12:00', 2, null, 'new', null, now() - interval '3 hours'),
      (b, o, (select id from auth.users where email = 'test5@pinwith.test'), nopo, it, att, curator, '준호', '010-5555-6666', current_date + 1, '19:00', 8, '단체 회식입니다.', 'new', null, now() - interval '1 hour'),
      (b, o, (select id from auth.users where email = 'test6@pinwith.test'), nopo, it, att, curator, '지민', '010-7777-8888', current_date + 2, '20:00', 2, null, 'declined', '그날은 만석이에요.', now() - interval '1 day');
    insert into public.offer_charges (offer_id, attachment_id, business_id, curator_id, list_id, model, amount, curator_amount, viewer, day, created_at)
    select o, att, b, curator, nopo, 'reservation', 5.0, 4.0, 'r:' || id, (created_at at time zone 'Asia/Seoul')::date, created_at
    from public.reservations where business_id = b and status = 'confirmed';
  end if;

  -- 6) 확인 대기: test9가 하동관도 신청, 명동교자 추가 충전 요청
  if not exists (select 1 from public.businesses where place_name = '하동관') then
    insert into public.businesses (owner_id, place_id, place_name, place_address, business_name, reg_number, contact_name, contact_phone, role)
    select (select id from auth.users where email = 'test9@pinwith.test'), place_id, '하동관', '서울 중구 명동9길 12', '하동관', '101-81-00004', '박우래', '02-776-5656', 'manager'
    from public.list_items where list_id = nopo and custom_title = '하동관' limit 1;
  end if;
  if not exists (select 1 from public.biz_topups where status = 'requested') then
    insert into public.biz_topups (business_id, amount, currency, method, provider)
    select id, 50, 'USD', 'bank', 'bank' from public.businesses where owner_id = (select id from auth.users where email = 'test7@pinwith.test') and status = 'approved';
  end if;

  -- 7) 문의·신고 샘플
  if not exists (select 1 from public.support_requests where body like '[테스트]%') then
    insert into public.support_requests (user_id, category, email, body, page_url, list_id, created_at) values
      ((select id from auth.users where email = 'test3@pinwith.test'), 'question', null, '[테스트] 리스트를 여러 사람이 같이 편집하려면 어떻게 하나요?', '/me', null, now() - interval '2 days'),
      ((select id from auth.users where email = 'test4@pinwith.test'), 'bug', null, '[테스트] 아이폰에서 지도 열기를 누르면 가끔 빈 화면이 떠요.', '/@seoul_foodie/euljiro-nopo', null, now() - interval '1 day'),
      ((select id from auth.users where email = 'test5@pinwith.test'), 'report', null, '[테스트] 이 리스트 설명에 광고성 연락처가 들어 있어요.', '/@seoul_foodie/anguk-walk', anguk, now() - interval '5 hours'),
      (null, 'partnership', 'partner@example.com', '[테스트] 여행사입니다. 큐레이터 리스트를 상품 페이지에 소개하고 싶어요.', '/support', null, now() - interval '3 hours'),
      ((select id from auth.users where email = 'test6@pinwith.test'), 'other', null, '[테스트] 다크 모드도 지원되면 좋겠어요.', '/me', null, now() - interval '30 minutes');
  end if;
end $$;

-- v0.20 추가(2026-10-15): 우래옥·명동교자 예약 기능 켜기(요일·시간대), 우래옥 노쇼 많은 패턴(이상 알림 시험용), 예약 대화 샘플
-- (실행한 SQL은 대화 기록 참고: businesses.reservations_enabled/hours 설정, 지난 확정 예약 6건(방문 2·노쇼 4), private.check_reservation_anomaly 호출)
