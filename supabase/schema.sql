create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  amount numeric not null check (amount > 0),
  type text not null check (type in ('EXPENSE', 'INCOME')),
  category text not null check (length(trim(category)) > 0),
  date date not null,
  note text not null check (length(trim(note)) > 0),
  currency text not null default 'HKD'
    check (currency in ('HKD', 'CNY', 'JPY', 'KRW'))
);

-- 已有表补列 + 约束对齐 HKD/CNY/JPY/KRW（幂等）
alter table public.transactions
  add column if not exists currency text;

update public.transactions
set currency = 'HKD'
where currency is null
   or trim(currency) = ''
   or upper(trim(currency)) in ('USD', 'EUR');

update public.transactions
set currency = upper(trim(currency))
where currency is not null;

alter table public.transactions
  alter column currency set default 'HKD';

alter table public.transactions
  alter column currency set not null;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'transactions_currency_check'
  ) then
    alter table public.transactions
      drop constraint transactions_currency_check;
  end if;
  alter table public.transactions
    add constraint transactions_currency_check
    check (currency in ('HKD', 'CNY', 'JPY', 'KRW'));
end $$;

create index if not exists transactions_date_idx
  on public.transactions (date desc);

create index if not exists transactions_currency_date_idx
  on public.transactions (currency, date desc);

alter table public.transactions enable row level security;

-- This app uses the public anon key without Supabase Auth.
-- These policies are suitable only for the requested single-user setup.
drop policy if exists "anon can read transactions" on public.transactions;
create policy "anon can read transactions"
  on public.transactions for select
  to anon
  using (true);

drop policy if exists "anon can insert transactions" on public.transactions;
create policy "anon can insert transactions"
  on public.transactions for insert
  to anon
  with check (true);

drop policy if exists "anon can update transactions" on public.transactions;
create policy "anon can update transactions"
  on public.transactions for update
  to anon
  using (true)
  with check (true);

drop policy if exists "anon can delete transactions" on public.transactions;
create policy "anon can delete transactions"
  on public.transactions for delete
  to anon
  using (true);

-- ---------------------------------------------------------------------------
-- AI 记账对话云端持久化
-- 注意：create table if not exists 不会修改已存在的表。
-- 若你曾用「Auth 版」建过 chat_messages（user_id NOT NULL + auth.users 外键），
-- 必须再跑下面「修复已有表」整段，否则匿名写入会失败并显示网络异常。
-- ---------------------------------------------------------------------------
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '',
  card_data jsonb null,
  status text null check (status in ('pending', 'confirmed', 'cancelled')),
  created_at timestamptz not null default now()
);

-- 修复已有表：去掉 Auth 外键 / NOT NULL，与本应用「anon 单机」一致
alter table public.chat_messages
  alter column user_id drop not null;

do $$
declare
  fk_name text;
begin
  select tc.constraint_name into fk_name
  from information_schema.table_constraints tc
  where tc.table_schema = 'public'
    and tc.table_name = 'chat_messages'
    and tc.constraint_type = 'FOREIGN KEY'
  limit 1;
  if fk_name is not null then
    execute format('alter table public.chat_messages drop constraint %I', fk_name);
  end if;
end $$;

create index if not exists chat_messages_created_at_idx
  on public.chat_messages (created_at asc);

create index if not exists chat_messages_user_created_idx
  on public.chat_messages (user_id, created_at asc);

alter table public.chat_messages enable row level security;

-- 删掉 Auth 版策略（若存在），只保留 anon 开放策略
drop policy if exists "Users can manage their own chat messages" on public.chat_messages;
drop policy if exists "anon can read chat_messages" on public.chat_messages;
create policy "anon can read chat_messages"
  on public.chat_messages for select
  to anon
  using (true);

drop policy if exists "anon can insert chat_messages" on public.chat_messages;
create policy "anon can insert chat_messages"
  on public.chat_messages for insert
  to anon
  with check (true);

drop policy if exists "anon can update chat_messages" on public.chat_messages;
create policy "anon can update chat_messages"
  on public.chat_messages for update
  to anon
  using (true)
  with check (true);

drop policy if exists "anon can delete chat_messages" on public.chat_messages;
create policy "anon can delete chat_messages"
  on public.chat_messages for delete
  to anon
  using (true);

-- ---------------------------------------------------------------------------
-- 规划数据云端同步（预算 / 周期收支 / 愿望罐）
-- 单行 default；本地 localStorage 作缓存，跨设备靠此表同步
-- ---------------------------------------------------------------------------
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
  cans_count int not null default 0,
  can_fragments int not null default 0,
  unlocked_themes text[] not null default array['cream']::text[],
  current_theme text not null default 'cream',
  checkin_streak int not null default 0,
  last_checkin_date date,
  completed_milestones text[] not null default array[]::text[],
  last_sponsor_claim_date date,
  updated_at timestamptz not null default now()
);

insert into public.planner_state (id)
values ('default')
on conflict (id) do nothing;

-- 已有表补列（幂等）
alter table public.planner_state
  add column if not exists cans_count int;

alter table public.planner_state
  add column if not exists can_fragments int;

alter table public.planner_state
  add column if not exists unlocked_themes text[];

alter table public.planner_state
  add column if not exists current_theme text;

alter table public.planner_state
  add column if not exists checkin_streak int;

alter table public.planner_state
  add column if not exists last_checkin_date date;

alter table public.planner_state
  add column if not exists completed_milestones text[];

alter table public.planner_state
  add column if not exists last_sponsor_claim_date date;

update public.planner_state set cans_count = 0 where cans_count is null;
update public.planner_state set can_fragments = 0 where can_fragments is null;
update public.planner_state set unlocked_themes = array['cream']::text[] where unlocked_themes is null;
update public.planner_state set current_theme = 'cream' where current_theme is null;
update public.planner_state set checkin_streak = 0 where checkin_streak is null;
update public.planner_state set completed_milestones = array[]::text[] where completed_milestones is null;

alter table public.planner_state alter column cans_count set default 0;
alter table public.planner_state alter column can_fragments set default 0;
alter table public.planner_state alter column unlocked_themes set default array['cream']::text[];
alter table public.planner_state alter column current_theme set default 'cream';
alter table public.planner_state alter column checkin_streak set default 0;
alter table public.planner_state alter column completed_milestones set default array[]::text[];

alter table public.planner_state alter column cans_count set not null;
alter table public.planner_state alter column can_fragments set not null;
alter table public.planner_state alter column unlocked_themes set not null;
alter table public.planner_state alter column current_theme set not null;
alter table public.planner_state alter column checkin_streak set not null;
alter table public.planner_state alter column completed_milestones set not null;

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
