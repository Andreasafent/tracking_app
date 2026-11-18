-- Shopping list: free-text items or items picked from the foods list.
create table public.shopping_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  name       text not null,
  food_id    uuid references public.foods on delete set null,
  checked    boolean not null default false,
  created_at timestamptz not null default now()
);
create index shopping_items_user on public.shopping_items (user_id, created_at);
create index shopping_items_food on public.shopping_items (food_id);

alter table public.shopping_items enable row level security;
create policy "owner_all" on public.shopping_items for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
