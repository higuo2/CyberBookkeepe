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
create policy "anon can read transactions"
  on public.transactions for select
  to anon
  using (true);

create policy "anon can insert transactions"
  on public.transactions for insert
  to anon
  with check (true);
