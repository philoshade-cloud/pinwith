-- 0.25-3 가게 제휴 표시: 큐레이터가 보상을 받을 수 있는 장소(활성 제휴가 붙은 장소)를 리스트 화면에 '제휴'로 표시한다.
-- 추천·보증 광고 표시 의무(한국 표시광고법 심사지침, 미국 FTC 등)를 위해 누구나(비로그인 포함) 볼 수 있어야 한다.
-- 어느 가게·얼마인지는 내보내지 않고, 표시할 장소 id만 돌려준다.
create or replace function public.list_sponsored_items(p_list uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select distinct a.item_id
  from public.offer_attachments a
  join public.biz_offers o on o.id = a.offer_id
  join public.businesses b on b.id = o.business_id
  where a.list_id = p_list and a.active and o.active and b.status = 'approved'
    and private.can_view_list(p_list);
$$;
revoke all on function public.list_sponsored_items(uuid) from public;
grant execute on function public.list_sponsored_items(uuid) to anon, authenticated;
