import { Fragment, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Avatar } from './Cult'
import { VoteButtons } from './VoteButtons'
import { dayLabel, nameOf, sameDay, tally, timeLabel } from '../lib/format'

const GROUP_GAP = 5 * 60 * 1000 // messages closer than this from one person are grouped

export function Chat({ party, notice, onSend, onVote, onTyping }) {
  const { messages, players, activities, votes, me, typing, ready, locked, connected } = party
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
  }, [messages, votes])

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
        <span className="sub">the chat</span>
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

            if (m.kind === 'join') {
              return (
                <Fragment key={m.id}>
                  {day}
                  <div className="event"><Avatar player={players[m.pid]} size="xs" /><span>{nameOf(players, m.pid)} took a seat at the table</span></div>
                </Fragment>
              )
            }
            if (m.kind === 'suggest') {
              const a = byId.get(m.aid)
              return (
                <Fragment key={m.id}>
                  {day}
                  <div className="suggest">
                    <div className="suggest-head">
                      <Avatar player={players[m.pid]} size="xs" />
                      <span>{nameOf(players, m.pid)} proposed a rite · {timeLabel(m.ts)}</span>
                    </div>
                    <div className="suggest-title">{a ? a.title : m.text}</div>
                    {a
                      ? <VoteButtons aid={a.id} count={counts[a.id]} mine={votes[me]?.[a.id] || 0} disabled={!connected} onVote={onVote} />
                      : <div className="suggest-gone">Struck from the book</div>}
                  </div>
                </Fragment>
              )
            }
            const mine = m.pid === me
            const grouped = !newDay && prev?.kind === 'msg' && prev.pid === m.pid && m.ts - prev.ts < GROUP_GAP
            return (
              <Fragment key={m.id}>
                {day}
                <div className={`msg${mine ? ' mine' : ''}${grouped ? ' cont' : ''}`}>
                  <div className="gutter">{!grouped && <Avatar player={players[m.pid]} size="sm" />}</div>
                  <div className="body">
                    {!grouped && (
                      <div className="head">
                        {!mine && <span className="who">{nameOf(players, m.pid)}</span>}
                        <span className="time">{timeLabel(m.ts)}</span>
                      </div>
                    )}
                    <div className="bubble">{m.text}</div>
                  </div>
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
          <button className="btn primary" type="submit">Send</button>
        </form>
      )}
    </section>
  )
}
