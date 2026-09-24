import { useSearchParams } from 'react-router'
import { today, type ISODate } from './dates'

/** The selected day lives in the URL (?d=YYYY-MM-DD) so it survives reloads and links between pages. */
export function useDateParam(): [ISODate, (d: ISODate) => void] {
  const [params, setParams] = useSearchParams()
  const d = params.get('d')
  const date = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : today()
  const setDate = (next: ISODate) =>
    setParams(
      (p) => {
        if (next === today()) p.delete('d')
        else p.set('d', next)
        return p
      },
      { replace: true },
    )
  return [date, setDate]
}
