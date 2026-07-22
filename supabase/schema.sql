create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  amount numeric not null check (amount > 0),
  type text not null check (type in ('EXPENSE', 'INCOME')),
  category text not null check (length(trim(category)) > 0),
  date date not null,
  note text not null check (length(trim(note)) > 0)
);

create index if not exists transactions_date_idx
  on public.transactions (date desc);

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
