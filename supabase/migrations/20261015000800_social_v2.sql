-- (적용 완료) v0.15: 대댓글, 리스트별 알림 끄기, 소식 알림 기본 켬, 수익화 표시, 광고 노출 집계, 문의, 변경 기록, DM 반영함

-- 알림 종류 추가
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('follow', 'like', 'comment', 'reply', 'invite', 'invite_accepted', 'share_changed', 'notice', 'resolved'));

-- ── 1. 대댓글 ─────────────────────────────
-- 원래 댓글을 지우면 대댓글도 함께 지워진다.
alter table public.item_comments add column if not exists parent_id uuid references public.item_comments (id) on delete cascade;
create index if not exists item_comments_parent_idx on public.item_comments (parent_id);
-- 대댓글은 원래 댓글을 쓴 사람에게도 보인다(기존 규칙: 작성자 본인, 리스트 주인, 작성자의 팔로워)
-- (정책 안에서 같은 표를 다시 읽으면 무한 반복이 되므로 보안 함수로 읽는다)
create or replace function private.comment_author(p_comment uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select author_id from public.item_comments where id = p_comment;
$$;
create policy "reply visible to parent author" on public.item_comments for select to authenticated
  using (parent_id is not null and private.comment_author(parent_id) = (select auth.uid()));
-- 대댓글은 같은 장소의 원래 댓글에만, 한 단계까지만
create or replace function private.check_reply() returns trigger language plpgsql security definer set search_path = '' as $$
declare p public.item_comments;
begin
  if new.parent_id is null then return new; end if;
  select * into p from public.item_comments where id = new.parent_id;
  if p.id is null or p.item_id <> new.item_id or p.parent_id is not null then
    raise exception 'invalid reply';
  end if;
  return new;
end; $$;
create trigger item_comments_reply before insert on public.item_comments for each row execute function private.check_reply();

-- ── 2. 리스트별 알림 끄기, 소식 알림 기본 켬 ──────
alter table public.follows alter column notify set default true;
create table if not exists public.list_mutes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  list_id uuid not null references public.lists (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, list_id)
);
alter table public.list_mutes enable row level security;
create policy "own mutes" on public.list_mutes for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- 알림 만들기: 그 리스트 알림을 끈 사람에게는 보내지 않는다
create or replace function private.notify(
  p_user uuid, p_kind text, p_actor uuid, p_list uuid default null, p_item uuid default null, p_body text default null
) returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, kind, actor_id, list_id, item_id, body)
  select p_user, p_kind, p_actor, p_list, p_item, p_body
  where p_user is not null and p_user is distinct from p_actor
    and (p_list is null or not exists (select 1 from public.list_mutes m where m.user_id = p_user and m.list_id = p_list));
$$;

create or replace function private.on_post() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, kind, actor_id, list_id, body)
  select f.follower_id, 'notice', new.author_id, new.list_id, left(new.body, 160)
  from public.follows f
  where f.followee_id = (select owner_id from public.lists where id = new.list_id) and f.notify
    and not exists (select 1 from public.list_mutes m where m.user_id = f.follower_id and m.list_id = new.list_id);
  return new;
end; $$;

-- 댓글 알림: 원래 댓글이면 리스트 주인에게, 대댓글이면 원래 댓글 쓴 사람에게(그리고 주인에게)
create or replace function private.on_comment() returns trigger language plpgsql security definer set search_path = '' as $$
declare l uuid; owner uuid; parent_author uuid;
begin
  select list_id into l from public.list_items where id = new.item_id;
  select owner_id into owner from public.lists where id = l;
  if new.parent_id is not null then
    select author_id into parent_author from public.item_comments where id = new.parent_id;
    perform private.notify(parent_author, 'reply', new.author_id, l, new.item_id, left(new.body, 120));
    if owner is distinct from parent_author then
      perform private.notify(owner, 'comment', new.author_id, l, new.item_id, left(new.body, 120));
    end if;
  else
    perform private.notify(owner, 'comment', new.author_id, l, new.item_id, left(new.body, 120));
  end if;
  return new;
end; $$;

-- ── 3. 수익화 표시와 공동 편집 수익 배분 ──────
-- 주인이 '이 리스트로 수익화한다'를 켠 경우에만 편집자별 배분을 정하고 보여준다.
alter table public.lists add column if not exists monetize boolean not null default false;
create or replace function private.on_editor() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform private.notify(new.user_id, 'invite', new.invited_by, new.list_id);
  else
    if old.accepted_at is null and new.accepted_at is not null then
      perform private.notify((select owner_id from public.lists where id = new.list_id), 'invite_accepted', new.user_id, new.list_id);
    end if;
    if new.accepted_at is not null and new.revenue_share_pct <> old.revenue_share_pct
       and (select monetize from public.lists where id = new.list_id) then
      perform private.notify(new.user_id, 'share_changed', new.invited_by, new.list_id, null,
        '수익 배분이 ' || old.revenue_share_pct || '%에서 ' || new.revenue_share_pct || '%로 바뀌었어요');
    end if;
  end if;
  return new;
end; $$;

-- ── 4. 광고 자리 노출 집계(큐레이터 광고 수익 나눔 대비) ──────
-- 리스트 화면의 광고 자리가 실제로 화면에 보였을 때 하루 단위로 센다. 주인 본인 열람은 세지 않는다.
create table if not exists public.ad_views_daily (
  day date not null,
  list_id uuid not null references public.lists (id) on delete cascade,
  slot text not null check (char_length(slot) <= 40),
  views integer not null default 0,
  primary key (day, list_id, slot)
);
alter table public.ad_views_daily enable row level security;
create policy "owners read ad views" on public.ad_views_daily for select to authenticated
  using (private.is_list_owner(list_id));
create or replace function public.record_ad_view(p_list uuid, p_slot text) returns void
language sql security definer set search_path = '' as $$
  insert into public.ad_views_daily (day, list_id, slot, views)
  select (now() at time zone 'Asia/Seoul')::date, p_list, left(p_slot, 40), 1
  where exists (select 1 from public.lists l where l.id = p_list and l.visibility <> 'private'
                and l.owner_id is distinct from (select auth.uid()))
  on conflict (day, list_id, slot) do update set views = public.ad_views_daily.views + 1;
$$;
grant execute on function public.record_ad_view(uuid, text) to anon, authenticated;

-- ── 5. 문의·신고 ─────────────────────────
create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  category text not null check (category in ('question', 'bug', 'report', 'partnership', 'other')),
  email text check (email is null or char_length(email) <= 200),
  body text not null check (char_length(body) between 1 and 4000),
  page_url text check (page_url is null or char_length(page_url) <= 500),
  created_at timestamptz not null default now(),
  handled_at timestamptz
);
alter table public.support_requests enable row level security;
create policy "anyone sends support request" on public.support_requests for insert
  with check (user_id is null or user_id = (select auth.uid()));
create policy "see own support requests" on public.support_requests for select to authenticated
  using (user_id = (select auth.uid()));

-- ── 6. 변경 기록(공동 편집: 누가 언제 무엇을) ──────
create table if not exists public.list_changes (
  id bigint generated always as identity primary key,
  list_id uuid not null references public.lists (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (action in ('add', 'edit', 'remove', 'move')),
  item_title text,
  created_at timestamptz not null default now()
);
create index if not exists list_changes_list_idx on public.list_changes (list_id, created_at desc);
alter table public.list_changes enable row level security;
create policy "editors read changes" on public.list_changes for select to authenticated
  using (private.can_edit_list(list_id));
create or replace function private.on_item_change() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.list_changes (list_id, actor_id, action, item_title) values (new.list_id, auth.uid(), 'add', new.custom_title);
  elsif tg_op = 'DELETE' then
    -- 리스트째 지울 때는 기록하지 않는다
    if exists (select 1 from public.lists where id = old.list_id) then
      insert into public.list_changes (list_id, actor_id, action, item_title) values (old.list_id, auth.uid(), 'remove', old.custom_title);
    end if;
    return old;
  elsif new.position <> old.position then
    -- 순서 바꾸기는 여러 줄이 함께 바뀌므로 1분 안의 같은 사람 기록은 하나로 본다
    if not exists (select 1 from public.list_changes where list_id = new.list_id and actor_id = auth.uid()
                   and action = 'move' and created_at > now() - interval '1 minute') then
      insert into public.list_changes (list_id, actor_id, action, item_title) values (new.list_id, auth.uid(), 'move', null);
    end if;
  elsif new.custom_title <> old.custom_title or new.memo <> old.memo or new.section_id is distinct from old.section_id then
    insert into public.list_changes (list_id, actor_id, action, item_title) values (new.list_id, auth.uid(), 'edit', new.custom_title);
  end if;
  return new;
end; $$;
create trigger list_items_history after insert or update or delete on public.list_items
  for each row execute function private.on_item_change();

-- ── 7. DM '반영함' ─────────────────────────
-- 받은 사람(큐레이터)이 유형 태그가 붙은 메시지를 반영했다고 표시하면 보낸 사람에게 알림
alter table public.messages add column if not exists resolved_at timestamptz;
create or replace function public.resolve_message(p_message uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare m public.messages;
begin
  select * into m from public.messages where id = p_message;
  if m.id is null or m.tag is null or m.sender_id = auth.uid()
     or not exists (select 1 from public.conversation_members where conversation_id = m.conversation_id and user_id = auth.uid()) then
    raise exception 'not allowed';
  end if;
  update public.messages set resolved_at = now() where id = p_message and resolved_at is null;
  perform private.notify(m.sender_id, 'resolved', auth.uid(), m.attached_list_id, m.attached_item_id, left(m.body, 120));
end; $$;
revoke all on function public.resolve_message(uuid) from public, anon;
grant execute on function public.resolve_message(uuid) to authenticated;
