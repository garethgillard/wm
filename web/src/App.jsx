import { useCallback, useEffect, useRef, useState } from 'react'
import { DEMO, lsGet, lsSet, useParty } from './lib/useParty'
import { DEMO_ADMIN_CODE } from './lib/demoServer'
import { RSVP, errorText, nameOf } from './lib/format'
import { Avatar, SvgDefs } from './components/Cult'
import { Header } from './components/Header'
import { Chat } from './components/Chat'
import { RitualTable } from './components/RitualTable'
import { Board } from './components/Board'
import { JoinSheet, OrganiserSheet, PasscodeSheet } from './components/Sheets'
import { Landing } from './components/Landing'

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

// Everyone who has joined, grouped by their answer.
const GROUPS = [['yes', 'At the table'], ['maybe', 'In the shadows'], ['none', 'Undecided'], ['no', 'Absent']]
function RollCall({ party }) {
  const { players, online, me } = party
  const ids = Object.keys(players).sort((a, b) =>
    (online.includes(b) - online.includes(a)) || nameOf(players, a).localeCompare(nameOf(players, b)))
  if (!ids.length) return null
  const answer = id => (players[id].rsvp in RSVP ? players[id].rsvp : 'none')
  return (
    <section className="rollcall" aria-label="Members">
      {GROUPS.map(([key, label]) => {
        const group = ids.filter(id => answer(id) === key)
        if (!group.length) return null
        return (
          <div key={key} className={`rollcall-group rsvp-${key}`}>
            <h3 className="section-title">{label} <span className="group-count">{group.length}</span></h3>
            <ul>
              {group.map(id => (
                <li key={id} className={online.includes(id) ? 'here' : 'away'}>
                  <span className="av-wrap">
                    <Avatar player={players[id]} size="xs" />
                    {online.includes(id) && <span className="here-dot" title="Here now" />}
                  </span>
                  <span className="nm">{nameOf(players, id)}</span>
                  {id === me && <span className="you">You</span>}
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </section>
  )
}

export default function App() {
  const [party, actions] = useParty()
  const [sheet, setSheet] = useState(null) // 'join' | 'organiser'
  const [boardOpen, setBoardOpen] = useState(false)
  const [entered, setEntered] = useState(() => lsGet('wm-entered') === '1') // the landing page shows once per browser
  const [toast, showToast] = useToast()
  const narrow = useMedia('(max-width: 759px)')
  const prompted = useRef(false)

  const { ready, connected, locked, me, players, activities, votes } = party
  const joined = !!(me && players[me])
  // Things waiting for you on the board: rites you haven't voted on, and your attendance answer.
  const unvoted = joined ? activities.filter(a => !votes[me]?.[a.id]).length + (players[me].rsvp ? 0 : 1) : 0

  // Ask newcomers to take their vows once they're through the door and the data has loaded.
  useEffect(() => {
    if (entered && ready && connected && !joined && !prompted.current) { prompted.current = true; setSheet('join') }
  }, [entered, ready, connected, joined])

  function enter() { lsSet('wm-entered', '1'); setEntered(true) }

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

  const answer = value => { if (canAct()) actions.rsvp(value).catch(e => showToast(errorText(e))) }
  const vote = (aid, v) => { if (canAct()) actions.vote(aid, v).catch(e => showToast(errorText(e))) }
  const removeIdea = id => actions.removeIdea(id).catch(e => showToast(errorText(e)))
  const removeNotice = id => actions.removeNotice(id).catch(e => showToast(errorText(e)))
  // Inline edits: the edit box shows any error itself, so these just pass the promise back.
  const saveInfo = (field, text) => actions.saveInfo({ ...(party.info || {}), [field]: text })
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
          <button type="button" className="linkbtn" onClick={() => { actions.resetDemo(); prompted.current = false; lsSet('wm-entered', null); setEntered(false) }}>Reset demo</button>
        </div>
      )}
      <Header party={party} boardOpen={boardOpen} unvoted={unvoted} onSaveName={text => saveInfo('name', text)}
        onToggleBoard={() => setBoardOpen(o => !o)} onIdentity={() => setSheet('join')} />

      <main className="chamber">
        <Chat party={party} notice={notice} onSend={send} onVote={vote} onTyping={actions.typing} />
        <section className="panel circle" aria-label="The ritual table">
          <RitualTable party={party} />
          {!narrow && <RollCall party={party} />}
        </section>
        <div className="board-wrap" id="board-panel">
          <Board party={party} canPropose={!notice} onRsvp={answer} onJoin={() => setSheet('join')} onPropose={propose} onVote={vote} onRemove={removeIdea}
            onRenameIdea={actions.renameIdea} onSaveInfo={saveInfo}
            onAddNotice={addNotice} onEditNotice={actions.editNotice} onRemoveNotice={removeNotice}
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
      {sheet === 'organiser' && (
        <OrganiserSheet hint={DEMO ? `In the demo the code is "${DEMO_ADMIN_CODE}".` : null}
          onUnlock={async code => { await actions.unlockAdmin(code); showToast('Organiser mode is on') }} onClose={() => setSheet(null)} />
      )}
      {locked && entered && <PasscodeSheet wrong={party.passWrong} onSubmit={actions.enterPasscode} />}
      {!entered && <Landing onEnter={enter} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}
