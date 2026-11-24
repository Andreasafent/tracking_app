import type { ReactNode } from 'react'
import '../styles/pages.css'

/** A page header (a light title, a line under it, actions on the right) for pages without a hero of their own. */
export function PageHeader(props: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="da da-flat">
      <header className="da-top">
        <div>
          <h2 className="da-title">{props.title}</h2>
          {props.sub && <div className="da-date">{props.sub}</div>}
        </div>
        {props.actions && <div className="da-nav">{props.actions}</div>}
      </header>
    </div>
  )
}
