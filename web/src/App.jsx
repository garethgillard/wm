import { useCallback, useEffect, useRef, useState } from 'react'
import { DEMO, useParty } from './lib/useParty'
import { DEMO_ADMIN_CODE } from './lib/demoServer'
import { errorText } from './lib/format'
import { Header } from './components/Header'
import { Tabs } from './components/Tabs'
import { Chat } from './components/Chat'
import { Activities } from './components/Activities'
import { Crew } from './components/Crew'
import { InfoSheet, JoinSheet, OrganiserSheet, PasscodeSheet } from './components/Sheets'

function useWide() {
  const query = '(min-width: 900px)'
  const [wide, setWide] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setWide(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return wide
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

export default function App() {
  const [party, actions] = useParty()
  const [tab, setTab] = useState('chat')
  const [sheet, setSheet] = useState(null) // 'join' | 'info' | 'organiser'
  const [toast, showToast] = useToast()
  const [lastSeen, setLastSeen] = useState(0)
  const wide = useWide()
  const prompted = useRef(false)

  const { ready, connected, locked, me, players, messages, activities } = party
  const joined = !!(me && players[me])
  const chatVisible = wide || tab === 'chat'

  // Ask newcomers for a codename once, as soon as the data has loaded.
  useEffect(() => {
    if (ready && connected && !joined && !prompted.current) { prompted.current = true; setSheet('join') }
  }, [ready, connected, joined])

  // Unread count for the Chat tab on phones.
  const lastTs = messages.length ? messages[messages.length - 1].ts : 0
  useEffect(() => { if (chatVisible) setLastSeen(lastTs) }, [chatVisible, lastTs])
  const unread = chatVisible ? 0 : messages.filter(m => m.ts > lastSeen && m.pid !== me && m.kind !== 'join').length

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
    const idea = text.match(/^\/idea\s+(.+)/i)
    if (idea) { if (!(await propose(idea[1]))) throw new Error('not added'); return }
    try { await actions.say(text.slice(0, 500)) } catch (e) { showToast(errorText(e)); throw e }
  }

  function vote(aid, v) {
    if (canAct()) actions.vote(aid, v).catch(e => showToast(errorText(e)))
  }

  function remove(id) {
    actions.removeIdea(id).catch(e => showToast(errorText(e)))
  }

  let notice = null
  if (locked) notice = 'Enter the passcode to join in.'
  else if (!ready) notice = 'Connecting to Party HQ…'
  else if (!connected) notice = 'Reconnecting… you can send again once you are back online.'
  else if (!joined) notice = <button type="button" className="btn primary" onClick={() => setSheet('join')}>Pick a codename to join</button>

  return (
    <div className="app" data-tab={tab}>
      {DEMO && (
        <div className="demo-bar">
          <span><strong>Demo.</strong> The other agents are simulated. Organiser code: <code>{DEMO_ADMIN_CODE}</code></span>
          <button type="button" className="linkbtn" onClick={() => { actions.resetDemo(); prompted.current = false }}>Reset demo</button>
        </div>
      )}
      <Header party={party} onEditInfo={() => setSheet('info')} onIdentity={() => setSheet('join')} />
      <Tabs tab={tab} onChange={setTab} unread={unread} counts={{ vote: activities.length, crew: Object.keys(players).length }} />
      <main className="stage">
        <Chat party={party} visible={chatVisible} notice={notice} onSend={send} onVote={vote} onTyping={actions.typing} />
        <div className="side">
          <Activities party={party} canAdd={!notice} onPropose={propose} onVote={vote} onRemove={remove} />
          <Crew party={party} onOrganiser={() => setSheet('organiser')} onLeaveOrganiser={() => { actions.leaveAdmin(); showToast('Organiser mode is off') }} />
        </div>
      </main>

      {sheet === 'join' && ready && (
        <JoinSheet current={players[me]} players={players} me={me} onSave={actions.join} onClose={() => setSheet(null)} />
      )}
      {sheet === 'info' && (
        <InfoSheet info={party.info} onSave={async info => { await actions.saveInfo(info); showToast('Party details saved') }} onClose={() => setSheet(null)} />
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
