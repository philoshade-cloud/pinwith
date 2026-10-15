-- v0.21 휴대폰·컴퓨터 알림(웹 푸시), 콘솔 알림(가게 인증 결과·충전 확인·지급)
-- 되돌리기: supabase/rollback/20261015001400_push.down.sql

-- ── 0.21-4 알림 종류 추가 ──
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('follow', 'like', 'comment', 'reply', 'invite', 'invite_accepted', 'share_changed', 'notice', 'resolved',
                  'reservation', 'reservation_new', 'reservation_msg', 'biz_block', 'biz_alert',
                  'biz_review', 'topup_paid', 'payout'));
alter table public.notifications add column if not exists pushed_at timestamptz;

-- 가게 인증 결과
create or replace function private.on_business_status() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status and new.status in ('approved', 'rejected', 'suspended') then
    perform private.notify(new.owner_id, 'biz_review', null, null, null,
      new.place_name || case new.status when 'approved' then ' 가게 인증이 끝났어요. 가게 콘솔을 쓸 수 있어요.'
                                         when 'rejected' then ' 가게 인증이 반려됐어요' || coalesce(': ' || new.review_note, '') || '. 고쳐서 다시 신청할 수 있어요.'
                                         else ' 가게 계정이 정지됐어요' || coalesce(': ' || new.review_note, '') || '.' end);
  end if;
  return new;
end; $$;
create trigger businesses_notify_status after update of status on public.businesses
  for each row execute function private.on_business_status();

-- 광고비 충전 반영
create or replace function private.on_topup_paid() returns trigger language plpgsql security definer set search_path = '' as $$
declare b public.businesses;
begin
  if new.status = 'paid' and old.status is distinct from 'paid' then
    select * into b from public.businesses where id = new.business_id;
    perform private.notify(b.owner_id, 'topup_paid', null, null, null,
      b.place_name || ' 광고비 ' || new.amount || ' ' || new.currency || '가 충전됐어요.');
  end if;
  return new;
end; $$;
create trigger biz_topups_notify_paid after update of status on public.biz_topups
  for each row execute function private.on_topup_paid();

-- 지급 처리 결과
create or replace function private.on_payout_status() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status and new.status in ('paid', 'rejected') then
    perform private.notify(new.user_id, 'payout', null, null, null,
      case new.status when 'paid' then '요청한 ' || new.amount || ' ' || new.currency || '를 보냈어요.'
                      else '지급 요청이 반려됐어요' || coalesce(': ' || new.note, '') || '. 금액은 다시 받을 수 있는 금액으로 돌아갔어요.' end);
  end if;
  return new;
end; $$;
create trigger payout_requests_notify_status after update of status on public.payout_requests
  for each row execute function private.on_payout_status();

-- ── 0.21-5 웹 푸시 구독과 보내기 ──
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  user_agent text check (user_agent is null or char_length(user_agent) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
create policy "own push subscriptions" on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- 서버만 읽는 설정값(웹 푸시 키, 사이트 주소). 정책이 없어 서버 키(service role)로만 읽고 쓴다.
create table if not exists public.app_secrets (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_secrets enable row level security;
insert into public.app_secrets (key, value) values ('site_url', 'https://pinwith-xiea.vercel.app') on conflict (key) do nothing;

-- 알림이 생기면 사이트의 /api/push/dispatch 를 불러 휴대폰으로 보낸다(구독한 사람에게만, 실패해도 알림 저장은 그대로)
create extension if not exists pg_net with schema extensions;
create or replace function private.on_notification_push() returns trigger language plpgsql security definer set search_path = '' as $$
declare url text := (select value from public.app_secrets where key = 'site_url');
begin
  if url is not null and exists (select 1 from public.push_subscriptions where user_id = new.user_id) then
    perform net.http_post(
      url := url || '/api/push/dispatch',
      body := jsonb_build_object('id', new.id),
      headers := '{"Content-Type": "application/json"}'::jsonb,
      timeout_milliseconds := 3000
    );
  end if;
  return new;
end; $$;
create trigger notifications_push after insert on public.notifications
  for each row execute function private.on_notification_push();
