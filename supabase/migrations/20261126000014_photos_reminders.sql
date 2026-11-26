-- Body progress photos: files live in the private 'progress-photos' bucket under
-- <user_id>/..., the table keeps their paths and the day they were taken (any number per day).
create table public.body_photos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  taken_on   date not null,
  path       text not null,
  thumb_path text not null,
  created_at timestamptz not null default now()
);
create index body_photos_user_taken on public.body_photos (user_id, taken_on);

-- In-app reminders. repeat_unit null = one-off on start_date, otherwise every repeat_every
-- days/weeks/months counted from start_date. done_through = last occurrence marked as done.
-- auto_photo: an occurrence also counts as done once a photo is uploaded for it.
create table public.reminders (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  name         text not null,
  start_date   date not null,
  repeat_unit  text check (repeat_unit in ('day', 'week', 'month')),
  repeat_every integer not null default 1 check (repeat_every > 0),
  lead_days    integer not null default 1 check (lead_days >= 0),
  auto_photo   boolean not null default false,
  done_through date,
  created_at   timestamptz not null default now()
);
create index reminders_user on public.reminders (user_id);

alter table public.body_photos enable row level security;
alter table public.reminders   enable row level security;

create policy "owner_all" on public.body_photos for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "owner_all" on public.reminders for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progress-photos', 'progress-photos', false, 5242880, array['image/jpeg']);

-- Each user reads and writes only inside their own folder. Files are never overwritten.
create policy "progress_photos_select" on storage.objects for select to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "progress_photos_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "progress_photos_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
