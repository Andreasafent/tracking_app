-- Expense tracking. Products carry a category, an optional fixed unit price and an optional
-- repeat schedule (subscriptions, bills). An expense is either free-form (optional title, no
-- product → counted as "other" in the analysis) or a product purchase (amount = what was spent).

create table public.expense_categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  name       text not null,
  color      text not null default '#2a78d6',
  sort       integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.expense_products (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  name        text not null,
  category_id uuid references public.expense_categories on delete set null,
  unit_price  numeric check (unit_price >= 0),   -- fixed price: expense = quantity × unit_price
  recurrence  text check (recurrence in ('weekly', 'monthly', 'quarterly', 'semiannual', 'yearly')),
  next_due    date,                              -- next payment date for repeating products
  active      boolean not null default true,     -- paused products stop showing as due
  created_at  timestamptz not null default now(),
  unique (user_id, name)
);

create table public.expenses (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  date       date not null,
  product_id uuid references public.expense_products on delete set null,
  name       text,                               -- title (free entries) or product name snapshot
  amount     numeric not null check (amount >= 0),
  quantity   numeric check (quantity > 0),
  created_at timestamptz not null default now()
);
create index expenses_user_date on public.expenses (user_id, date);
create index expenses_product on public.expenses (product_id);
create index expense_products_category on public.expense_products (category_id);
create index expense_products_user on public.expense_products (user_id);
create index expense_categories_user on public.expense_categories (user_id);

alter table public.expense_categories enable row level security;
alter table public.expense_products   enable row level security;
alter table public.expenses           enable row level security;

create policy "owner_all" on public.expense_categories for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "owner_all" on public.expense_products for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "owner_all" on public.expenses for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Default categories, then a one-off copy of the foods as products in "Τρόφιμα".
insert into public.expense_categories (user_id, name, color, sort)
select u.id, c.name, c.color, c.sort
from auth.users u
cross join (values
  ('Τρόφιμα',      '#1baf7a', 1),
  ('Εστιατόρια',   '#eb6834', 2),
  ('Συνδρομές',    '#8b5cf6', 3),
  ('Λογαριασμοί',  '#eda100', 4),
  ('Μετακινήσεις', '#2a78d6', 5),
  ('Υγεία',        '#e5484d', 6),
  ('Αθλητισμός',   '#14b8c4', 7),
  ('Ρούχα',        '#d6409f', 8),
  ('Διασκέδαση',   '#6b7bff', 9)
) as c(name, color, sort);

insert into public.expense_products (user_id, name, category_id)
select f.user_id, f.name,
       (select c.id from public.expense_categories c where c.user_id = f.user_id and c.name = 'Τρόφιμα')
from public.foods f;
