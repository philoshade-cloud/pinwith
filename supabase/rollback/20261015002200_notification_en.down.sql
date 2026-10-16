-- v0.30(0.30-4) DB 되돌리기
drop trigger if exists notifications_fill_en on public.notifications;
drop function if exists private.fill_notification_en();
drop function if exists private.notification_en(text, text);
drop function if exists private.feature_en(text);
alter table public.notifications drop column if exists body_en;
