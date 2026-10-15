-- (적용 완료)
-- 소셜: 알림, DM 시작·차단, 공동 편집 목록
-- ─────────────────────────────────────────────
-- 알림(앱 안 종 모양). 넣기는 트리거만 한다.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('follow', 'like', 'comment', 'invite', 'invite_accepted', 'notice')),
  actor_id uuid references public.profiles (id) on delete cascade,
  list_id uuid references public.lists (id) on delete cascade,
  item_id uuid references public.list_items (id) on delete cascade,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
create policy "see own notifications" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy "mark own notifications read" on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create or replace function private.notify(
  p_user uuid, p_kind text, p_actor uuid, p_list uuid default null, p_item uuid default null, p_body text default null
) returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, kind, actor_id, list_id, item_id, body)
  select p_user, p_kind, p_actor, p_list, p_item, p_body
  where p_user is not null and p_user is distinct from p_actor;
$$;

create or replace function private.on_follow() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.notify(new.followee_id, 'follow', new.follower_id);
  return new;
end; $$;
create trigger follows_notify after insert on public.follows for each row execute function private.on_follow();

create or replace function private.on_like() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.notify((select owner_id from public.lists where id = new.list_id), 'like', new.user_id, new.list_id);
  return new;
end; $$;
create trigger list_likes_notify after insert on public.list_likes for each row execute function private.on_like();

create or replace function private.on_comment() returns trigger language plpgsql security definer set search_path = '' as $$
declare l uuid;
begin
  select list_id into l from public.list_items where id = new.item_id;
  perform private.notify((select owner_id from public.lists where id = l), 'comment', new.author_id, l, new.item_id, left(new.body, 120));
  return new;
end; $$;
create trigger item_comments_notify after insert on public.item_comments for each row execute function private.on_comment();

create or replace function private.on_editor() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform private.notify(new.user_id, 'invite', new.invited_by, new.list_id);
  elsif old.accepted_at is null and new.accepted_at is not null then
    perform private.notify((select owner_id from public.lists where id = new.list_id), 'invite_accepted', new.user_id, new.list_id);
  end if;
  return new;
end; $$;
create trigger list_editors_notify after insert or update on public.list_editors for each row execute function private.on_editor();

-- 공지(posts): 그 큐레이터의 소식 알림을 켠 팔로워에게
create or replace function private.on_post() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, kind, actor_id, list_id, body)
  select f.follower_id, 'notice', new.author_id, new.list_id, left(new.body, 160)
  from public.follows f
  where f.followee_id = (select owner_id from public.lists where id = new.list_id) and f.notify;
  return new;
end; $$;
create trigger posts_notify after insert on public.posts for each row execute function private.on_post();

-- ─────────────────────────────────────────────
-- DM: 1:1 대화를 찾거나 만든다. 받는 사람이 나를 팔로우하지 않으면 '메시지 요청'으로.
create or replace function public.start_dm(other uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); c uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  if other = me or not exists (select 1 from public.profiles where id = other) then raise exception 'invalid user'; end if;
  select m1.conversation_id into c
  from public.conversation_members m1
  join public.conversation_members m2 on m2.conversation_id = m1.conversation_id and m2.user_id = other
  where m1.user_id = me
    and (select count(*) from public.conversation_members x where x.conversation_id = m1.conversation_id) = 2
  limit 1;
  if c is not null then return c; end if;
  -- 스팸 방지: 나를 팔로우하지 않는 사람에게 보내는 새 요청은 하루 20건까지
  if not private.is_following(other, me) and (
    select count(*) from public.conversations cv
    join public.conversation_members r on r.conversation_id = cv.id and r.user_id <> me and r.status = 'request'
    where cv.created_by = me and cv.created_at > now() - interval '1 day'
  ) >= 20 then
    raise exception 'request limit';
  end if;
  insert into public.conversations (created_by) values (me) returning id into c;
  insert into public.conversation_members (conversation_id, user_id, status) values
    (c, me, 'active'),
    (c, other, case when private.is_following(other, me) then 'active' else 'request' end);
  return c;
end; $$;
revoke all on function public.start_dm(uuid) from public, anon;
grant execute on function public.start_dm(uuid) to authenticated;

-- 차단된 대화에는 보낼 수 없고, 요청 상태인 사람이 답장하면 수락으로 본다
create or replace function private.on_message() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.conversation_members where conversation_id = new.conversation_id and status = 'blocked') then
    raise exception 'conversation blocked';
  end if;
  update public.conversation_members set status = 'active'
  where conversation_id = new.conversation_id and user_id = new.sender_id and status = 'request';
  return new;
end; $$;
create trigger messages_guard before insert on public.messages for each row execute function private.on_message();

-- 받은 메시지함: 상대, 마지막 메시지, 안 읽은 수, 내 상태(active/request/blocked)
create or replace function public.my_inbox() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.last_at desc nulls last), '[]'::jsonb) from (
    select m.conversation_id as id, m.status,
      o.user_id as other_id, p.handle as other_handle, p.display_name as other_name,
      (select body from public.messages x where x.conversation_id = m.conversation_id order by created_at desc limit 1) as last_body,
      (select created_at from public.messages x where x.conversation_id = m.conversation_id order by created_at desc limit 1) as last_at,
      (select count(*) from public.messages x where x.conversation_id = m.conversation_id
         and x.sender_id <> m.user_id and (m.last_read_at is null or x.created_at > m.last_read_at)) as unread
    from public.conversation_members m
    join public.conversation_members o on o.conversation_id = m.conversation_id and o.user_id <> m.user_id
    join public.profiles p on p.id = o.user_id
    where m.user_id = auth.uid()
  ) t where t.last_at is not null or t.status = 'active';
$$;
grant execute on function public.my_inbox() to authenticated;

-- 공동 편집자는 장소·메모·제목은 고칠 수 있지만, 공개 범위·주소·주인은 주인만 바꾼다(3.10)
create or replace function private.guard_list_owner_fields() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.owner_id <> old.owner_id then raise exception 'owner cannot change'; end if;
  if (select auth.uid()) is distinct from old.owner_id
     and (new.visibility <> old.visibility or new.slug <> old.slug) then
    raise exception 'only the owner can change visibility or address';
  end if;
  return new;
end; $$;
create trigger lists_owner_fields before update on public.lists for each row execute function private.guard_list_owner_fields();

-- 리스트 주인이 자기 리스트의 댓글을 숨기거나 다시 보이게 한다(D16)
create or replace function public.hide_comment(comment uuid, hidden boolean) returns void
language sql security definer set search_path = '' as $$
  update public.item_comments c set hidden_by_owner = hidden
  where c.id = comment
    and exists (select 1 from public.list_items i where i.id = c.item_id and private.is_list_owner(i.list_id));
$$;
revoke all on function public.hide_comment(uuid, boolean) from public, anon;
grant execute on function public.hide_comment(uuid, boolean) to authenticated;
