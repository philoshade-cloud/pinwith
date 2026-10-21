-- 0.53-2 화면 언어 17개: 계정 언어(profiles.lang)에 새 언어를 허용. 휴대폰 알림 문구는 한국어가 아니면 영어.
alter table public.profiles drop constraint if exists profiles_lang_check;
alter table public.profiles add constraint profiles_lang_check
  check (lang in ('ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'pt', 'fr', 'de', 'it', 'ru', 'ar', 'hi', 'tr', 'th', 'vi', 'id'));
