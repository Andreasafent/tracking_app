import { num, signed } from './format'
import type { BlockStats } from './stats'

/** The WEEKLY / MONTHLY STATS rows, grouped like the sheet. */
export interface Metric {
  label: string
  value: (s: BlockStats, prev?: BlockStats) => string
  unit?: string
}

const frac = (n: number, s: BlockStats) => `${n}/${s.days}`

export const METRIC_GROUPS: { title: string; metrics: Metric[] }[] = [
  {
    title: 'Nutrition',
    metrics: [
      { label: 'Μ.Ο. βάρους', value: (s) => num(s.weight, 2), unit: 'kg' },
      { label: 'Μεταβολή βάρους', value: (s, p) => signed(s.weight != null && p?.weight != null ? s.weight - p.weight : null, 2), unit: 'kg' },
      { label: 'Μ.Ο. θερμίδων', value: (s) => num(s.kcal, 0) },
      { label: 'Μ.Ο. καμμένων', value: (s) => num(s.burned, 0) },
      { label: 'Μ.Ο. ελλείμματος', value: (s) => signed(s.deficit, 0) },
      { label: 'Μ.Ο. πρωτεΐνης', value: (s) => num(s.protein, 0), unit: 'g' },
      { label: 'Μέρες ≥ στόχο πρωτ.', value: (s) => frac(s.proteinTargetDays, s) },
      { label: 'Μέρες κρεατίνης', value: (s) => frac(s.creatineDays, s) },
      { label: 'Νερό σύνολο', value: (s) => num(s.waterTotal, 2), unit: 'lt' },
      { label: 'Νερό / μέρα', value: (s) => num(s.waterAvg, 2), unit: 'lt' },
      { label: 'Μέρες χωρίς αλκοόλ', value: (s) => frac(s.noAlcoholDays, s) },
      { label: 'Μέρες χωρίς ζάχαρη', value: (s) => frac(s.noSugarDays, s) },
    ],
  },
  {
    title: 'Recovery',
    metrics: [
      { label: 'Ώρες ύπνου', value: (s) => num(s.sleepHours, 2), unit: 'h' },
      { label: 'Ποιότητα ύπνου', value: (s) => num(s.sleepQuality, 1) },
      { label: 'Ενέργεια', value: (s) => num(s.energy, 1) },
      { label: 'Κούραση', value: (s) => num(s.fatigue, 1) },
      { label: 'Resting HR', value: (s) => num(s.restingHr, 1) },
      { label: 'Sleep HR', value: (s) => num(s.sleepHr, 1) },
      { label: 'HRV', value: (s) => num(s.hrv, 0), unit: 'ms' },
    ],
  },
  {
    title: 'Γυμναστική',
    metrics: [
      { label: 'Τρέξιμο', value: (s) => num(s.runKm, 1), unit: 'km' },
      { label: 'Τρέξιμο (min)', value: (s) => num(s.runMin, 0) },
      { label: 'Ποδήλατο', value: (s) => num(s.bikeKm, 1), unit: 'km' },
      { label: 'Ποδήλατο (min)', value: (s) => num(s.bikeMin, 0) },
      { label: 'Κολύμβηση', value: (s) => num(s.swimM, 0), unit: 'm' },
      { label: 'Μέρες βάρη', value: (s) => frac(s.weightsDays, s) },
      { label: 'Ώρες προπόνησης', value: (s) => num(s.trainingMin / 60, 2), unit: 'h' },
      { label: 'Μ.Ο. βημάτων', value: (s) => num(s.steps, 0) },
    ],
  },
  {
    title: 'Mental / Emotional',
    metrics: [
      { label: 'Διάθεση', value: (s) => num(s.mood, 1) },
      { label: 'Άγχος', value: (s) => num(s.anxiety, 1) },
      { label: 'Κίνητρο', value: (s) => num(s.motivation, 1) },
      { label: 'Συγκέντρωση', value: (s) => num(s.focus, 1) },
      { label: 'Πείνα', value: (s) => num(s.hunger, 1) },
      { label: 'Νύστα', value: (s) => num(s.sleepiness, 1) },
    ],
  },
]
