-- 0.30-4 알림 본문 영어판: DB 함수들이 만드는 한국어 안내 문장을 넣을 때 영어 문장(body_en)도 함께 만든다.
-- 문장 틀(가게 이름·금액·사유 등은 그대로 옮김)을 종류별로 맞춰 바꾼다. 댓글·공지·메시지처럼 사람이 쓴 글은 그대로 둔다(body_en 없음).
-- 운영자용 알림(ops, 운영자에게 가는 dispute)은 운영자 콘솔이 한국어라 바꾸지 않는다.
alter table public.notifications add column if not exists body_en text;

create or replace function private.feature_en(p text) returns text
language sql immutable set search_path = '' as $$
  select case p when '예약 제휴(큐레이터 보상)' then 'the reservation partnership (curator rewards)' when '예약 문의 기능' then 'reservation inquiries' else p end;
$$;


create or replace function private.notification_en(p_kind text, p_body text) returns text
language plpgsql immutable set search_path = '' as $$
declare m text[]; s text;
begin
  if p_body is null then return null; end if;
  case p_kind
  when 'biz_alert' then
    m := regexp_match(p_body, '^(.*): 최근 90일 확정 예약 (\d+)건 중 노쇼·가게 취소 (\d+)건\((\d+)%\)\. 주변 가게 평균은 (\d+)%예요\.');
    if m is not null then
      return m[1] || ': in the last 90 days, ' || m[3] || ' of ' || m[2] || ' confirmed reservations were no-shows or store cancellations (' || m[4]
        || '%). Nearby stores average ' || m[5] || '%. Check it in Curator console → Connected stores, and disconnect if something looks wrong.';
    end if;
  when 'biz_review' then
    m := regexp_match(p_body, '^(.*) 가게 인증이 끝났어요\.');
    if m is not null then return m[1] || ' is verified. You can now use the store console.'; end if;
    m := regexp_match(p_body, '^(.*) 가게 인증이 반려됐어요(?:: (.*))?\. 고쳐서 다시 신청할 수 있어요\.$');
    if m is not null then return m[1] || ' was not verified' || coalesce(': ' || m[2], '') || '. You can fix it and apply again.'; end if;
    m := regexp_match(p_body, '^(.*) 가게 계정이 정지됐어요(?:: (.*))?\.$');
    if m is not null then return 'The store account for ' || m[1] || ' was suspended' || coalesce(': ' || m[2], '') || '.'; end if;
  when 'share_changed' then
    m := regexp_match(p_body, '^수익 배분이 ([0-9.]+)%에서 ([0-9.]+)%로 바뀌었어요');
    if m is not null then return 'Your revenue share changed from ' || m[1] || '% to ' || m[2] || '%.'; end if;
  when 'payout' then
    m := regexp_match(p_body, '^요청한 (.+) ([A-Z]{3})를 보냈어요\.$');
    if m is not null then return 'We sent the ' || m[1] || ' ' || m[2] || ' you requested.'; end if;
    m := regexp_match(p_body, '^지급 요청이 반려됐어요(?:: (.*))?\. 금액은');
    if m is not null then return 'Your payout request was declined' || coalesce(': ' || m[1], '') || '. The amount is available to request again.'; end if;
  when 'topup_paid' then
    m := regexp_match(p_body, '^(.*) 광고비 (.+) ([A-Z]{3})가 충전됐어요\.$');
    if m is not null then return m[2] || ' ' || m[3] || ' of ad credit was added for ' || m[1] || '.'; end if;
  when 'dispute' then
    m := regexp_match(p_body, '^(.*) 이의 제기 처리: (받아들이지 않았어요|큐레이터에게 (.+) 지급|가게에 (.+) 환불)(?: — (.*))?$');
    if m is not null then
      s := case when m[3] is not null then 'paid ' || m[3] || ' to the curator' when m[4] is not null then 'refunded ' || m[4] || ' to the store' else 'not accepted' end;
      return 'Dispute about ' || m[1] || ': ' || s || coalesce(' — ' || m[5], '');
    end if;
  when 'biz_admin' then
    -- 사유는 따로 뽑는다(정규식 한 줄에 욕심/게으른 반복을 섞지 않으려고)
    s := (regexp_match(p_body, ' 사유: (.*)$'))[1];
    m := regexp_match(p_body, '^(.*): 운영자가 (.+)을\(를\) 껐어요\.');
    if m is not null then
      return m[1] || ': PinWith turned off ' || private.feature_en(m[2]) || '. It can''t be turned back on until PinWith unlocks it. If you disagree, file a dispute in the store console.'
        || coalesce(' Reason: ' || s, '');
    end if;
    m := regexp_match(p_body, '^(.*): 운영자가 (.+) 잠금을 풀었어요\.');
    if m is not null then return m[1] || ': PinWith unlocked ' || private.feature_en(m[2]) || '. It can be turned on again.' || coalesce(' Reason: ' || s, ''); end if;
    m := regexp_match(p_body, '^(.*): 운영자 조치로 (.+)이\(가\) 꺼졌어요\.');
    if m is not null then
      return m[1] || ': PinWith turned off ' || private.feature_en(m[2]) || '. There are no reservation rewards from this store for now.' || coalesce(' Reason: ' || s, '');
    end if;
    m := regexp_match(p_body, '^(.*): 운영자 조치로 (.+)이\(가\) 다시 가능해졌어요\.');
    if m is not null then return m[1] || ': PinWith turned ' || private.feature_en(m[2]) || ' back on.' || coalesce(' Reason: ' || s, ''); end if;
  when 'biz_block' then
    m := regexp_match(p_body, '^(.*) 가게의 요청으로 내 리스트에서 빠졌어요\((\d+)곳\)');
    if m is not null then
      return m[1] || ' asked to be removed from your lists (' || m[2] || case when m[2] = '1' then ' place' else ' places' end
        || '). It stays hidden and can''t be added again until the store unblocks you.';
    end if;
  when 'reservation_new' then
    m := regexp_match(p_body, '^예약 문의를 취소했어요 · (.*)$');
    if m is not null then return 'Reservation inquiry cancelled · ' || m[1]; end if;
    m := regexp_match(p_body, '^(.*) · (\d+)명 · (.*)$');
    if m is not null then return m[1] || ' · party of ' || m[2] || ' · ' || m[3]; end if;
  when 'reservation_msg' then
    m := regexp_match(p_body, '^(.*) 예약 문의 · (.*)$');
    if m is not null then return m[1] || ' reservation inquiry · ' || m[2]; end if;
  when 'reservation' then
    m := regexp_match(p_body, '^(.*) 예약 문의: (확정됐어요|어렵다고 답했어요|방문 완료|노쇼로 기록됐어요|가게가 취소했어요)(?: — (.*))?$');
    if m is not null then
      s := case m[2] when '확정됐어요' then 'confirmed' when '어렵다고 답했어요' then 'the store can''t take it' when '방문 완료' then 'visited'
                     when '노쇼로 기록됐어요' then 'recorded as a no-show' else 'cancelled by the store' end;
      return m[1] || ' reservation inquiry: ' || s || coalesce(' — ' || m[3], '');
    end if;
  else
    return null;
  end case;
  return null;
end; $$;


create or replace function private.fill_notification_en() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.body_en is null then new.body_en := private.notification_en(new.kind, new.body); end if;
  return new;
end; $$;
create trigger notifications_fill_en before insert on public.notifications
  for each row execute function private.fill_notification_en();

-- 이미 있는 알림도 채운다
update public.notifications set body_en = private.notification_en(kind, body) where body_en is null and body is not null;
