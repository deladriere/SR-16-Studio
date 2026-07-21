import type { ReactNode } from 'react'

interface PanelProps {
  title: string
  className?: string
  actions?: ReactNode
  children: ReactNode
}

export function Panel({ title, className = '', actions, children }: PanelProps) {
  return (
    <section className={`panel ${className}`}>
      <header className="panel__header">
        <h2>{title}</h2>
        {actions && <div className="panel__actions">{actions}</div>}
      </header>
      <div className="panel__body">{children}</div>
    </section>
  )
}
