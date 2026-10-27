// The notice board: the summons (when and where), the organiser's notices, and the rites to vote on.
import { useEffect, useMemo, useState } from 'react'
import { Avatar, AvatarStack } from './Cult'
import { VoteButtons } from './VoteButtons'
import { EditableText } from './EditableText'
import { IDEAS, roman } from '../lib/constants'
import { nameOf, ranked, tally } from '../lib/format'

export function Board({ party, canPropose, onPropose, onVote, onRemove, onRenameIdea, onSaveInfo, onAddNotice, onEditNotice, onRemoveNotice, onOrganiser, onLeaveOrganiser, onClose }) {
  const { info, notices, activities, votes, players, me, ready, locked, connected, isAdmin, hasAdmin } = party
  const organiser = isAdmin && ready && connected // can edit the summons and notices
  const [idea, setIdea] = useState('')
  const [notice, setNotice] = useState('')
  const [armed, setArmed] = useState(null) // id waiting for a second tap to confirm removal

  const counts = useMemo(() => tally(activities, votes), [activities, votes])
  const list = useMemo(() => ranked(activities, counts), [activities, counts])
  const listed = new Set(activities.map(a => a.title.toLowerCase()))
  const spare = IDEAS.filter(i => !listed.has(i.toLowerCase())).slice(0, 5)

  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(null), 3000)
    return () => clearTimeout(t)
  }, [armed])

  const confirm = (id, action) => { if (armed === id) { setArmed(null); action() } else setArmed(id) }

  async function submitIdea(e) {
    e.preventDefault()
    const raw = idea
    if (!raw.trim()) return
    setIdea('')
    if (!(await onPropose(raw))) setIdea(current => current || raw)
  }
  async function submitNotice(e) {
    e.preventDefault()
    const raw = notice
    if (!raw.trim()) return
    setNotice('')
    if (!(await onAddNotice(raw))) setNotice(current => current || raw)
  }

  return (
    <aside className="board" aria-label="Notice board">
      <div className="board-head">
        <h2>The Notice Board</h2>
        {onClose && <button type="button" className="icon-btn" onClick={onClose} aria-label="Close the notice board">✕</button>}
      </div>

      <section className="summons">
        <p className="kicker">You are summoned</p>
        <div className="summons-name" role="heading" aria-level={3}>
          <EditableText value={info?.name || 'The Halloween Conclave'} canEdit={organiser} label="the name of the gathering" maxLength={40}
            onSave={text => onSaveInfo('name', text)} />
        </div>
        <dl>
          <div><dt>When</dt><dd>
            <EditableText value={info?.when} placeholder="To be announced" canEdit={organiser} allowEmpty label="when" maxLength={60}
              onSave={text => onSaveInfo('when', text)} />
          </dd></div>
          <div><dt>Where</dt><dd>
            <EditableText value={info?.where} placeholder="To be revealed" canEdit={organiser} allowEmpty label="where" maxLength={60}
              onSave={text => onSaveInfo('where', text)} />
          </dd></div>
        </dl>
      </section>

      <section className="notices">
        <h3 className="section-title">Notices</h3>
        {ready && !notices.length && <p className="empty">{isAdmin ? 'Post the first notice for the faithful.' : 'No notices from the organiser yet.'}</p>}
        <ul>
          {notices.map(n => (
            <li key={n.id} className="notice">
              <span className="seal" aria-hidden="true" />
              <div className="notice-body"><EditableText value={n.text} canEdit={organiser} multiline label="this notice" maxLength={200}
                onSave={text => onEditNotice(n.id, text)} /></div>
              {isAdmin && (
                <button type="button" className={`del${armed === n.id ? ' armed' : ''}`} onClick={() => confirm(n.id, () => onRemoveNotice(n.id))}>
                  {armed === n.id ? 'Tap again' : 'Remove'}
                </button>
              )}
            </li>
          ))}
        </ul>
        {isAdmin && connected && (
          <form className="add" onSubmit={submitNotice} autoComplete="off">
            <input className="field" id="noticeInput" maxLength={200} placeholder="Post a notice, e.g. Masks on at the door" aria-label="New notice"
              value={notice} onChange={e => setNotice(e.target.value)} />
            <button className="btn" type="submit">Post</button>
          </form>
        )}
      </section>

      <section className="rites">
        <h3 className="section-title">Rites to vote on <span className="sub">ranked by ayes minus nays</span></h3>
        {canPropose && (
          <form className="add" onSubmit={submitIdea} autoComplete="off">
            <input className="field" id="ideaInput" maxLength={80} placeholder="Propose a rite" aria-label="Propose an activity"
              value={idea} onChange={e => setIdea(e.target.value)} />
            <button className="btn" type="submit">Propose</button>
          </form>
        )}
        {canPropose && activities.length < 4 && spare.length > 0 && (
          <div className="ideas">
            <span className="ideas-label">Or tap one:</span>
            {spare.map(i => <button key={i} type="button" className="chip" onClick={() => onPropose(i)}>{i}</button>)}
          </div>
        )}
        <ol className="acts">
          {!ready && <li className="empty">{locked ? 'Speak the password to see the rites.' : 'Opening the book…'}</li>}
          {ready && !activities.length && <li className="empty">No rites proposed yet. Suggest the first one.</li>}
          {ready && list.map((a, i) => {
            const c = counts[a.id]
            const total = c.go.length + c.nogo.length
            const favoured = i === 0 && c.go.length > c.nogo.length
            const canRemove = connected && (a.pid === me || isAdmin)
            return (
              <li key={a.id} className={`act${favoured ? ' favoured' : ''}`}>
                <span className="rank">{roman(i + 1)}</span>
                <div className="act-main">
                  <div className="act-title">
                    <EditableText value={a.title} canEdit={connected && (a.pid === me || isAdmin)} label="this rite" maxLength={80}
                      onSave={title => onRenameIdea(a.id, title)} />
                    {favoured && <span className="lead-chip">Favoured</span>}
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
                  <button type="button" className={`del${armed === a.id ? ' armed' : ''}`} onClick={() => confirm(a.id, () => onRemove(a.id))} aria-label={`Remove ${a.title}`}>
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
      </section>

      {ready && hasAdmin && (
        <footer className="organiser">
          {isAdmin ? (
            <>
              <span><strong>Organiser mode is on.</strong> Tap any text on the board to change it: the summons, notices and rite titles. Changes show for everyone straight away.</span>
              <button type="button" className="linkbtn" onClick={onLeaveOrganiser}>Turn off</button>
            </>
          ) : (
            <>
              <span>Organising this gathering?</span>
              <button type="button" className="linkbtn" onClick={onOrganiser}>Enter organiser code</button>
            </>
          )}
        </footer>
      )}
    </aside>
  )
}
