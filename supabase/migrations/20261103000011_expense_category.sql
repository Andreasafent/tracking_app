-- Free-form expenses can carry their own category (product expenses use the product's).
alter table public.expenses
  add column category_id uuid references public.expense_categories on delete set null;
create index expenses_category on public.expenses (category_id);
