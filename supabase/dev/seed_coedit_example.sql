-- 예시 리스트: 친구 세 명이 공동 편집으로 부산 1박 2일 루트를 각자 개성대로 제안하고(섹션 = 사람별 루트) 댓글로 논의한 사례.
-- 주인 test3(busan_trip, 민호) · 편집자 test1(seoul_foodie, 지수), test2(cafe_hopper, 하루). 테스트 계정과 함께 지워진다.
do $$
declare
  minho uuid := (select id from auth.users where email = 'test3@pinwith.test');
  jisu uuid := (select id from auth.users where email = 'test1@pinwith.test');
  haru uuid := (select id from auth.users where email = 'test2@pinwith.test');
  l uuid; s1 uuid; s2 uuid; s3 uuid; i uuid; c uuid;
  pid text;
begin
  if exists (select 1 from public.lists where owner_id = minho and slug = 'busan-3-routes') then return; end if;

  -- 공동 편집은 맞팔로우가 필요하다
  insert into public.follows (follower_id, followee_id) values
    (minho, jisu), (jisu, minho), (minho, haru), (haru, minho), (jisu, haru), (haru, jisu)
  on conflict do nothing;

  insert into public.lists (owner_id, slug, title, description, visibility, kind, themes)
  values (minho, 'busan-3-routes', '부산 1박 2일, 셋이 짠 세 가지 루트',
          '같이 가는 친구 셋이 각자 좋아하는 대로 루트를 하나씩 짰어요. 바다파 민호, 시장·노포파 지수, 골목·전망파 하루. 섹션을 눌러 루트를 하나씩 보고, 장소마다 남긴 댓글로 어떻게 합칠지 정했어요.',
          'public', 'course', array['부산', '여행', '친구', '공동편집'])
  returning id into l;

  insert into public.list_editors (list_id, user_id, invited_by, accepted_at) values
    (l, jisu, minho, now() - interval '3 days'), (l, haru, minho, now() - interval '3 days')
  on conflict do nothing;

  insert into public.sections (list_id, name, position) values (l, '민호 · 바다 루트', 0) returning id into s1;
  insert into public.sections (list_id, name, position) values (l, '지수 · 시장·노포 루트', 1) returning id into s2;
  insert into public.sections (list_id, name, position) values (l, '하루 · 골목·전망 루트', 2) returning id into s3;

  -- 장소: 이미 들어 있는 부산 장소의 구글 장소 id를 쓴다
  insert into public.list_items (list_id, section_id, place_id, position, added_by, custom_title, memo, tags)
  select l, x.sec, (select place_id from public.list_items where custom_title = x.t limit 1), x.pos, x.who, x.t, x.memo, x.tags
  from (values
    (s1, 0, minho, '해운대', '첫날 아침은 무조건 바다. 해변 따라 동백섬까지 걸어요.', array['바다', '산책']::text[]),
    (s1, 1, minho, '해동용궁사', '바다 위 절. 오전 9시 전에 가야 덜 붐벼요.', array['일찍']::text[]),
    (s1, 2, minho, '광안리', '해 질 무렵 광안대교 불 켜지는 거 보기.', array['야경']::text[]),
    (s1, 3, minho, '밀락더마켓', '광안리 끝에서 저녁 겸 구경.', '{}'::text[]),
    (s2, 4, jisu, '자갈치시장', '회는 2층 식당에서 바로. 아침 9~10시가 제일 활기 있어요.', array['시장']::text[]),
    (s2, 5, jisu, '국제시장', '자갈치에서 걸어서 10분. 비빔당면 꼭.', array['시장', '간식']::text[]),
    (s2, 6, jisu, '개미집', '낙곱새 원조. 점심 줄 서도 회전 빨라요.', array['웨이팅']::text[]),
    (s2, 7, jisu, '이재모피자', '부산 사람들이 줄 서는 피자. 포장도 돼요.', array['웨이팅']::text[]),
    (s3, 8, haru, '흰여울문화마을', '바다 보이는 골목 카페가 줄지어 있어요. 오후 햇빛이 좋아요.', array['골목', '카페']::text[]),
    (s3, 9, haru, '감천문화마을', '언덕 위 알록달록 마을. 편한 신발 필수.', array['골목', '언덕']::text[])
  ) x(sec, pos, who, t, memo, tags)
  where (select place_id from public.list_items where custom_title = x.t limit 1) is not null;

  -- 댓글로 논의(대댓글 포함)
  i := (select id from public.list_items where list_id = l and custom_title = '해운대');
  insert into public.item_comments (item_id, author_id, body, created_at) values (i, jisu, '해운대 아침 좋다! 근데 첫날 오전에 자갈치까지 가면 동선이 너무 길지 않아?', now() - interval '2 days 5 hours') returning id into c;
  insert into public.item_comments (item_id, author_id, body, parent_id, created_at) values (i, minho, '그럼 첫날은 해운대·광안리(동쪽), 둘째 날은 자갈치·흰여울(서쪽)로 나누자.', c, now() - interval '2 days 4 hours');
  insert into public.item_comments (item_id, author_id, body, parent_id, created_at) values (i, haru, '좋아, 둘째 날 서쪽이면 흰여울에서 해 지는 것까지 볼 수 있겠다 🙌', c, now() - interval '2 days 3 hours');

  i := (select id from public.list_items where list_id = l and custom_title = '해동용궁사');
  insert into public.item_comments (item_id, author_id, body, created_at) values (i, haru, '9시 전이면 7시에 일어나야 하는데… 첫날은 빼고 둘째 날 아침은 어때?', now() - interval '2 days 2 hours') returning id into c;
  insert into public.item_comments (item_id, author_id, body, parent_id, created_at) values (i, minho, '둘째 날은 서쪽이라 반대 방향이야 ㅠ 그냥 이번엔 빼고 다음에 가자.', c, now() - interval '2 days 1 hour');

  i := (select id from public.list_items where list_id = l and custom_title = '개미집');
  insert into public.item_comments (item_id, author_id, body, created_at) values (i, minho, '낙곱새 점심 찬성. 국제시장 들렀다 가면 딱이네.', now() - interval '1 day 20 hours');
  insert into public.item_comments (item_id, author_id, body, created_at) values (i, haru, '난 매운 거 약한데 순한 맛 돼?', now() - interval '1 day 19 hours') returning id into c;
  insert into public.item_comments (item_id, author_id, body, parent_id, created_at) values (i, jisu, '응 맵기 조절돼! 걱정 마.', c, now() - interval '1 day 18 hours');

  i := (select id from public.list_items where list_id = l and custom_title = '감천문화마을');
  insert into public.item_comments (item_id, author_id, body, created_at) values (i, jisu, '감천이랑 흰여울 둘 다 가면 오르막이 많아서 하나만 고르자. 투표?', now() - interval '1 day 10 hours') returning id into c;
  insert into public.item_comments (item_id, author_id, body, parent_id, created_at) values (i, minho, '흰여울 한 표. 바다 보이는 쪽이 좋아.', c, now() - interval '1 day 9 hours');
  insert into public.item_comments (item_id, author_id, body, parent_id, created_at) values (i, haru, '내 루트지만 나도 흰여울 ㅋㅋ 감천은 다음에.', c, now() - interval '1 day 8 hours');

  -- 정리 공지(모두에게 보임)
  insert into public.posts (list_id, author_id, body, created_at) values (l, minho,
    '최종 정리 🗺️  첫날(동쪽): 해운대 → 광안리 → 밀락더마켓.  둘째 날(서쪽): 자갈치시장 → 국제시장 → 개미집(순한 맛) → 흰여울문화마을에서 노을.  해동용궁사·감천은 다음 여행에!',
    now() - interval '1 day 6 hours');
end $$;
