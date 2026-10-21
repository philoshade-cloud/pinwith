-- 0.55-1 '타인의 핀'에서 볼 언어(My 화면에서 여러 개 고름). 비어 있으면 화면 언어 하나만.
-- 리스트의 언어 = lists.lang(공식·예시) 또는 만든 사람의 계정 언어(profiles.lang).
alter table public.profiles add column if not exists explore_langs text[]
  check (explore_langs is null or (cardinality(explore_langs) <= 17 and explore_langs <@ array['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'pt', 'fr', 'de', 'it', 'ru', 'ar', 'hi', 'tr', 'th', 'vi', 'id']::text[]));
