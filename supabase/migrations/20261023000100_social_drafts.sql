-- 0.63-1 SNS(X) 소개 글 초안: 정기 작업(Claude 예약 작업)이 인기 리스트 하나를 골라 초안을 넣고,
-- 운영자가 콘솔 'SNS 초안' 탭에서 복사해 직접 올린 뒤 '올림'으로 표시한다. 운영자만 읽고 쓴다.
create table if not exists public.social_drafts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  post_on date,
  channel text not null default 'x' check (channel in ('x')),
  list_id uuid references public.lists(id) on delete set null,
  list_path text,
  body text not null check (char_length(body) between 1 and 1000),
  alt_body text check (alt_body is null or char_length(alt_body) <= 1000),
  note text,
  status text not null default 'draft' check (status in ('draft', 'posted', 'skipped')),
  posted_at timestamptz,
  post_url text
);
create index if not exists social_drafts_created_idx on public.social_drafts (created_at desc);
create index if not exists social_drafts_list_idx on public.social_drafts (list_id);
alter table public.social_drafts enable row level security;
create policy "admins manage social drafts" on public.social_drafts for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
grant select, insert, update, delete on public.social_drafts to authenticated, service_role;
