import { useEffect } from 'react'
import { Avatar, Sigil } from './Cult'
import { EditableText } from './EditableText'
import { DEFAULT_NAME } from '../lib/constants'
import { nameOf } from '../lib/format'

export function Header({ party, boardOpen, unvoted, onToggleBoard, onIdentity, onSaveName }) {
  const { info, players, me, ready, connected, locked, isAdmin } = party
  const name = info?.name || DEFAULT_NAME
  const joined = !!players[me]

  useEffect(() => { document.title = `${name} · The WM Cult` }, [name])

  return (
    <header className="masthead">
      <div className="lockup">
        <Sigil className="masthead-sigil" title="The WM Cult" />
        <div className="masthead-title">
          <div className="title" role="heading" aria-level={1}>
            <EditableText value={name} canEdit={isAdmin && ready && connected} label="the name of the gathering" maxLength={40} onSave={onSaveName} />
          </div>
          {!connected && ready && <p className="offline">Reconnecting…</p>}
        </div>
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
