import { useEffect } from 'react'
import { Avatar, Sigil } from './Cult'
import { nameOf } from '../lib/format'

export function Header({ party, boardOpen, unvoted, onToggleBoard, onIdentity }) {
  const { info, players, me, ready, connected, locked } = party
  const name = info?.name || 'The Halloween Conclave'
  const meta = [info?.when, info?.where].filter(Boolean).join(' · ')
  const joined = !!players[me]

  useEffect(() => { document.title = `${name} · The WM Cult` }, [name])

  return (
    <header className="masthead">
      <Sigil className="masthead-sigil" />
      <div className="masthead-title">
        <p className="eyebrow">The WM Cult {!connected && ready && <span className="offline">· reconnecting…</span>}</p>
        <h1>{name}</h1>
        {meta && <p className="meta">{meta}</p>}
      </div>
      <div className="masthead-actions">
        <button type="button" className={`board-toggle${boardOpen ? ' open' : ''}`} onClick={onToggleBoard} aria-expanded={boardOpen} aria-controls="board-panel" aria-label="Notices and votes">
          <span className="board-label">Board</span>
          {unvoted > 0 && <span className="badge" aria-label={`${unvoted} things waiting for your answer`}>{unvoted}</span>}
          <svg className="chevron" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 4.5 L6 8.5 L10 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
        </button>
        {joined ? (
          <button type="button" className="me-btn" onClick={onIdentity} aria-label={`You are ${nameOf(players, me)}. Change your name, familiar or robe`}>
            <Avatar player={players[me]} size="sm" />
            <span className="me-name">{nameOf(players, me)}</span>
          </button>
        ) : ready && connected && !locked ? (
          <button type="button" className="btn primary join-btn" onClick={onIdentity}>Take a seat</button>
        ) : null}
      </div>
    </header>
  )
}
