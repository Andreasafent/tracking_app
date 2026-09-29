-- Triathlon: a pb_distance with sport 'triathlon' is a format (Sprint, Olympic, ...) whose
-- `legs` are { swim, bike, run } in meters; `meters` is their sum. A triathlon effort keeps
-- `splits` { swim, t1, bike, t2, run } in seconds, and time_sec is the total.
alter table public.pb_distances
  add column sport text not null default 'run' check (sport in ('run', 'triathlon')),
  add column legs  jsonb;

alter table public.distance_efforts
  add column splits jsonb;
