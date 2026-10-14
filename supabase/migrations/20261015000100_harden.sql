-- 보안 점검 반영: RLS 보조 함수를 API에 노출되지 않는 private 스키마로 옮긴다.
create schema if not exists private;
grant usage on schema private to anon, authenticated;

alter function public.is_list_owner(uuid) set schema private;
alter function public.can_edit_list(uuid) set schema private;
alter function public.can_view_list(uuid) set schema private;
alter function public.is_following(uuid, uuid) set schema private;
alter function public.is_mutual(uuid, uuid) set schema private;
alter function public.is_conversation_member(uuid) set schema private;

-- 본문에서 서로를 부르는 함수는 새 스키마 이름으로 다시 정의 (OID 유지 → 정책은 그대로 동작)
create or replace function private.can_view_list(p_list_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.lists l
                 where l.id = p_list_id and l.visibility in ('public', 'unlisted'))
      or private.can_edit_list(p_list_id);
$$;

create or replace function private.is_mutual(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_following(p_a, p_b) and private.is_following(p_b, p_a);
$$;

create or replace function public.check_editor_invite()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_mutual(new.invited_by, new.user_id) then
    raise exception 'editors must follow each other';
  end if;
  return new;
end;
$$;

create or replace function public.set_comment_hidden(p_comment_id uuid, p_hidden boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.item_comments c
     set hidden_by_owner = p_hidden
    from public.list_items i
   where c.id = p_comment_id and i.id = c.item_id
     and private.is_list_owner(i.list_id);
  if not found then
    raise exception 'not allowed';
  end if;
end;
$$;

-- 임시 핸들 충돌 방지: user id 앞 12자 → 20자
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, handle, display_name, avatar_url)
  values (
    new.id,
    'u' || substr(replace(new.id::text, '-', ''), 1, 20),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

grant execute on all functions in schema private to anon, authenticated;

-- 트리거 함수는 API로 직접 부를 수 없게
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.sync_like_count() from public, anon, authenticated;
revoke execute on function public.check_editor_invite() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;

-- 댓글 숨기기는 로그인한 리스트 주인만 쓰는 RPC
revoke execute on function public.set_comment_hidden(uuid, boolean) from public, anon;
grant execute on function public.set_comment_hidden(uuid, boolean) to authenticated;

-- sections: 같은 동작에 정책이 겹치지 않게 'for all'을 쪼갠다
drop policy "editors manage sections" on public.sections;
create policy "editors add sections" on public.sections for insert to authenticated
  with check (private.can_edit_list(list_id));
create policy "editors update sections" on public.sections for update to authenticated
  using (private.can_edit_list(list_id)) with check (private.can_edit_list(list_id));
create policy "editors delete sections" on public.sections for delete to authenticated
  using (private.can_edit_list(list_id));

-- 자주 조인·삭제되는 외래 키 인덱스
create index if not exists list_items_section_idx on public.list_items (section_id);
create index if not exists list_items_added_by_idx on public.list_items (added_by);
create index if not exists list_editors_user_idx on public.list_editors (user_id);
create index if not exists item_comments_author_idx on public.item_comments (author_id);
create index if not exists messages_sender_idx on public.messages (sender_id);
create index if not exists posts_author_idx on public.posts (author_id);
create index if not exists short_links_owner_idx on public.short_links (owner_id);
create index if not exists short_links_list_idx on public.short_links (target_list_id);
create index if not exists link_events_item_idx on public.link_events (item_id);
create index if not exists conversations_created_by_idx on public.conversations (created_by);
create index if not exists list_views_list_idx on public.list_views (list_id);
