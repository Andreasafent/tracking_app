-- A day whose meal entries sum to 0 kcal has macros but no calorie data (e.g. Aug 7-9 in the sheet).
-- Treat it as "not logged" so it doesn't pull calorie averages down.
create or replace view public.daily_summary with (security_invoker = true) as
with days as (
  select user_id, date from public.daily_log
  union select user_id, date from public.meal_entries
  union select user_id, date from public.workouts
),
m as (
  select user_id, date,
         nullif(sum(kcal), 0) as kcal, sum(protein) as protein, sum(carbs) as carbs, sum(fat) as fat
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
