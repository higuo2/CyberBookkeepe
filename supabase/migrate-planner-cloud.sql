-- 规划数据云端同步（预算 / 周期 / 愿望罐）— 幂等
-- 与 transactions / chat_messages 相同：anon 开放，适合单机密码门

create table if not exists public.planner_state (
  id text primary key default 'default'
    check (id = 'default'),
  goals jsonb not null default '[]'::jsonb,
  recurring jsonb not null default '[]'::jsonb,
  monthly_budget numeric not null default 0,
  spend_mode text not null default 'actual'
    check (spend_mode in ('actual', 'reserve_fixed')),
  accounts jsonb not null default '[]'::jsonb,
  ledger jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.planner_state (id)
values ('default')
on conflict (id) do nothing;

alter table public.planner_state enable row level security;

drop policy if exists "anon can read planner_state" on public.planner_state;
create policy "anon can read planner_state"
  on public.planner_state for select
  to anon
  using (true);

drop policy if exists "anon can insert planner_state" on public.planner_state;
create policy "anon can insert planner_state"
  on public.planner_state for insert
  to anon
  with check (true);

drop policy if exists "anon can update planner_state" on public.planner_state;
create policy "anon can update planner_state"
  on public.planner_state for update
  to anon
  using (true)
  with check (true);

drop policy if exists "anon can delete planner_state" on public.planner_state;
create policy "anon can delete planner_state"
  on public.planner_state for delete
  to anon
  using (true);
