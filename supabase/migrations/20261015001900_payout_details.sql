-- 0.26-1 지급 정보: Wise 원화(KRW) 송금 등에 필요한 영문 이름·생년월일·휴대폰 번호
alter table public.payout_profiles
  add column if not exists holder_name_latin text check (holder_name_latin is null or (char_length(holder_name_latin) between 1 and 100 and holder_name_latin ~ '^[A-Za-z][A-Za-z .,''-]*$')),
  add column if not exists birth_date date check (birth_date is null or birth_date > date '1900-01-01'),
  add column if not exists phone text check (phone is null or phone ~ '^\+?[0-9 -]{6,20}$');

-- 0.26-2 탈퇴 전 확인: 받을 수 있는 수익, 처리 중인 지급 요청, 가게 광고비 잔액
create or replace function public.my_deletion_check() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := (select auth.uid());
begin
  if me is null then raise exception 'not signed in'; end if;
  return jsonb_build_object(
    'currency', (select currency from public.monetization_settings),
    'available', round(coalesce(private.curator_available(me), 0), 2),
    'pending_payout', (select coalesce(sum(amount), 0) from public.payout_requests where user_id = me and status = 'requested'),
    'stores', coalesce((select jsonb_agg(jsonb_build_object('place_name', b.place_name, 'balance', round(private.biz_balance(b.id), 2)))
                        from public.businesses b where b.owner_id = me and private.biz_balance(b.id) > 0), '[]')
  );
end; $$;
revoke all on function public.my_deletion_check() from public, anon;
grant execute on function public.my_deletion_check() to authenticated;
