import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { REACTION_PICKER, REACTIONS, ROBES } from '../lib/constants'
import { VoteButtons } from './VoteButtons'
import { RSVP, dayLabel, nameOf, sameDay, tally, timeLabel } from '../lib/format'

const GROUP_GAP = 5 * 60 * 1000 // messages closer than this from one person are grouped
const SHOWN = new Set(['msg', 'suggest']) // whispers and proposed rites; joins, leaves and attendance stay off the chat

// Emoji reactions under a whisper: counts people can tap to join in, plus a picker opened from the smiley.
function Reactions({ mid, byE = {}, players, me, open, onOpen, onReact }) {
  // The picker floats above the smiley; near the top of the chat window it opens downwards instead.
  const picker = useRef(null)
  const [down, setDown] = useState(false)
  useLayoutEffect(() => {
    if (!open) { setDown(false); return }
    const el = picker.current
    const feed = el?.closest('.feed')
    if (el && feed && el.getBoundingClientRect().top < feed.getBoundingClientRect().top + 4) setDown(true)
  }, [open])
  const shown = REACTIONS.map((emoji, e) => ({ emoji, e, pids: byE[e] || [] })).filter(r => r.pids.length)
  return (
    <>
      <button type="button" className={`react-add${open ? ' open' : ''}`} onClick={() => onOpen(open ? null : mid)}
        aria-label="React to this whisper" aria-expanded={open}>
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="7.4" cy="8.4" r="1" fill="currentColor" /><circle cx="12.6" cy="8.4" r="1" fill="currentColor" />
          <path d="M6.8 11.6 Q10 14.6 13.2 11.6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>
      {shown.length > 0 && (
        <div className="reactions">
          {shown.map(r => {
            const mine = r.pids.includes(me)
            return (
              <button key={r.e} type="button" className={`react-chip${mine ? ' mine' : ''}`} onClick={() => onReact(mid, r.e, !mine)}
                title={r.pids.map(p => nameOf(players, p)).join(', ')} aria-pressed={mine}
                aria-label={`${r.emoji} ${r.pids.length}${mine ? ', including you' : ''}`}>
                <span className="react-emoji">{r.emoji}</span>{r.pids.length}
              </button>
            )
          })}
        </div>
      )}
      {open && (
        <div className={`react-picker${down ? ' down' : ''}`} ref={picker} role="group" aria-label="Pick a reaction">
          {REACTION_PICKER.map(e => {
            const emoji = REACTIONS[e]
            const mine = (byE[e] || []).includes(me)
            return (
              <button key={e} type="button" className={mine ? 'mine' : ''} aria-pressed={mine}
                onClick={() => { onOpen(null); onReact(mid, e, !mine) }}>{emoji}</button>
            )
          })}
        </div>
      )}
    </>
  )
}

export function Chat({ party, notice, onSend, onVote, onTyping, onDelete, onReact }) {
  const { players, activities, votes, me, typing, ready, locked, connected, isAdmin, reactions } = party
  const [picking, setPicking] = useState(null) // whisper whose reaction picker is open
  useEffect(() => {
    if (!picking) return
    const close = e => { if (e.type === 'keydown' ? e.key === 'Escape' : !e.target.closest('.line')) setPicking(null) }
    document.addEventListener('keydown', close)
    document.addEventListener('pointerdown', close)
    return () => { document.removeEventListener('keydown', close); document.removeEventListener('pointerdown', close) }
  }, [picking])
  const messages = useMemo(() => party.messages.filter(m => SHOWN.has(m.kind)), [party.messages])
  const [armed, setArmed] = useState(null) // whisper waiting for a second tap to delete
  const moderate = isAdmin && connected
  function del(id) {
    if (armed === id) { setArmed(null); onDelete(id) } else { setArmed(id); setTimeout(() => setArmed(a => (a === id ? null : a)), 3000) }
  }
  const [text, setText] = useState('')
  const feed = useRef(null)
  const nearBottom = useRef(true)
  const forceScroll = useRef(true)
  const typingOn = useRef(false)
  const typingTimer = useRef(0)

  const counts = useMemo(() => tally(activities, votes), [activities, votes])
  const byId = useMemo(() => new Map(activities.map(a => [a.id, a])), [activities])

  // Stay pinned to the newest message unless you've scrolled up to read.
  useLayoutEffect(() => {
    const el = feed.current
    if (el && (nearBottom.current || forceScroll.current)) {
      el.scrollTop = el.scrollHeight
      forceScroll.current = false
    }
  }, [messages, votes, reactions])

  function onScroll() {
    const el = feed.current
    nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 90
  }

  function ping(on) {
    clearTimeout(typingTimer.current)
    if (on) {
      typingTimer.current = setTimeout(() => ping(false), 3000)
      if (typingOn.current) return
    } else if (!typingOn.current) return
    typingOn.current = on
    onTyping(on)
  }

  async function submit(e) {
    e.preventDefault()
    const raw = text
    if (!raw.trim()) return
    setText('')
    ping(false)
    forceScroll.current = true
    try {
      await onSend(raw.trim())
    } catch {
      setText(current => current || raw) // put it back so nothing is lost
    }
  }

  const typingNames = typing.filter(id => players[id]).map(id => nameOf(players, id))
  const typingLine = !typingNames.length ? ''
    : typingNames.length === 1 ? `${typingNames[0]} is whispering…`
    : typingNames.length === 2 ? `${typingNames[0]} and ${typingNames[1]} are whispering…`
    : 'Several voices are whispering…'

  return (
    <section className="panel chat" aria-label="Chat">
      <div className="panel-head">
        <h2>Whispers</h2>
      </div>
      <div className="feed" ref={feed} onScroll={onScroll} aria-live="polite">
        {!ready ? (
          <div className="empty-chat">
            <p className="big">{locked ? 'The door is sealed' : 'Lighting the candles…'}</p>
            <p>{locked ? 'Speak the password from the organiser.' : 'Connecting to the chamber.'}</p>
          </div>
        ) : !messages.length ? (
          <div className="empty-chat">
            <p className="big">Silence in the chamber</p>
            <p>Say something, or type <code>/idea</code> and a rite to put it to the vote.</p>
          </div>
        ) : (
          messages.map((m, i) => {
            const prev = messages[i - 1]
            const newDay = !prev || !sameDay(prev.ts, m.ts)
            const day = newDay && <div className="day">{dayLabel(m.ts)}</div>
            const p = players[m.pid]
            const ink = { '--ink': ROBES[p?.color ?? 0].ink }
            const who = <span className="who">{nameOf(players, m.pid)}</span>

            if (m.kind === 'leave' || m.kind === 'kick') {
              return (
                <Fragment key={m.id}>
                  {day}
                  <p className="event-line departed"><span className="who">{m.text}</span> {m.kind === 'kick' ? 'is cast out of the circle' : 'renounces their vows'}</p>
                </Fragment>
              )
            }
            if (m.kind === 'join' || m.kind === 'rsvp') {
              const line = m.kind === 'rsvp' ? RSVP[m.text]?.event
                : m.text === 'yes' ? 'joins and takes a seat'
                : m.text === 'maybe' ? 'joins, lurking in the shadows'
                : m.text === 'no' ? 'joins, but sends regrets'
                : 'joins the circle'
              if (!line) return null
              return (
                <Fragment key={m.id}>
                  {day}
                  <p className="event-line" style={ink}>{who} {line}</p>
                </Fragment>
              )
            }
            if (m.kind === 'suggest') {
              const a = byId.get(m.aid)
              return (
                <Fragment key={m.id}>
                  {day}
                  <div className="rite-line" style={ink}>
                    <p className="event-line">{who} proposes a rite</p>
                    <div className="rite-row">
                      <span className="rite-title">{a ? a.title : m.text}</span>
                      {a
                        ? <VoteButtons compact aid={a.id} count={counts[a.id]} mine={votes[me]?.[a.id] || 0} disabled={!connected} onVote={onVote} />
                        : <span className="rite-gone">struck from the book</span>}
                    </div>
                  </div>
                </Fragment>
              )
            }
            // Plain messages: name in robe colour, a robe-coloured rule down the side of each run.
            const grouped = !newDay && prev?.kind === 'msg' && prev.pid === m.pid && m.ts - prev.ts < GROUP_GAP
            return (
              <Fragment key={m.id}>
                {day}
                <div className={`line${grouped ? ' cont' : ''}${m.pid === me ? ' mine' : ''}`} style={ink}>
                  {!grouped && <div className="line-head">{who}<span className="time">{timeLabel(m.ts)}</span></div>}
                  <p className="line-text">{m.text}</p>
                  <Reactions mid={m.id} byE={reactions[m.id]} players={players} me={me} open={picking === m.id} onOpen={setPicking} onReact={onReact} />
                  {moderate && (
                    <button type="button" className={`mod-del${armed === m.id ? ' armed' : ''}`} onClick={() => del(m.id)} aria-label="Delete this whisper">
                      {armed === m.id ? 'Delete?' : '✕'}
                    </button>
                  )}
                </div>
              </Fragment>
            )
          })
        )}
      </div>
      <div className="typing">{typingLine}</div>
      {notice ? (
        <div className="composer-note">{notice}</div>
      ) : (
        <form className="composer" onSubmit={submit} autoComplete="off">
          <input className="field" id="msgInput" maxLength={500} placeholder="Whisper to the circle…" aria-label="Message"
            value={text} onChange={e => { setText(e.target.value); ping(!!e.target.value.trim()) }} />
          <button className="btn primary" type="submit">Whisper</button>
        </form>
      )}
    </section>
  )
}
