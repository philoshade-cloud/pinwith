-- 친구들 의논 예시(한·영): 숫자로 구분한 예시 계정(ex_ko1~3, ex_en1~3, example-*@pinwith.me)이 공동 편집과 댓글로 여행 경로를 정하는 모습.
-- 공식 계정과 별개. 테스트 데이터 정리(cleanup_test_data.sql)에서 지워지지 않는다. 다시 실행해도 중복 없음.
do $seed$
declare
  doc jsonb := $json${"accounts":[["example-ko1@pinwith.me","ex_ko1","예시 사용자 1","PinWith가 친구들끼리 여행을 의논하는 모습을 보여 주려고 만든 예시 계정이에요."],["example-ko2@pinwith.me","ex_ko2","예시 사용자 2","PinWith가 친구들끼리 여행을 의논하는 모습을 보여 주려고 만든 예시 계정이에요."],["example-ko3@pinwith.me","ex_ko3","예시 사용자 3","PinWith가 친구들끼리 여행을 의논하는 모습을 보여 주려고 만든 예시 계정이에요."],["example-en1@pinwith.me","ex_en1","Sample User 1","A sample account made by PinWith to show how friends plan a trip together."],["example-en2@pinwith.me","ex_en2","Sample User 2","A sample account made by PinWith to show how friends plan a trip together."],["example-en3@pinwith.me","ex_en3","Sample User 3","A sample account made by PinWith to show how friends plan a trip together."]],"lists":[{"owner":"ex_ko1","editors":["ex_ko2","ex_ko3"],"slug":"osaka-kyoto-3-friends","kind":"course","title":"오사카·교토 2박 3일, 셋이 같이 짠 루트 (친구들 의논 예시)","desc":"친구 셋이 공동 편집으로 각자 가고 싶은 곳을 섹션 하나씩 담고, 장소마다 댓글로 의논해서 일정을 정했어요.\n장소를 눌러 댓글을 열어 보세요. 결론은 '오사카성' 댓글에 있어요.","themes":["오사카","교토","일본","친구여행","공동편집"],"sections":[{"name":"1 · 오사카 먹방","by":"ex_ko1","items":[["ChIJg2DcJhXnAGARCbeAHoZrPeQ",34.6686471,135.5030983,"도톤보리","첫날 밤은 여기. 글리코 간판 앞에서 사진, 타코야키·오코노미야키.",["첫날 밤"],"DOTONBORI"],["ChIJXSJB5UHnAGARQcEjvngsHaw",34.6653511,135.5062417,"구로몬 시장","해산물 꼬치와 과일. 오전에 가야 문 연 가게가 많아요.",["오전"],"KUROMON"],["ChIJ_TooXM3gAGARQR6hXH3QAQ8",34.6872571,135.5258546,"오사카성","공원 산책 겸. 천수각 안은 박물관이에요.",["산책"],"OSAKACASTLE"]]},{"name":"2 · 교토 사진 루트","by":"ex_ko2","items":[["ChIJrYtcv-urAWAR3XzWvXv8n_s",35.0168187,135.6713013,"아라시야마 대나무숲","사람 없는 이른 아침이 제일 예뻐요.",["이른 아침"],"ARASHIYAMA"],["ChIJB_vchdMIAWARujTEUIZlr2I",34.9946662,135.784661,"기요미즈데라","나무 무대에서 내려다보는 교토. 올라가는 길 기념품 거리도 구경.",["전망"],"KIYOMIZU"],["ChIJT8uMzZwIAWARnGzsARCjnrY",35.0050258,135.764723,"니시키 시장","점심 대신 시장 간식. 현금 챙기기.",["현금"],"NISHIKI"],["ChIJIW0uPRUPAWAR6eI6dRzKGns",34.9676945,135.7791876,"후시미 이나리 신사","끝없는 붉은 도리이. 해 질 녘이나 아침 일찍.",["해 질 녘"],"FUSHIMI"]]},{"name":"3 · 유니버설 하루","by":"ex_ko3","items":[["ChIJXeLVg9DgAGARqlIyMCX-BTY",34.6656768,135.4323185,"유니버설 스튜디오 재팬","닌텐도 월드는 입장 정리권이 필요할 수 있어요. 익스프레스 패스 고민 중.",["예약"],"USJ"]]}],"comments":[{"place":"ChIJg2DcJhXnAGARCbeAHoZrPeQ","by":"ex_ko2","body":"첫날 밤 도톤보리 좋다! 근데 교토 네 군데를 하루에 다 갈 수 있을까?","replies":[{"by":"ex_ko1","body":"아라시야마를 아침 일찍 가고, 후시미 이나리를 해 질 녘으로 미루면 될 것 같아."},{"by":"ex_ko3","body":"그럼 USJ는 마지막 날 하루 통째로 쓰는 거지? 🙏"}]},{"place":"ChIJrYtcv-urAWAR3XzWvXv8n_s","by":"ex_ko1","body":"대나무숲 아침 8시 전에 도착하려면 오사카에서 몇 시에 나가야 해?","replies":[{"by":"ex_ko2","body":"난바에서 1시간 조금 넘게 걸려. 6시 반에 나가자."},{"by":"ex_ko3","body":"6시 반... 그래 사진 위해서라면 😂"}]},{"place":"ChIJIW0uPRUPAWAR6eI6dRzKGns","by":"ex_ko2","body":"둘째 날 순서: 아라시야마(아침) → 기요미즈 → 니시키 시장 점심 → 후시미 이나리(해 질 녘). 어때?","replies":[{"by":"ex_ko1","body":"완벽. 후시미에서 바로 오사카로 돌아오기도 편해."},{"by":"ex_ko3","body":"찬성! 해 질 녘 도리이 사진 기대된다"}]},{"place":"ChIJXeLVg9DgAGARqlIyMCX-BTY","by":"ex_ko1","body":"USJ 하루 쓰면 구로몬이랑 오사카성은 못 가는데 괜찮아?","replies":[{"by":"ex_ko3","body":"익스프레스 패스 사면 오후에 나와서 오사카성 야경은 볼 수 있을 것 같아"},{"by":"ex_ko2","body":"근데 마지막 날 비행기가 저녁 6시라 USJ는 너무 빠듯해 ㅠ"}]},{"place":"ChIJ_TooXM3gAGARQR6hXH3QAQ8","by":"ex_ko1","body":"결론 정리할게! 1일: 도착 → 도톤보리 / 2일: 교토 / 3일: 구로몬 아침 → 오사카성 → 공항. USJ는 다음 여행에 🙇","replies":[{"by":"ex_ko3","body":"아쉽지만 인정... 다음엔 USJ만 하러 오자"},{"by":"ex_ko2","body":"좋아, 리스트 순서도 이대로 맞춰 둘게!"}]}]},{"owner":"ex_en1","editors":["ex_en2","ex_en3"],"slug":"nyc-long-weekend-3-friends","kind":"course","title":"NYC Long Weekend: Three Friends, One Plan (group planning example)","desc":"Three friends co-edited this list: each added a section of must-dos, then they argued it out in the comments place by place.\nOpen any place to read the thread. The final plan is in the comments on the High Line.","themes":["New York","USA","Long weekend","Friends trip","Group planning"],"sections":[{"name":"1 · Classic Manhattan","by":"ex_en1","items":[["ChIJe7vKMf9YwokRIMYfDz7iF9o",40.7593495,-73.9794087,"Top of the Rock","Sunset slot. The Empire State Building is right there in the view.",["Sunset","Tickets"],"TOPROCK"],["ChIJhRwB-yFawokRi0AhGH87UTc",40.7533582,-73.9768041,"Grand Central Terminal","Look up at the ceiling in the main concourse. Free.",["Free"],"GRANDCENTRAL"],["ChIJEYYWppJYwokRUTul6ztwlJ0",40.7739528,-73.9709657,"Bethesda Terrace, Central Park","Start of a walk across the park.",["Free"],"BETHESDA"],["ChIJb8Jg9pZYwokR-qHGtvSkLzs",40.7794366,-73.963244,"The Metropolitan Museum of Art","Closed Wednesdays; open late Fridays and Saturdays.",["Closed Wed"],"MET"]]},{"name":"2 · Brooklyn & the bridges","by":"ex_en2","items":[["ChIJd9SPZTFawokRh9NpOTE-G5k",40.7033165,-73.9895698,"DUMBO (Washington St)","The Manhattan Bridge photo between the brick buildings.",["Photo spot"],"DUMBO"],["ChIJ41U-c_ZbwokRnOGug5xZbys",40.7068623,-73.9978405,"Brooklyn Bridge walkway","Walk it toward Manhattan so the skyline is in front of you.",["Walk"],"BKBRIDGE"],["ChIJ5bQPhMdZwokRkTwKhVxhP1g",40.7479925,-74.0047649,"The High Line","Old elevated railway turned park. Early is best.",["Morning"],"HIGHLINE"]]},{"name":"3 · Food crawl","by":"ex_en3","items":[["ChIJCar0f49ZwokR6ozLV-dHNTE",40.722233,-73.987429,"Katz's Delicatessen","Pastrami on rye. Don't lose the paper ticket they hand you at the door.",["Pastrami"],"KATZ"],["ChIJ8Q2WSpJZwokRQz-bYYgEskM",40.7306597,-74.0021707,"Joe's Pizza (Carmine St)","Classic NYC slice. Cash only — there's an ATM inside.",["Cash only"],"JOESPIZZA"],["ChIJw2lMFL9ZwokRosAtly52YX4",40.7424396,-74.0061439,"Chelsea Market","Tacos, lobster rolls, everything. Right under the High Line.",["Lunch"],"CHELSEAMKT"]]}],"comments":[{"place":"ChIJe7vKMf9YwokRIMYfDz7iF9o","by":"ex_en2","body":"Top of the Rock at sunset? Those slots cost more.","replies":[{"by":"ex_en1","body":"Worth it — you get the Empire State Building IN the view, not under your feet."},{"by":"ex_en3","body":"Fine, but then Katz's has to be lunch, not dinner 😅"}]},{"place":"ChIJb8Jg9pZYwokR-qHGtvSkLzs","by":"ex_en3","body":"Heads up: the Met is closed on Wednesdays. Which day are we going?","replies":[{"by":"ex_en1","body":"Saturday — it's open late. Bethesda Terrace first, then walk across the park to the Met."}]},{"place":"ChIJ41U-c_ZbwokRnOGug5xZbys","by":"ex_en2","body":"Let's walk Brooklyn → Manhattan so the skyline is in front of us the whole way.","replies":[{"by":"ex_en3","body":"Then DUMBO first for the bridge photo, walk back over, and Joe's Pizza is a short subway ride away."},{"by":"ex_en1","body":"Sunset on the bridge, pizza after. Love it."}]},{"place":"ChIJ8Q2WSpJZwokRQz-bYYgEskM","by":"ex_en1","body":"Joe's is cash only btw","replies":[{"by":"ex_en3","body":"ATM inside, we're good 🍕"}]},{"place":"ChIJ5bQPhMdZwokRkTwKhVxhP1g","by":"ex_en3","body":"Final plan — Sat: Grand Central → Central Park → the Met → Top of the Rock at sunset. Sun: High Line + Chelsea Market early → DUMBO → Brooklyn Bridge at sunset → Joe's. Mon: Katz's brunch, then flights.","replies":[{"by":"ex_en2","body":"Locked in. I'll reorder the list to match."},{"by":"ex_en1","body":"Perfect. See you at Grand Central 🗽"}]}]}]}$json$::jsonb;
  a jsonb; rec jsonb; sec jsonb; it jsonb; cm jsonb; rp jsonb;
  uid uuid; owner_uid uuid; ed uuid; lid uuid; sid uuid; iid uuid; cid uuid; pos int; si int; n int := 0;
  h text;
begin
  -- 1) 예시 계정
  for a in select * from jsonb_array_elements(doc->'accounts') loop
    uid := (select id from auth.users where email = a->>0);
    if uid is null then
      uid := gen_random_uuid();
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
      values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', a->>0, '', now(), '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', a->>2), now() - interval '20 days', now(), '', '', '', '');
      insert into auth.identities (user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (uid, uid::text, jsonb_build_object('sub', uid::text, 'email', a->>0, 'email_verified', true), 'email', now(), now(), now());
    end if;
    update public.profiles set handle = a->>1, display_name = a->>2, bio = a->>3, lang = case when a->>1 like 'ex_en%' then 'en' else 'ko' end where id = uid;
  end loop;

  -- 2) 의논 리스트
  for rec in select * from jsonb_array_elements(doc->'lists') loop
    owner_uid := (select id from public.profiles where handle = rec->>'owner');
    continue when exists (select 1 from public.lists where owner_id = owner_uid and slug = rec->>'slug');
    -- 공동 편집은 맞팔로우가 필요하다
    for h in select jsonb_array_elements_text(rec->'editors') loop
      ed := (select id from public.profiles where handle = h);
      insert into public.follows (follower_id, followee_id) values (owner_uid, ed), (ed, owner_uid) on conflict do nothing;
    end loop;
    insert into public.lists (owner_id, slug, title, description, visibility, kind, themes, public_comments, is_example)
    values (owner_uid, rec->>'slug', rec->>'title', rec->>'desc', 'public', (rec->>'kind')::public.list_kind,
            array(select jsonb_array_elements_text(rec->'themes')), true, true)
    returning id into lid;
    for h in select jsonb_array_elements_text(rec->'editors') loop
      insert into public.list_editors (list_id, user_id, invited_by, accepted_at)
      values (lid, (select id from public.profiles where handle = h), owner_uid, now() - interval '6 days') on conflict do nothing;
    end loop;
    pos := 0; si := 0;
    for sec in select * from jsonb_array_elements(rec->'sections') loop
      insert into public.sections (list_id, name, position) values (lid, sec->>'name', si) returning id into sid;
      for it in select * from jsonb_array_elements(sec->'items') loop
        insert into public.places (google_place_id, lat, lng, coords_fetched_at)
        values (it->>0, (it->>1)::float8, (it->>2)::float8, now()) on conflict (google_place_id) do nothing;
        insert into public.list_items (list_id, section_id, place_id, position, added_by, custom_title, memo, tags)
        values (lid, sid, it->>0, pos, (select id from public.profiles where handle = sec->>'by'), it->>3, it->>4,
                array(select jsonb_array_elements_text(it->5)));
        pos := pos + 1;
      end loop;
      si := si + 1;
    end loop;
    -- 댓글과 대댓글(시간 순서대로)
    n := 0;
    for cm in select * from jsonb_array_elements(rec->'comments') loop
      iid := (select id from public.list_items where list_id = lid and place_id = cm->>'place');
      n := n + 1;
      insert into public.item_comments (item_id, author_id, body, created_at)
      values (iid, (select id from public.profiles where handle = cm->>'by'), cm->>'body', now() - interval '5 days' + make_interval(hours => n * 6))
      returning id into cid;
      for rp in select * from jsonb_array_elements(cm->'replies') loop
        n := n + 1;
        insert into public.item_comments (item_id, author_id, body, parent_id, created_at)
        values (iid, (select id from public.profiles where handle = rp->>'by'), rp->>'body', cid, now() - interval '5 days' + make_interval(hours => n * 6));
      end loop;
    end loop;
  end loop;
end $seed$;
