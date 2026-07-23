-- 猫罐头小铺 / 主题商店字段（幂等）
alter table public.planner_state
  add column if not exists cans_count int not null default 0;

alter table public.planner_state
  add column if not exists can_fragments int not null default 0;

alter table public.planner_state
  add column if not exists unlocked_themes text[] not null default array['cream']::text[];

alter table public.planner_state
  add column if not exists current_theme text not null default 'cream';

alter table public.planner_state
  add column if not exists checkin_streak int not null default 0;

alter table public.planner_state
  add column if not exists last_checkin_date date;

alter table public.planner_state
  add column if not exists completed_milestones text[] not null default array[]::text[];

alter table public.planner_state
  add column if not exists last_sponsor_claim_date date;
