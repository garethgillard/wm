import { useMemo } from 'react'
import { Avatar } from './Avatar'
import { nameOf, tally } from '../lib/format'

export function Crew({ party, onOrganiser, onLeaveOrganiser }) {
  const { players, online, activities, votes, me, ready, hasAdmin, isAdmin } = party
  const counts = useMemo(() => tally(activities, votes), [activities, votes])
  const ids = Object.keys(players).sort((a, b) =>
    (online.includes(b) - online.includes(a)) || nameOf(players, a).localeCompare(nameOf(players, b)))
  const hereNow = ids.filter(id => online.includes(id)).length

  return (
    <section className="pane" id="pane-crew" aria-label="Crew">
      <div className="pane-head">
        <h2>Crew <span className="count">{ids.length}</span></h2>
        <span className="sub">{ready ? `${hereNow} here now` : ''}</span>
      </div>
      <div className="pane-body">
        <ul className="crew-list">
          {!ids.length && (
            <li className="empty">{ready ? 'No one has joined yet. Pick your codename and send the link around.' : 'Loading the crew…'}</li>
          )}
          {ids.map(id => {
            const picks = Object.entries(votes[id] || {}).filter(([aid]) => counts[aid])
            const go = picks.filter(([, v]) => v === 1).length
            const nogo = picks.filter(([, v]) => v === -1).length
            return (
              <li key={id} className="crew-row">
                <span className="av-wrap">
                  <Avatar player={players[id]} size="md" />
                  {online.includes(id) && <span className="dot" title="Here now" />}
                </span>
                <span className="crew-main">
                  <span className="crew-name">
                    <span className="nm">{nameOf(players, id)}</span>
                    {id === me && <span className="you">You</span>}
                  </span>
                  <span className="crew-sub">{go} go · {nogo} no-go</span>
                </span>
              </li>
            )
          })}
        </ul>
        {ready && hasAdmin && (
          <div className="organiser">
            {isAdmin ? (
              <>
                <span><strong>Organiser mode is on.</strong> You can edit details and remove any activity.</span>
                <button type="button" className="linkbtn" onClick={onLeaveOrganiser}>Turn off</button>
              </>
            ) : (
              <>
                <span>Organising this party?</span>
                <button type="button" className="linkbtn" onClick={onOrganiser}>Enter organiser code</button>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
