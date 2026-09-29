-- Training plans: a date range (usually a week) with a training and a calorie target per day.
-- `days` is [{ date: 'YYYY-MM-DD', training: text, kcal: number | null }], one entry per day in the range.
create table public.training_plans (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  label      text,
  start_date date not null,
  end_date   date not null,
  days       jsonb not null default '[]',
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index training_plans_user_start on public.training_plans (user_id, start_date);

alter table public.training_plans enable row level security;
create policy "owner_all" on public.training_plans for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
