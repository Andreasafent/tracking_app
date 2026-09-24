-- Tracking app: initial schema
-- Single-user in practice, but every row is owned by auth.uid() and protected by RLS.

create extension if not exists btree_gist;

-- ─── Periods: intake target + burn estimate per date range (replaces MACROS target, Cals BURNED, NEW PLAN)
create table public.periods (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users on delete cascade,
  label          text,
  start_date     date not null,
  end_date       date not null,
  target_intake  integer not null,
  burn_estimate  integer not null,
  protein_target integer not null default 180,
  notes          text,
  created_at     timestamptz not null default now(),
  constraint periods_valid_range check (end_date >= start_date),
  constraint periods_no_overlap exclude using gist (
    user_id with =,
    daterange(start_date, end_date, '[]') with &&
  )
);

-- ─── Daily log: one row per date (ΓΕΝΙΚΑ inputs that are not meals or workouts)
create table public.daily_log (
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  date          date not null,
  -- nutrition
  weight        numeric,
  creatine      boolean,
  water         numeric,
  alcohol       boolean,
  sugar         boolean,
  burn_override integer,          -- overrides the period's burn estimate for this day
  -- recovery / body metrics
  sleep_hours   numeric,
  sleep_quality numeric check (sleep_quality between 0 and 10),
  energy        numeric check (energy between 0 and 10),
  fatigue       numeric check (fatigue between 0 and 10),
  resting_hr    integer,
  sleep_hr      integer,
  hrv           integer,
  -- γυμναστική (per-day parts; sessions live in workouts)
  active_rest   boolean,
  steps         integer,
  injury        boolean,
  -- mental / emotional
  mood          numeric check (mood between 0 and 10),
  anxiety       numeric check (anxiety between 0 and 10),
  motivation    numeric check (motivation between 0 and 10),
  focus         numeric check (focus between 0 and 10),
  hunger        numeric check (hunger between 0 and 10),
  sleepiness    numeric check (sleepiness between 0 and 10),
  -- μετρήσεις (cm)
  waist         numeric,
  chest         numeric,
  hips          numeric,
  thigh         numeric,
  calf          numeric,
  glutes        numeric,
  arm           numeric,
  notes         text,
  updated_at    timestamptz not null default now(),
  primary key (user_id, date)
);

-- ─── Activities (the list to choose from) and workouts (sessions)
create table public.activities (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  key           text,             -- stable key used by stats: running, cycling, swimming, weights
  name          text not null,
  distance_unit text check (distance_unit in ('km', 'm')),  -- null = no distance
  sort          integer not null default 0,
  archived      boolean not null default false,
  unique (user_id, key),
  unique (user_id, name)
);

create table public.workouts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  date         date not null,
  activity_id  uuid not null references public.activities on delete restrict,
  distance     numeric,
  duration_min numeric,
  rpe          numeric check (rpe between 0 and 10),
  notes        text,
  created_at   timestamptz not null default now()
);
create index workouts_user_date on public.workouts (user_id, date);

-- ─── Meals: any number of entries per slot per day (snacks are dynamic)
create type public.meal_slot as enum ('breakfast', 'lunch', 'dinner', 'snack');

create table public.meal_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  date       date not null,
  slot       public.meal_slot not null,
  name       text,
  kcal       numeric not null default 0,
  protein    numeric,
  carbs      numeric,
  fat        numeric,
  items      jsonb,               -- food breakdown when logged from the calculator
  created_at timestamptz not null default now()
);
create index meal_entries_user_date on public.meal_entries (user_id, date);

-- ─── Foods (calculator database). Values are per `per_amount` of `unit`.
create table public.foods (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  name       text not null,
  kcal       numeric not null,
  protein    numeric not null default 0,
  carbs      numeric not null default 0,
  fat        numeric not null default 0,
  iron       numeric,
  omega3     numeric,
  per_amount numeric not null default 100,
  unit       text not null default 'g' check (unit in ('g', 'piece')),
  unique (user_id, name)
);

-- ─── Running plan (KMAGE). Actuals are computed from workouts.
create table public.run_plan_weeks (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users on delete cascade,
  week_no            integer not null,
  start_date         date not null,
  end_date           date not null,
  target_km          numeric,
  target_long_run    numeric,
  target_weight_days integer default 3,
  notes              text,
  unique (user_id, week_no)
);

-- ─── RLS: owner-only on every table
do $$
declare t text;
begin
  foreach t in array array['periods','daily_log','activities','workouts','meal_entries','foods','run_plan_weeks'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "owner_all" on public.%I for all to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- ─── daily_summary: everything ΓΕΝΙΚΑ shows for a date, computed (nothing stale is stored)
create view public.daily_summary with (security_invoker = true) as
with days as (
  select user_id, date from public.daily_log
  union select user_id, date from public.meal_entries
  union select user_id, date from public.workouts
),
m as (
  select user_id, date,
         sum(kcal) as kcal, sum(protein) as protein, sum(carbs) as carbs, sum(fat) as fat
  from public.meal_entries group by user_id, date
),
w as (
  select w.user_id, w.date,
         sum(w.distance)     filter (where a.key = 'running')  as run_km,
         sum(w.duration_min) filter (where a.key = 'running')  as run_min,
         max(w.distance)     filter (where a.key = 'running')  as longest_run_km,
         sum(w.distance)     filter (where a.key = 'cycling')  as bike_km,
         sum(w.duration_min) filter (where a.key = 'cycling')  as bike_min,
         sum(w.distance)     filter (where a.key = 'swimming') as swim_m,
         sum(w.duration_min) filter (where a.key = 'swimming') as swim_min,
         sum(w.duration_min) filter (where a.key = 'weights')  as weights_min,
         bool_or(a.key = 'weights')                            as did_weights,
         sum(w.duration_min)                                   as training_min,
         max(w.rpe)                                            as rpe
  from public.workouts w join public.activities a on a.id = w.activity_id
  group by w.user_id, w.date
)
select
  d.user_id, d.date,
  l.weight,
  m.kcal, m.protein, m.carbs, m.fat,
  p.target_intake, p.protein_target,
  coalesce(l.burn_override, p.burn_estimate)            as burned,
  p.target_intake - m.kcal                              as remaining,
  m.kcal - coalesce(l.burn_override, p.burn_estimate)   as deficit,
  l.creatine, l.water, l.alcohol, l.sugar,
  l.sleep_hours, l.sleep_quality, l.energy, l.fatigue, l.resting_hr, l.sleep_hr, l.hrv,
  w.run_km, w.run_min, w.longest_run_km, w.bike_km, w.bike_min, w.swim_m, w.swim_min,
  w.weights_min, coalesce(w.did_weights, false) as did_weights, w.training_min, w.rpe,
  l.active_rest, l.steps, l.injury,
  l.mood, l.anxiety, l.motivation, l.focus, l.hunger, l.sleepiness,
  l.waist, l.chest, l.hips, l.thigh, l.calf, l.glutes, l.arm
from days d
left join public.daily_log l on l.user_id = d.user_id and l.date = d.date
left join m on m.user_id = d.user_id and m.date = d.date
left join w on w.user_id = d.user_id and w.date = d.date
left join public.periods p on p.user_id = d.user_id and d.date between p.start_date and p.end_date;

-- ─── Seed default activities for every new user
create function public.seed_user_defaults() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.activities (user_id, key, name, distance_unit, sort) values
    (new.id, 'running',  'Τρέξιμο',   'km', 1),
    (new.id, 'cycling',  'Ποδήλατο',  'km', 2),
    (new.id, 'swimming', 'Κολύμβηση', 'm',  3),
    (new.id, 'weights',  'Βάρη',      null, 4);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.seed_user_defaults();
