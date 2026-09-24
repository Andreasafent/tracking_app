-- Meals logged from the calculator keep the whole recipe in `items` (full amounts),
-- and the entry's kcal/macros are per serving: items total / servings.
alter table public.meal_entries
  add column servings numeric not null default 1 check (servings > 0);
