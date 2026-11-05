-- PACER: marathon pacing plans (three target scenarios with per-km splits) and recorded runs.

create table public.pacer_plans (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  name       text not null,
  scenarios  jsonb not null,   -- [{label, target_sec, laps: [seconds per km; last = the final 0.195 km]}]
  segments   jsonb not null default '[]',  -- cheat sheet: [{label, paces: [s/km per scenario]}]
  created_at timestamptz not null default now()
);

create table public.pacer_runs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  plan_id    uuid references public.pacer_plans on delete set null,
  run_date   date not null default current_date,
  laps       jsonb not null,   -- [{km, t (seconds since start), est}]
  total_sec  numeric,
  created_at timestamptz not null default now()
);
create index pacer_plans_user on public.pacer_plans (user_id);
create index pacer_runs_user on public.pacer_runs (user_id, run_date);
create index pacer_runs_plan on public.pacer_runs (plan_id);

alter table public.pacer_plans enable row level security;
alter table public.pacer_runs  enable row level security;

create policy "owner_all" on public.pacer_plans for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "owner_all" on public.pacer_runs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

insert into public.pacer_plans (user_id, name, scenarios, segments)
select u.id, 'Μαραθώνιος', '[{"label":"3:50","target_sec":13800,"laps":[320,320,320,321,320,320,320,320,320,320,334,334,333,334,334,333,315,315,345,344,344,344,344,344,344,345,332,333,332,333,333,317,317,317,317,317,318,317,317,317,317,317,62]},{"label":"3:52:30","target_sec":13950,"laps":[324,323,324,323,324,324,323,324,324,323,337,338,337,337,337,338,318,319,348,348,347,348,348,348,348,348,336,336,337,336,336,321,320,321,320,321,321,320,321,320,321,320,63]},{"label":"3:55","target_sec":14100,"laps":[327,327,327,327,327,328,327,327,327,327,341,341,341,340,341,341,322,322,352,351,352,352,351,352,352,351,340,340,340,340,340,324,324,324,324,324,324,324,324,324,324,324,63]}]'::jsonb, '[{"label":"Χλμ 0–10","paces":[320,324,327]},{"label":"10–16","paces":[334,337,341]},{"label":"16–18 (κατηφόρα)","paces":[315,319,322]},{"label":"18–26 (ανηφόρα)","paces":[344,348,352]},{"label":"26–31","paces":[333,336,340]},{"label":"31–τέλος","paces":[317,321,324]}]'::jsonb
from auth.users u;
