-- 0.29-1 계정 언어(화면에서 바꾸면 저장): 휴대폰 알림 문구를 그 언어로 보낸다
alter table public.profiles add column if not exists lang text not null default 'ko' check (lang in ('ko', 'en'));
