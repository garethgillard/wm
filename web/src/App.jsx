import { useCallback, useEffect, useRef, useState } from 'react'
import { DEMO, useParty } from './lib/useParty'
import { DEMO_ADMIN_CODE } from './lib/demoServer'
import { errorText, nameOf } from './lib/format'
import { Avatar, SvgDefs } from './components/Cult'
import { Header } from './components/Header'
import { Chat } from './components/Chat'
import { RitualTable } from './components/RitualTable'
import { Board } from './components/Board'
import { InfoSheet, JoinSheet, OrganiserSheet, PasscodeSheet } from './components/Sheets'

function useMedia(query) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setMatch(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return match
}

function useToast() {
  const [message, setMessage] = useState('')
  const timer = useRef(0)
  const show = useCallback(text => {
    setMessage(text)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setMessage(''), 3400)
  }, [])
  return [message, show]
}

// Everyone at the table, those here now first.
function RollCall({ party }) {
  const { players, online, me } = party
  const ids = Object.keys(players).sort((a, b) =>
    (online.includes(b) - online.includes(a)) || nameOf(players, a).localeCompare(nameOf(players, b)))
  if (!ids.length) return null
  return (
    <section className="rollcall" aria-label="Members">
      <h3 className="section-title">The faithful</h3>
      <ul>
        {ids.map(id => (
          <li key={id} className={online.includes(id) ? 'here' : 'away'}>
            <Avatar player={players[id]} size="xs" />
            <span className="nm">{nameOf(players, id)}</span>
            {id === me && <span className="you">You</span>}
            <span className="presence">{online.includes(id) ? 'here' : 'away'}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function App() {
  const [party, actions] = useParty()
  const [sheet, setSheet] = useState(null) // 'join' | 'info' | 'organiser'
  const [boardOpen, setBoardOpen] = useState(false)
  const [toast, showToast] = useToast()
  const narrow = useMedia('(max-width: 759px)')
  const prompted = useRef(false)

  const { ready, connected, locked, me, players, activities, votes } = party
  const joined = !!(me && players[me])
  const unvoted = joined ? activities.filter(a => !votes[me]?.[a.id]).length : 0

  // Ask newcomers to take their vows once, as soon as the data has loaded.
  useEffect(() => {
    if (ready && connected && !joined && !prompted.current) { prompted.current = true; setSheet('join') }
  }, [ready, connected, joined])

  useEffect(() => {
    if (!narrow || !boardOpen) return
    const onKey = e => { if (e.key === 'Escape') setBoardOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [narrow, boardOpen])

  // Everything that writes goes through here first.
  function canAct() {
    if (!ready || !connected) { showToast("You're offline. Reconnecting…"); return false }
    if (!joined) { setSheet('join'); return false }
    return true
  }

  async function propose(raw) {
    const title = String(raw).trim().replace(/\s+/g, ' ').slice(0, 80)
    if (!title || !canAct()) return false
    const dup = activities.find(a => a.title.toLowerCase() === title.toLowerCase())
    if (dup) { showToast(errorText({ error: 'duplicate', title: dup.title })); return false }
    try { await actions.propose(title); return true } catch (e) { showToast(errorText(e)); return false }
  }

  async function send(text) {
    if (!canAct()) throw new Error('not ready')
    const idea = text.match(/^\/(?:idea|rite)\s+(.+)/i)
    if (idea) { if (!(await propose(idea[1]))) throw new Error('not added'); return }
    try { await actions.say(text.slice(0, 500)) } catch (e) { showToast(errorText(e)); throw e }
  }

  const vote = (aid, v) => { if (canAct()) actions.vote(aid, v).catch(e => showToast(errorText(e))) }
  const removeIdea = id => actions.removeIdea(id).catch(e => showToast(errorText(e)))
  const removeNotice = id => actions.removeNotice(id).catch(e => showToast(errorText(e)))
  async function addNotice(text) {
    try { await actions.addNotice(text.trim().slice(0, 200)); return true } catch (e) { showToast(errorText(e)); return false }
  }

  let notice = null
  if (locked) notice = 'Speak the password to enter.'
  else if (!ready) notice = 'Lighting the candles…'
  else if (!connected) notice = 'Reconnecting… you can whisper again once you are back.'
  else if (!joined) notice = <button type="button" className="btn primary" onClick={() => setSheet('join')}>Take your vows to join the whispers</button>

  return (
    <div className={`app${boardOpen ? ' board-open' : ''}`}>
      <SvgDefs />
      {DEMO && (
        <div className="demo-bar">
          <span><strong>Demo.</strong> Everyone else is simulated. Organiser code <code>{DEMO_ADMIN_CODE}</code></span>
          <button type="button" className="linkbtn" onClick={() => { actions.resetDemo(); prompted.current = false }}>Reset demo</button>
        </div>
      )}
      <Header party={party} boardOpen={boardOpen} unvoted={unvoted}
        onToggleBoard={() => setBoardOpen(o => !o)} onIdentity={() => setSheet('join')} />

      <main className="chamber">
        <Chat party={party} notice={notice} onSend={send} onVote={vote} onTyping={actions.typing} />
        <section className="panel circle" aria-label="The ritual table">
          <RitualTable party={party} />
          {!narrow && <RollCall party={party} />}
        </section>
        <div className="board-wrap" id="board-panel">
          <Board party={party} canPropose={!notice} onPropose={propose} onVote={vote} onRemove={removeIdea}
            onEditInfo={() => setSheet('info')} onAddNotice={addNotice} onRemoveNotice={removeNotice}
            onOrganiser={() => setSheet('organiser')}
            onLeaveOrganiser={() => { actions.leaveAdmin(); showToast('Organiser mode is off') }}
            onClose={narrow ? () => setBoardOpen(false) : null} />
          {narrow && <RollCall party={party} />}
        </div>
        {narrow && boardOpen && <button type="button" className="board-scrim" aria-label="Close the notice board" onClick={() => setBoardOpen(false)} />}
      </main>

      {sheet === 'join' && ready && (
        <JoinSheet current={players[me]} players={players} me={me} onSave={actions.join} onClose={() => setSheet(null)} />
      )}
      {sheet === 'info' && (
        <InfoSheet info={party.info} onSave={async info => { await actions.saveInfo(info); showToast('The summons is updated') }} onClose={() => setSheet(null)} />
      )}
      {sheet === 'organiser' && (
        <OrganiserSheet hint={DEMO ? `In the demo the code is "${DEMO_ADMIN_CODE}".` : null}
          onUnlock={async code => { await actions.unlockAdmin(code); showToast('Organiser mode is on') }} onClose={() => setSheet(null)} />
      )}
      {locked && <PasscodeSheet wrong={party.passWrong} onSubmit={actions.enterPasscode} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}
