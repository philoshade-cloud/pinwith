-- 0.53-2 되돌리기: 계정 언어를 한국어·영어만. 다른 언어로 저장된 계정은 영어로 바꾼 뒤 제약을 되돌린다.
update public.profiles set lang = 'en' where lang not in ('ko', 'en');
alter table public.profiles drop constraint if exists profiles_lang_check;
alter table public.profiles add constraint profiles_lang_check check (lang in ('ko', 'en'));
