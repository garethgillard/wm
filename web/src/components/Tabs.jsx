const TABS = [
  { id: 'chat', label: 'Chat' },
  { id: 'vote', label: 'Vote' },
  { id: 'crew', label: 'Crew' },
]

// Only shown on phones; desktop shows everything side by side.
export function Tabs({ tab, onChange, unread, counts }) {
  return (
    <nav className="tabs" role="tablist" aria-label="Sections">
      {TABS.map(t => (
        <button key={t.id} type="button" role="tab" className="tab" aria-selected={tab === t.id} onClick={() => onChange(t.id)}>
          {t.label}
          {t.id === 'chat'
            ? unread > 0 && <span className="badge">{unread > 99 ? '99+' : unread}</span>
            : <span className="count">{counts[t.id]}</span>}
        </button>
      ))}
    </nav>
  )
}
