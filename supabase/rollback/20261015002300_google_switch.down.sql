-- v0.32(0.32-1, 0.32-2) DB 되돌리기. log_usage·run_budget_check는 20261015001600_ops.sql의 정의로 다시 만든다.
drop function if exists private.google_autostop();
drop function if exists private.google_month_cost();
drop table if exists public.app_flags;
