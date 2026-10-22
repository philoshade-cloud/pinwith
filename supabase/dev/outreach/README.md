# 접근대상 예시 리스트 (2026-10-22)

크리에이터·블로그·숙소·커뮤니티 30곳에 보낼 예시 리스트. 파일 하나 = 리스트 하나(`list` 키).
넣는 법: `supabase/dev/seed_outreach_loader.sql`로 함수를 만든 뒤, 파일마다
`select private.seed_outreach_list('<list JSON>'::jsonb);` (같은 주소가 있으면 건너뜀).
모두 언어별 공식 계정(@pinwith_en 등) 아래 '링크 있는 사람만'(unlisted). 상대가 받아들이면 그 계정으로 넘겨 준다.
보낼 문안: 마케팅 문서 https://claude.ai/artifact/EGZUiJjiMBLCEXXh9Sje4g 의 '발송 문안 30곳 (최종)' 탭.
