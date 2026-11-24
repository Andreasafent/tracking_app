import { useSearchParams } from 'react-router'
import { DistancesTab } from '../components/progress/Distances'
import { RacesTab } from '../components/progress/Races'
import { StrengthTab } from '../components/progress/Strength'
import { Segmented } from '../components/ui'
import '../styles/pages.css'

type Tab = 'weights' | 'distances' | 'races'
const TABS: { value: Tab; label: string }[] = [
  { value: 'weights', label: 'ΒΑΡΗ' },
  { value: 'distances', label: 'ΑΠΟΣΤΑΣΕΙΣ' },
  { value: 'races', label: 'ΑΓΩΝΕΣ' },
]

/** PROGRESS / PBs: strength logs, distance PBs and races, one tab each. */
export function Progress() {
  // The tab lives in the URL (?tab=) so back/refresh keep it.
  const [params, setParams] = useSearchParams()
  const tab = (TABS.find((t) => t.value === params.get('tab'))?.value ?? 'weights') as Tab

  return (
    <div className="da da-flat">
      <header className="da-top">
        <div>
          <h2 className="da-title">Progress</h2>
          <div className="da-date">βάρη, αποστάσεις, αγώνες</div>
        </div>
      </header>

      <div className="ca-slot">
        <Segmented value={tab} onChange={(v) => setParams({ tab: v }, { replace: true })} options={TABS} />
      </div>

      {tab === 'distances' ? <DistancesTab tabs={null} /> : tab === 'races' ? <RacesTab tabs={null} /> : <StrengthTab tabs={null} />}
    </div>
  )
}
