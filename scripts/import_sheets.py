"""
One-off import of the Google Sheet HTML exports (sheet-export/) into Supabase.

    python scripts/import_sheets.py <user-uuid>

Writes scripts/out/import.sql (gitignored — it contains personal data).
Run it once against the project after the user's first sign-up.
"""

import re
import sys
from datetime import date
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "sheet-export"
OUT = ROOT / "scripts" / "out"
TODAY = date.today()


class Grid(HTMLParser):
    """Collects <td> text per <tr> (header <th> cells are skipped)."""

    def __init__(self):
        super().__init__()
        self.rows, self.row, self.cell = [], None, None

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self.row = []
        elif tag == "td":
            self.cell = ""

    def handle_endtag(self, tag):
        if tag == "td" and self.row is not None:
            self.row.append(self.cell.strip().replace("​", ""))
            self.cell = None
        elif tag == "tr" and self.row is not None:
            self.rows.append(self.row)
            self.row = None

    def handle_data(self, data):
        if self.cell is not None:
            self.cell += data


def grid(name):
    g = Grid()
    g.feed((SRC / f"{name}.html").read_text(encoding="utf-8"))
    return g.rows


def dmy(s):
    m = re.fullmatch(r"(\d{1,2})/(\d{1,2})/(\d{4})", s.strip())
    return date(int(m[3]), int(m[2]), int(m[1])) if m else None


def n(s):
    s = (s or "").strip().replace(",", ".")  # the sheet uses Greek decimal commas, no thousands separators
    if s in ("", "-"):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def b(s):
    return {"ΝΑΙ": True, "ΟΧΙ": False}.get((s or "").strip())


def sql(v):
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return repr(int(v)) if float(v).is_integer() else repr(v)
    if isinstance(v, date):
        return f"'{v.isoformat()}'"
    return "'" + str(v).replace("'", "''") + "'"


def main(uid):
    OUT.mkdir(parents=True, exist_ok=True)
    U = sql(uid)
    stmts = []
    report = {}

    # ─── Periods (MACROS target 2700 until the NEW PLAN phases start; burn 2950 as the flat recent value)
    periods = [
        ("Αρχικό (MACROS 2700)", date(2026, 1, 1), date(2026, 9, 20), 2700, 2950),
        ("SEP 21 - SEP 27", date(2026, 9, 21), date(2026, 9, 27), 2900, 2900),
        ("SEP 28 - OCT 25", date(2026, 9, 28), date(2026, 10, 25), 3000, 3300),
        ("OCT 26 - NOV 8", date(2026, 10, 26), date(2026, 11, 8), 2950, 3050),
        ("NOV 9 - 22", date(2026, 11, 9), date(2026, 11, 22), 2850, 2850),
        ("NOV 23 - MAR 15", date(2026, 11, 23), date(2027, 3, 15), 2600, 2880),
        ("MAR 16 - JULY 15", date(2027, 3, 16), date(2027, 7, 15), 2300, 2780),
    ]
    for label, s, e, t, burn in periods:
        stmts.append(
            "insert into periods (user_id,label,start_date,end_date,target_intake,burn_estimate,protein_target) "
            f"values ({U},{sql(label)},{sql(s)},{sql(e)},{t},{burn},180);"
        )

    # ─── ΓΕΝΙΚΑ → daily_log + workouts
    act = lambda key: f"(select id from activities where user_id={U} and key='{key}')"  # noqa: E731
    genika_kcal = {}
    logs = workouts = dropped_rpe = overrides = 0
    for r in grid("ΓΕΝΙΚΑ"):
        d = dmy(r[0]) if r else None
        if not d or d > TODAY or len(r) < 46:
            continue
        c = r
        genika_kcal[d] = n(c[3])
        period_burn = next(p[4] for p in periods if p[1] <= d <= p[2])
        burned = n(c[5])
        burn_override = int(burned) if burned is not None and burned != period_burn else None
        overrides += burn_override is not None
        log = {
            "weight": n(c[2]), "burn_override": burn_override,
            "creatine": b(c[10]), "water": n(c[11]), "alcohol": b(c[12]), "sugar": b(c[13]),
            "sleep_hours": n(c[14]), "sleep_quality": n(c[15]), "energy": n(c[16]), "fatigue": n(c[17]),
            "resting_hr": n(c[18]), "sleep_hr": n(c[19]), "hrv": n(c[20]),
            "active_rest": b(c[29]), "steps": n(c[31]), "injury": b(c[32]),
            "mood": n(c[33]), "anxiety": n(c[34]), "motivation": n(c[35]), "focus": n(c[36]),
            "hunger": n(c[37]), "sleepiness": n(c[38]),
            "waist": n(c[39]), "chest": n(c[40]), "hips": n(c[41]), "thigh": n(c[42]),
            "calf": n(c[43]), "glutes": n(c[44]), "arm": n(c[45]),
        }
        for k in ("resting_hr", "sleep_hr", "hrv", "steps"):
            if log[k] is not None:
                log[k] = int(round(log[k]))
        if any(v is not None for v in log.values()):
            cols = ",".join(log)
            vals = ",".join(sql(v) for v in log.values())
            stmts.append(f"insert into daily_log (user_id,date,{cols}) values ({U},{sql(d)},{vals});")
            logs += 1

        rpe = n(c[30])
        sessions = []
        if n(c[21]) is not None or n(c[22]) is not None:
            sessions.append(("running", n(c[21]), n(c[22])))
        if n(c[23]) is not None or n(c[24]) is not None:
            sessions.append(("cycling", n(c[23]), n(c[24])))
        if n(c[25]) is not None or n(c[26]) is not None:
            sessions.append(("swimming", n(c[25]), n(c[26])))
        if b(c[27]) or n(c[28]) is not None:
            sessions.append(("weights", None, n(c[28])))
        for key, dist, mins in sessions:
            stmts.append(
                "insert into workouts (user_id,date,activity_id,distance,duration_min,rpe) "
                f"values ({U},{sql(d)},{act(key)},{sql(dist)},{sql(mins)},{sql(rpe)});"
            )
            workouts += 1
        if rpe is not None and not sessions:
            dropped_rpe += 1
    report.update(daily_logs=logs, workouts=workouts, burn_overrides=overrides, rpe_days_without_workout=dropped_rpe)

    # ─── MACROS → meal_entries (snack 1 / snack 2 become separate snack entries)
    slots = ["breakfast", "lunch", "dinner", "snack", "snack"]
    meals = mismatched = 0
    for r in grid("MACROS"):
        d = dmy(r[0]) if r else None
        if not d or d > TODAY:
            continue
        r = r + [""] * (31 - len(r))
        entries = []
        for i, slot in enumerate(slots):
            kcal, prot, carbs, fat = n(r[2 + i]), n(r[10 + i]), n(r[18 + i]), n(r[25 + i])
            if all(v is None for v in (kcal, prot, carbs, fat)):
                continue
            entries.append({"slot": slot, "name": None, "kcal": kcal or 0, "p": prot, "c": carbs, "f": fat})
        kcal_total = sum(e["kcal"] for e in entries)
        g = genika_kcal.get(d)
        if g is not None and kcal_total == 0:
            # Some days only have the calorie total typed straight into ΓΕΝΙΚΑ (no per-meal breakdown).
            # Put it on the day's macro-only entry if there is one, otherwise add a single entry.
            if entries:
                entries[0].update(kcal=g, name="Σύνολο ημέρας (χωρίς ανάλυση)")
            else:
                entries.append({"slot": "lunch", "name": "Σύνολο ημέρας (χωρίς ανάλυση)", "kcal": g, "p": None, "c": None, "f": None})
            kcal_total = g
        for e in entries:
            stmts.append(
                "insert into meal_entries (user_id,date,slot,name,kcal,protein,carbs,fat) "
                f"values ({U},{sql(d)},'{e['slot']}',{sql(e['name'])},{sql(e['kcal'])},{sql(e['p'])},{sql(e['c'])},{sql(e['f'])});"
            )
            meals += 1
        if g is not None and abs(g - kcal_total) > 0.5:
            mismatched += 1
            print(f"  kcal mismatch {d}: ΓΕΝΙΚΑ {g} vs MACROS meals {kcal_total}")
    report.update(meal_entries=meals, kcal_mismatch_days=mismatched)

    # ─── CALCULATOR → foods (the table on the right: name, kcal, P, C, F, iron, Ω3, per)
    foods = {}
    for r in grid("CALCULATOR"):
        if len(r) < 8:
            continue
        name, kcal, p, c, f, iron, o3, per = r[-8:]
        if per not in ("100", "1") or not name or n(name) is not None or n(kcal) is None:
            continue
        unit = "g" if per == "100" or name == "Ελαιόλαδο" else "piece"
        foods[name] = (n(kcal), n(p) or 0, n(c) or 0, n(f) or 0, n(iron), n(o3), float(per), unit)
    for name, (kcal, p, c, f, iron, o3, per, unit) in foods.items():
        stmts.append(
            "insert into foods (user_id,name,kcal,protein,carbs,fat,iron,omega3,per_amount,unit) "
            f"values ({U},{sql(name)},{sql(kcal)},{sql(p)},{sql(c)},{sql(f)},{sql(iron)},{sql(o3)},{sql(per)},'{unit}');"
        )
    report["foods"] = len(foods)

    # ─── KMAGE → run_plan_weeks ("actual /target" cells: keep the target)
    target = lambda s: n(s.split("/")[-1]) if "/" in s else None  # noqa: E731
    weeks = 0
    for r in grid("KMAGE"):
        if len(r) < 7 or not r[0].isdigit():
            continue
        stmts.append(
            "insert into run_plan_weeks (user_id,week_no,start_date,end_date,target_km,target_long_run,target_weight_days,notes) "
            f"values ({U},{int(r[0])},{sql(dmy(r[1]))},{sql(dmy(r[2]))},{sql(target(r[3]))},{sql(target(r[4]))},"
            f"{sql(int(target(r[5]) or 3))},{sql(r[6] or None)});"
        )
        weeks += 1
    report["run_plan_weeks"] = weeks

    (OUT / "import.sql").write_text("begin;\n" + "\n".join(stmts) + "\ncommit;\n", encoding="utf-8")
    print(report)
    print(f"{len(stmts)} statements -> {OUT / 'import.sql'}")
    write_compact(uid, stmts)


def write_compact(uid, stmts, limit=45_000):
    """Same data as import.sql, grouped into multi-row inserts and split into chunks
    small enough to run one at a time. Each chunk sets auth.uid() for its transaction,
    so user_id comes from the column default instead of being repeated on every row."""
    pat = re.compile(r"insert into (\w+) \(user_id,([^)]*)\) values \('[^']+',(.*)\);$")
    groups = {}
    for st in stmts:
        m = pat.match(st)
        groups.setdefault((m[1], m[2]), []).append("(" + m[3].replace(f"'{uid}'", "auth.uid()") + ")")

    head = "begin;select set_config('request.jwt.claims','{\"sub\":\"" + uid + "\"}',true);"
    chunks, cur, size = [], [], 0
    for (table, cols), rows in groups.items():
        while rows:
            batch = []
            while rows and size < limit:
                batch.append(rows.pop(0))
                size += len(batch[-1])
            cur.append(f"insert into {table} ({cols}) values\n" + ",\n".join(batch) + ";")
            if size >= limit:
                chunks.append(cur)
                cur, size = [], 0
    if cur:
        chunks.append(cur)
    for i, c in enumerate(chunks, 1):
        (OUT / f"chunk{i}.sql").write_text(head + "\n" + "\n".join(c) + "\ncommit;\n", encoding="utf-8")
    print(f"{len(chunks)} compact chunks")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "00000000-0000-0000-0000-000000000000")
