import { useEffect, useMemo, useState } from 'react'
import { Avatar, AvatarStack } from './Avatar'
import { VoteButtons } from './VoteButtons'
import { IDEAS } from '../lib/constants'
import { nameOf, ranked, tally } from '../lib/format'

export function Activities({ party, canAdd, onPropose, onVote, onRemove }) {
  const { activities, votes, players, me, ready, locked, connected, isAdmin } = party
  const [text, setText] = useState('')
  const [armed, setArmed] = useState(null) // activity id waiting for a second tap to remove

  const counts = useMemo(() => tally(activities, votes), [activities, votes])
  const list = useMemo(() => ranked(activities, counts), [activities, counts])
  const listed = new Set(activities.map(a => a.title.toLowerCase()))
  const spare = IDEAS.filter(i => !listed.has(i.toLowerCase())).slice(0, 6)

  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(null), 3000)
    return () => clearTimeout(t)
  }, [armed])

  async function submit(e) {
    e.preventDefault()
    const raw = text
    if (!raw.trim()) return
    setText('')
    if (!(await onPropose(raw))) setText(current => current || raw)
  }

  function remove(a) {
    if (armed === a.id) { setArmed(null); onRemove(a.id) } else setArmed(a.id)
  }

  return (
    <section className="pane" id="pane-vote" aria-label="Vote on activities">
      <div className="pane-head"><h2>Activities</h2><span className="sub">Ranked by go minus no-go</span></div>
      <div className="pane-body">
        {canAdd && (
          <form className="add" onSubmit={submit} autoComplete="off">
            <input className="field" id="actInput" maxLength={80} placeholder="Propose an activity" aria-label="New activity"
              value={text} onChange={e => setText(e.target.value)} />
            <button className="btn" type="submit">Add</button>
          </form>
        )}
        {canAdd && activities.length < 4 && spare.length > 0 && (
          <div className="ideas">
            <span className="ideas-label">Quick ideas, tap to propose:</span>
            {spare.map(i => <button key={i} type="button" className="chip" onClick={() => onPropose(i)}>{i}</button>)}
          </div>
        )}
        <ol className="acts">
          {!ready && <li className="empty">{locked ? 'Enter the passcode to see the activities.' : 'Loading activities…'}</li>}
          {ready && !activities.length && <li className="empty">Nothing proposed yet. Add the first idea above, or use /idea in the chat.</li>}
          {ready && list.map((a, i) => {
            const c = counts[a.id]
            const total = c.go.length + c.nogo.length
            const leading = i === 0 && c.go.length > c.nogo.length
            const canRemove = connected && (a.pid === me || isAdmin)
            return (
              <li key={a.id} className={`act${leading ? ' leading' : ''}`}>
                <span className="rank">#{i + 1}</span>
                <div className="act-main">
                  <div className="act-title">
                    <span>{a.title}</span>
                    {leading && <span className="lead-chip">Leading</span>}
                  </div>
                  <div className="act-by"><Avatar player={players[a.pid]} size="xs" /><span>proposed by {nameOf(players, a.pid)}</span></div>
                  {total > 0 && (
                    <div className="bar" aria-hidden="true">
                      <span className="g" style={{ width: `${(100 * c.go.length) / total}%` }} />
                      <span className="n" style={{ width: `${(100 * c.nogo.length) / total}%` }} />
                    </div>
                  )}
                </div>
                {canRemove && (
                  <button type="button" className={`del${armed === a.id ? ' armed' : ''}`} onClick={() => remove(a)} aria-label={`Remove ${a.title}`}>
                    {armed === a.id ? 'Tap again' : 'Remove'}
                  </button>
                )}
                <div className="act-votes">
                  <VoteButtons aid={a.id} count={c} mine={votes[me]?.[a.id] || 0} disabled={!connected} onVote={onVote} />
                  <AvatarStack ids={c.go} players={players} title={c.go.map(id => nameOf(players, id)).join(', ')} />
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
