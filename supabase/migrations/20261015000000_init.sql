-- PinWith MVP schema (기획안 8.1)
-- 원칙: 구글 장소 정보는 place_id만 영구 저장, 좌표는 30일 캐시(UI Kit 경유).
-- 이름·메모 등은 큐레이터가 입력/확인한 우리 콘텐츠.

create extension if not exists postgis with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ─────────────────────────────────────────────
-- 사용자 프로필
-- ─────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text not null unique
    check (handle ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null default '',
  avatar_url text,
  bio text not null default '',
  payout_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 행정 지역 (공개 데이터: GeoNames / OSM)
-- ─────────────────────────────────────────────
create table public.regions (
  id bigint primary key,
  level text not null check (level in ('country', 'admin1', 'city')),
  parent_id bigint references public.regions (id),
  country_code char(2) not null,
  names jsonb not null default '{}'::jsonb,   -- {"en":"Osaka","ja":"大阪","ko":"오사카"}
  geom extensions.geometry(MultiPolygon, 4326)
);
create index regions_geom_idx on public.regions using gist (geom);
create index regions_names_idx on public.regions using gin (names jsonb_path_ops);

-- ─────────────────────────────────────────────
-- 장소: place_id 영구, 좌표는 30일 캐시
-- ─────────────────────────────────────────────
create table public.places (
  google_place_id text primary key,
  lat double precision,
  lng double precision,
  coords_fetched_at timestamptz,
  region_ids bigint[] not null default '{}',
  created_at timestamptz not null default now(),
  check ((lat is null) = (lng is null))
);

-- ─────────────────────────────────────────────
-- 리스트와 구성
-- ─────────────────────────────────────────────
create type public.list_visibility as enum ('public', 'unlisted', 'private');
create type public.list_kind as enum ('collection', 'course');

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9-]{1,60}$'),
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '',
  cover_url text,
  visibility public.list_visibility not null default 'private',
  kind public.list_kind not null default 'collection',
  themes text[] not null default '{}' check (cardinality(themes) <= 5),
  region_ids bigint[] not null default '{}',   -- 큐레이터가 확인한 커버 지역 (D15)
  like_count integer not null default 0,
  copied_from_list_id uuid references public.lists (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, slug)
);
create index lists_public_idx on public.lists (visibility, updated_at desc);
create index lists_themes_idx on public.lists using gin (themes);
create index lists_regions_idx on public.lists using gin (region_ids);
create index lists_title_trgm_idx on public.lists using gin (title extensions.gin_trgm_ops);

create table public.list_editors (
  list_id uuid not null references public.lists (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  invited_by uuid not null references public.profiles (id),
  accepted_at timestamptz,
  revenue_share_pct numeric(5,2) not null default 0
    check (revenue_share_pct between 0 and 100),   -- D17: 기본 주인 100%
  created_at timestamptz not null default now(),
  primary key (list_id, user_id)
);

create table public.sections (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  position integer not null default 0
);
create index sections_list_idx on public.sections (list_id, position);

create table public.list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists (id) on delete cascade,
  section_id uuid references public.sections (id) on delete set null,
  place_id text not null references public.places (google_place_id),
  position integer not null default 0,
  added_by uuid not null references public.profiles (id),
  copied_from_item_id uuid references public.list_items (id) on delete set null,
  custom_title text not null check (char_length(custom_title) between 1 and 120),
  memo text not null default '',
  video_ts_url text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (list_id, place_id)
);
create index list_items_list_idx on public.list_items (list_id, position);
create index list_items_place_idx on public.list_items (place_id);

-- ─────────────────────────────────────────────
-- 소셜: 팔로우, 좋아요, 열람 기록, 댓글, 공지
-- ─────────────────────────────────────────────
create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  notify boolean not null default false,   -- D8: 팔로우 직후 알림 꺼짐
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index follows_followee_idx on public.follows (followee_id);

create table public.list_likes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  list_id uuid not null references public.lists (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, list_id)
);
create index list_likes_list_idx on public.list_likes (list_id);

create table public.list_views (
  user_id uuid not null references public.profiles (id) on delete cascade,
  list_id uuid not null references public.lists (id) on delete cascade,
  last_viewed_at timestamptz not null default now(),
  primary key (user_id, list_id)
);

create table public.item_comments (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.list_items (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  hidden_by_owner boolean not null default false,
  created_at timestamptz not null default now()
);
create index item_comments_item_idx on public.item_comments (item_id, created_at);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  image_urls text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index posts_list_idx on public.posts (list_id, created_at desc);

-- ─────────────────────────────────────────────
-- DM
-- ─────────────────────────────────────────────
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- 받는 쪽이 보낸 사람을 팔로우하지 않으면 'request' (메시지 요청함)
  status text not null default 'active' check (status in ('active', 'request', 'blocked')),
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);
create index conversation_members_user_idx on public.conversation_members (user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null default '' check (char_length(body) <= 4000),
  attached_list_id uuid references public.lists (id) on delete set null,
  attached_item_id uuid references public.list_items (id) on delete set null,
  tag text check (tag in ('missing_info', 'changed', 'recommend', 'other')),
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);

-- ─────────────────────────────────────────────
-- 짧은 링크와 유입 이벤트
-- ─────────────────────────────────────────────
create table public.short_links (
  code text primary key check (code ~ '^[A-Za-z0-9]{4,12}$'),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  target_list_id uuid references public.lists (id) on delete cascade,
  target_profile_id uuid references public.profiles (id) on delete cascade,
  channel_label text,
  created_at timestamptz not null default now(),
  check ((target_list_id is null) <> (target_profile_id is null))
);

create table public.link_events (
  id bigint generated always as identity primary key,
  code text references public.short_links (code) on delete set null,
  list_id uuid references public.lists (id) on delete cascade,
  item_id uuid references public.list_items (id) on delete set null,
  user_id uuid references public.profiles (id) on delete set null,
  device_id text,
  event text not null check (event in ('open', 'tap', 'directions', 'google_open', 'naver_open', 'kakao_open')),
  in_radius boolean,   -- 기기에서 계산한 '가게 500m 안' 결과만 저장, 좌표 원본은 저장 안 함
  referrer text,
  country char(2),
  created_at timestamptz not null default now()
);
create index link_events_list_idx on public.link_events (list_id, created_at);

-- ─────────────────────────────────────────────
-- 권한 판단 함수 (RLS에서 사용)
-- ─────────────────────────────────────────────
create or replace function public.is_list_owner(p_list_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.lists l where l.id = p_list_id and l.owner_id = (select auth.uid()));
$$;

create or replace function public.can_edit_list(p_list_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.lists l where l.id = p_list_id and l.owner_id = (select auth.uid()))
      or exists (select 1 from public.list_editors e
                 where e.list_id = p_list_id and e.user_id = (select auth.uid()) and e.accepted_at is not null);
$$;

create or replace function public.can_view_list(p_list_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.lists l
                 where l.id = p_list_id and l.visibility in ('public', 'unlisted'))
      or public.can_edit_list(p_list_id);
$$;

create or replace function public.is_following(p_follower uuid, p_followee uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.follows f
                 where f.follower_id = p_follower and f.followee_id = p_followee);
$$;

create or replace function public.is_mutual(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_following(p_a, p_b) and public.is_following(p_b, p_a);
$$;

create or replace function public.is_conversation_member(p_conversation_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.conversation_members m
                 where m.conversation_id = p_conversation_id and m.user_id = (select auth.uid())
                   and m.status <> 'blocked');
$$;

-- ─────────────────────────────────────────────
-- 트리거
-- ─────────────────────────────────────────────
-- 가입 시 프로필 자동 생성 (임시 핸들, 온보딩에서 변경)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, handle, display_name, avatar_url)
  values (
    new.id,
    'u' || substr(replace(new.id::text, '-', ''), 1, 12),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 좋아요 수 집계
create or replace function public.sync_like_count()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.lists set like_count = like_count + 1 where id = new.list_id;
  elsif tg_op = 'DELETE' then
    update public.lists set like_count = greatest(like_count - 1, 0) where id = old.list_id;
  end if;
  return null;
end;
$$;
create trigger list_likes_count
  after insert or delete on public.list_likes
  for each row execute function public.sync_like_count();

-- updated_at 갱신
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger lists_touch before update on public.lists
  for each row execute function public.touch_updated_at();
create trigger list_items_touch before update on public.list_items
  for each row execute function public.touch_updated_at();

-- 공동 편집자는 맞팔 사이에서만 초대 가능 (3.10)
create or replace function public.check_editor_invite()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_mutual(new.invited_by, new.user_id) then
    raise exception 'editors must follow each other';
  end if;
  return new;
end;
$$;
create trigger list_editors_mutual
  before insert on public.list_editors
  for each row execute function public.check_editor_invite();

-- 리스트 주인은 댓글의 hidden_by_owner만 바꿀 수 있다 (D16)
create or replace function public.set_comment_hidden(p_comment_id uuid, p_hidden boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.item_comments c
     set hidden_by_owner = p_hidden
    from public.list_items i
   where c.id = p_comment_id and i.id = c.item_id
     and public.is_list_owner(i.list_id);
  if not found then
    raise exception 'not allowed';
  end if;
end;
$$;

-- ─────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.regions enable row level security;
alter table public.places enable row level security;
alter table public.lists enable row level security;
alter table public.list_editors enable row level security;
alter table public.sections enable row level security;
alter table public.list_items enable row level security;
alter table public.follows enable row level security;
alter table public.list_likes enable row level security;
alter table public.list_views enable row level security;
alter table public.item_comments enable row level security;
alter table public.posts enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.short_links enable row level security;
alter table public.link_events enable row level security;

-- profiles
create policy "profiles readable by all" on public.profiles for select using (true);
create policy "update own profile" on public.profiles for update
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- regions, places: 누구나 읽기. places 쓰기는 로그인 사용자(장소 추가 시)
create policy "regions readable by all" on public.regions for select using (true);
create policy "places readable by all" on public.places for select using (true);
create policy "authenticated add places" on public.places for insert to authenticated with check (true);
-- 좌표 갱신은 비어 있거나 30일이 지난 경우에만 (아무나 핀을 옮기지 못하게)
create policy "authenticated refresh expired coords" on public.places for update to authenticated
  using (coords_fetched_at is null or coords_fetched_at < now() - interval '30 days')
  with check (true);

-- lists
create policy "view visible lists" on public.lists for select using (public.can_view_list(id));
create policy "create own list" on public.lists for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "editors update list" on public.lists for update to authenticated
  using (public.can_edit_list(id)) with check (public.can_edit_list(id));
create policy "owner deletes list" on public.lists for delete to authenticated
  using (owner_id = (select auth.uid()));

-- list_editors
create policy "owner and invitee see editors" on public.list_editors for select to authenticated
  using (user_id = (select auth.uid()) or public.can_edit_list(list_id));
create policy "owner invites editors" on public.list_editors for insert to authenticated
  with check (public.is_list_owner(list_id) and invited_by = (select auth.uid()));
create policy "invitee accepts or owner edits" on public.list_editors for update to authenticated
  using (user_id = (select auth.uid()) or public.is_list_owner(list_id));
create policy "owner removes or editor leaves" on public.list_editors for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_list_owner(list_id));

-- sections, list_items
create policy "view sections of visible lists" on public.sections for select using (public.can_view_list(list_id));
create policy "editors manage sections" on public.sections for all to authenticated
  using (public.can_edit_list(list_id)) with check (public.can_edit_list(list_id));

create policy "view items of visible lists" on public.list_items for select using (public.can_view_list(list_id));
create policy "editors add items" on public.list_items for insert to authenticated
  with check (public.can_edit_list(list_id) and added_by = (select auth.uid()));
create policy "editors update items" on public.list_items for update to authenticated
  using (public.can_edit_list(list_id)) with check (public.can_edit_list(list_id));
create policy "editors delete items" on public.list_items for delete to authenticated
  using (public.can_edit_list(list_id));

-- follows: 팔로우 관계는 공개(팔로워 수, 함께 팔로우 추천)
create policy "follows readable by all" on public.follows for select using (true);
create policy "follow as self" on public.follows for insert to authenticated
  with check (follower_id = (select auth.uid()));
create policy "update own follow" on public.follows for update to authenticated
  using (follower_id = (select auth.uid())) with check (follower_id = (select auth.uid()));
create policy "unfollow as self" on public.follows for delete to authenticated
  using (follower_id = (select auth.uid()));

-- list_likes: 누른 사람 목록은 본인과 리스트 주인만 (D14)
create policy "see own likes or likes on my list" on public.list_likes for select to authenticated
  using (user_id = (select auth.uid()) or public.is_list_owner(list_id));
create policy "like visible list" on public.list_likes for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_view_list(list_id));
create policy "unlike" on public.list_likes for delete to authenticated
  using (user_id = (select auth.uid()));

-- list_views: 본인만
create policy "own views" on public.list_views for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- item_comments: 작성자 본인, 작성자의 팔로워, 리스트 주인 (3.9, D16)
create policy "comment visibility" on public.item_comments for select to authenticated
  using (
    exists (select 1 from public.list_items i where i.id = item_id and public.can_view_list(i.list_id))
    and (
      author_id = (select auth.uid())
      or exists (select 1 from public.list_items i where i.id = item_id and public.is_list_owner(i.list_id))
      or (not hidden_by_owner and public.is_following((select auth.uid()), author_id))
    )
  );
create policy "comment on visible list" on public.item_comments for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (select 1 from public.list_items i where i.id = item_id and public.can_view_list(i.list_id))
  );
create policy "author edits comment" on public.item_comments for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy "author deletes comment" on public.item_comments for delete to authenticated
  using (author_id = (select auth.uid()));

-- posts: 리스트 단위 공지 (D8)
create policy "view posts of visible lists" on public.posts for select using (public.can_view_list(list_id));
create policy "editors post" on public.posts for insert to authenticated
  with check (author_id = (select auth.uid()) and public.can_edit_list(list_id));
create policy "author deletes post" on public.posts for delete to authenticated
  using (author_id = (select auth.uid()));

-- DM: 대화 당사자만
create policy "members see conversation" on public.conversations for select to authenticated
  using (public.is_conversation_member(id) or created_by = (select auth.uid()));
create policy "create conversation" on public.conversations for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy "members see members" on public.conversation_members for select to authenticated
  using (public.is_conversation_member(conversation_id) or user_id = (select auth.uid()));
create policy "creator adds members" on public.conversation_members for insert to authenticated
  with check (exists (select 1 from public.conversations c
                      where c.id = conversation_id and c.created_by = (select auth.uid())));
create policy "update own membership" on public.conversation_members for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "members read messages" on public.messages for select to authenticated
  using (public.is_conversation_member(conversation_id));
create policy "members send messages" on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and public.is_conversation_member(conversation_id));

-- short_links: 누구나 해석, 주인만 생성/삭제
create policy "short links readable" on public.short_links for select using (true);
create policy "create own short link" on public.short_links for insert to authenticated
  with check (owner_id = (select auth.uid())
              and (target_profile_id = (select auth.uid())
                   or (target_list_id is not null and public.can_edit_list(target_list_id))));
create policy "delete own short link" on public.short_links for delete to authenticated
  using (owner_id = (select auth.uid()));

-- link_events: 클라이언트는 기록만, 조회는 리스트 편집자만 (통계 화면)
create policy "anyone records events" on public.link_events for insert
  with check (user_id is null or user_id = (select auth.uid()));
create policy "editors read events" on public.link_events for select to authenticated
  using (list_id is not null and public.can_edit_list(list_id));
