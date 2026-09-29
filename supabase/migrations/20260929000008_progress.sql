-- PROGRESS page: strength exercises with a dated log (one entry per exercise per day, so
-- re-saving a day corrects it and every other day stays as history), plus distances with
-- dated efforts for PBs. A race is an effort with is_race; an upcoming race has no time yet.

create table public.exercises (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  name         text not null,
  muscle_group text not null,
  notes        text,
  created_at   timestamptz not null default now(),
  unique (user_id, name)
);

create table public.exercise_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  exercise_id uuid not null references public.exercises on delete cascade,
  date        date not null,
  weight      numeric check (weight >= 0),
  reps        integer check (reps > 0),
  sets        integer check (sets > 0),
  notes       text,
  created_at  timestamptz not null default now(),
  unique (exercise_id, date)
);
create index exercise_logs_user_date on public.exercise_logs (user_id, date);

create table public.pb_distances (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  name       text not null,
  meters     numeric not null check (meters > 0),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.distance_efforts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  distance_id uuid not null references public.pb_distances on delete cascade,
  date        date not null,
  time_sec    numeric check (time_sec > 0),
  is_race     boolean not null default false,
  race_name   text,
  goal_sec    numeric check (goal_sec > 0),
  notes       text,
  created_at  timestamptz not null default now(),
  check (time_sec is not null or is_race)
);
create index distance_efforts_distance on public.distance_efforts (distance_id, date);
create index distance_efforts_user on public.distance_efforts (user_id);

alter table public.exercises        enable row level security;
alter table public.exercise_logs    enable row level security;
alter table public.pb_distances     enable row level security;
alter table public.distance_efforts enable row level security;

create policy "owner_all" on public.exercises for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "owner_all" on public.exercise_logs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "owner_all" on public.pb_distances for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "owner_all" on public.distance_efforts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
