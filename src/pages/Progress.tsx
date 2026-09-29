import { useSearchParams } from 'react-router'
import { DistancesTab } from '../components/progress/Distances'
import { RacesTab } from '../components/progress/Races'
import { StrengthTab } from '../components/progress/Strength'
import { Segmented } from '../components/ui'

type Tab = 'weights' | 'distances' | 'races'
const TABS: { value: Tab; label: string }[] = [
  { value: 'weights', label: 'ΒΑΡΗ' },
  { value: 'distances', label: 'ΑΠΟΣΤΑΣΕΙΣ' },
  { value: 'races', label: 'ΑΓΩΝΕΣ' },
]

export function Progress() {
  // The tab lives in the URL (?tab=) so back/refresh keep it.
  const [params, setParams] = useSearchParams()
  const tab = (TABS.find((t) => t.value === params.get('tab'))?.value ?? 'weights') as Tab
  const tabs = (
    <div className="mx-auto max-w-sm">
      <Segmented value={tab} onChange={(v) => setParams({ tab: v }, { replace: true })} options={TABS} />
    </div>
  )

  if (tab === 'distances') return <DistancesTab tabs={tabs} />
  if (tab === 'races') return <RacesTab tabs={tabs} />
  return <StrengthTab tabs={tabs} />
}
