-- Saved meals (recipes): a named list of ingredients to insert into any day/slot from MACROS.
-- `items` has the same shape as meal_entries.items (whole recipe); nutrients are recomputed
-- from the current foods when inserted, with the stored numbers as a fallback.
create table public.saved_meals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  name       text not null,
  items      jsonb not null default '[]',
  servings   numeric not null default 1 check (servings > 0),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.saved_meals enable row level security;
create policy "owner_all" on public.saved_meals for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
