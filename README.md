# Tracking

Personal daily tracker (nutrition, recovery, training, mood) that replaces a Google Sheet.

- **Frontend:** Vite + React + TypeScript, Tailwind v4, TanStack Query, Recharts, PWA
- **Backend:** Supabase (Postgres + Auth + RLS). Schema in `supabase/migrations/`
- **Hosting:** Vercel (SPA rewrite in `vercel.json`)

## Develop

```bash
npm install
npm run dev
```

Needs `.env.local`:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

## Data model

| Table | Replaces |
|---|---|
| `daily_log` | ΓΕΝΙΚΑ inputs (one row per day) |
| `meal_entries` | MACROS (any number of entries per slot; snacks are dynamic) |
| `workouts` + `activities` | ΓΥΜΝΑΣΤΙΚΗ sessions |
| `periods` | MACROS target, Cals BURNED, NEW PLAN (non-overlapping date ranges) |
| `foods` | CALCULATOR food list |
| `run_plan_weeks` | KMAGE |

`daily_summary` (view) derives totals, remaining, deficit and per-activity numbers; weekly/monthly stats are computed client-side from it (`src/lib/stats.ts`).

Weeks: stats use Thursday–Wednesday weeks, KMAGE uses its own dates, monthly stats use 7-day blocks from the 1st.

## Importing the sheet

Put the sheet's HTML export in `sheet-export/` (gitignored), then `python scripts/import_sheets.py <user-uuid>` and run `scripts/out/import.sql` against the database.
