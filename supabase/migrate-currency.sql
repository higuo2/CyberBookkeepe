-- 多币种：HKD / CNY / JPY / KRW（幂等）
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

create index if not exists transactions_currency_date_idx
  on public.transactions (currency, date desc);
