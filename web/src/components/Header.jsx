import { useEffect } from 'react'
import { Avatar, AvatarStack } from './Avatar'
import { nameOf } from '../lib/format'

export function Header({ party, onEditInfo, onIdentity }) {
  const { info, players, me, ready, connected, locked, online, isAdmin } = party
  const name = info?.name || 'Work party'
  const meta = [info?.when, info?.where].filter(Boolean).join(' · ') || 'Date and place to be decided'
  const crew = Object.keys(players)
  const here = crew.filter(id => online.includes(id))
  const joined = !!players[me]

  useEffect(() => { document.title = `${name} · Party HQ` }, [name])

  let status
  if (locked) status = <span>Invite only</span>
  else if (!ready) status = <span>Connecting…</span>
  else if (!connected) status = <><span className="status-dot" /><span>Reconnecting…</span></>
  else if (!crew.length) status = <span>No one has joined yet</span>
  else status = <><AvatarStack ids={here} players={players} /><span>{here.length} here now · {crew.length} in the crew</span></>

  return (
    <header className="brief">
      <div className="brief-top">
        <div className="brief-title">
          <p className="eyebrow"><span>Party HQ</span><span className="stamp">Codenames only</span></p>
          <h1>{name}</h1>
          <div className="meta-row">
            <p className="meta">{meta}</p>
            {isAdmin && ready && <button type="button" className="linkbtn" onClick={onEditInfo}>Edit details</button>}
          </div>
        </div>
        {joined && (
          <button type="button" className="me-btn" onClick={onIdentity} aria-label={`You are ${nameOf(players, me)}. Change codename or avatar`}>
            <Avatar player={players[me]} size="sm" />
            <span className="me-name">{nameOf(players, me)}</span>
          </button>
        )}
        {!joined && ready && connected && (
          <button type="button" className="me-btn solo" onClick={onIdentity}>Join</button>
        )}
      </div>
      <div className="online">{status}</div>
    </header>
  )
}
