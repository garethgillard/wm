// All live data and actions in one hook. Components read `party` and call `actions`.
import { useEffect, useMemo, useReducer, useRef } from 'react'
import { connectSocket } from './socket'
import { connectDemo } from './demoServer'
import { HISTORY } from './constants'

export const DEMO = import.meta.env.MODE === 'demo'

const KEYS = { token: 'partyhq-token', pass: 'partyhq-pass', admin: 'partyhq-admin' }

export function lsGet(key) { try { return localStorage.getItem(key) } catch { return null } }
export function lsSet(key, value) {
  try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, value) } catch { /* private mode */ }
}

// A random secret per browser; the server links it to your codename.
function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function getToken() {
  let token = lsGet(KEYS.token)
  if (!token || !/^[A-Za-z0-9_-]{20,100}$/.test(token)) { token = newToken(); lsSet(KEYS.token, token) }
  return token
}

const initialState = {
  connected: false, ready: false, locked: false, passWrong: false,
  me: null, isAdmin: false, hasAdmin: false,
  info: null, players: {}, messages: [], activities: [], votes: {},
  online: [], typing: [],
}

// Server events are reduced straight into state; their `type` names the case.
function reducer(s, a) {
  switch (a.type) {
    case 'connected':
      return a.value ? { ...s, connected: true } : { ...s, connected: false, online: [], typing: [] }
    case 'locked':
      return { ...s, locked: true, ready: false, passWrong: !!a.wrong }
    case 'welcome': {
      const st = a.state || {}
      return {
        ...s, locked: false, passWrong: false, ready: true,
        me: a.you || null, isAdmin: !!a.admin, hasAdmin: !!a.hasAdmin,
        info: st.info || null,
        players: Object.fromEntries((st.players || []).map(p => [p.id, p])),
        messages: st.messages || [],
        activities: st.activities || [],
        votes: st.votes || {},
      }
    }
    case 'player':
      return { ...s, players: { ...s.players, [a.player.id]: a.player } }
    case 'message':
      if (s.messages.some(m => m.id === a.message.id)) return s
      return { ...s, messages: [...s.messages, a.message].slice(-HISTORY) }
    case 'activity':
      if (s.activities.some(x => x.id === a.activity.id)) return s
      return { ...s, activities: [...s.activities, a.activity] }
    case 'activity_removed':
      return { ...s, activities: s.activities.filter(x => x.id !== a.id) }
    case 'vote':
      return { ...s, votes: { ...s.votes, [a.pid]: { ...(s.votes[a.pid] || {}), [a.aid]: a.v } } }
    case 'info':
      return { ...s, info: a.info }
    case 'presence':
      return { ...s, online: a.online || [], typing: (a.typing || []).filter(p => p !== s.me) }
    case 'me':
      return { ...s, me: a.id }
    case 'admin':
      return { ...s, isAdmin: a.value }
    default:
      return s
  }
}

export function useParty() {
  const [party, dispatch] = useReducer(reducer, initialState)
  const conn = useRef(null)
  const token = useRef(null)
  const pending = useRef(new Map())
  const nextRid = useRef(0)
  const latest = useRef(party)
  latest.current = party

  const hello = () => conn.current?.send({
    type: 'hello', token: token.current,
    passcode: lsGet(KEYS.pass) || undefined, admin: lsGet(KEYS.admin) || undefined,
  })

  useEffect(() => {
    token.current = getToken()
    const connect = DEMO ? connectDemo : connectSocket
    const c = connect({
      onOpen() { dispatch({ type: 'connected', value: true }); hello() },
      onClose() {
        dispatch({ type: 'connected', value: false })
        for (const p of pending.current.values()) p.reject({ error: 'offline' })
        pending.current.clear()
      },
      onMessage(m) {
        if (m.type === 'ack') {
          const p = pending.current.get(m.rid)
          if (p) { pending.current.delete(m.rid); m.ok ? p.resolve(m) : p.reject(m) }
          return
        }
        if (m.type === 'locked' && m.wrong) lsSet(KEYS.pass, null)
        if (m.type === 'welcome' && !m.admin) lsSet(KEYS.admin, null)
        if (m.type === 'error' && m.error === 'bad_token') { token.current = newToken(); lsSet(KEYS.token, token.current); hello(); return }
        dispatch(m)
      },
    })
    conn.current = c
    return () => c.close()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Send a request and wait for the server's ack.
  const request = (type, payload = {}) => new Promise((resolve, reject) => {
    const c = conn.current
    if (!c || !c.isOpen()) return reject({ error: 'offline' })
    const rid = ++nextRid.current
    const timer = setTimeout(() => { pending.current.delete(rid); reject({ error: 'timeout' }) }, 8000)
    pending.current.set(rid, {
      resolve: m => { clearTimeout(timer); resolve(m) },
      reject: m => { clearTimeout(timer); reject(m) },
    })
    c.send({ type, rid, ...payload })
  })

  const actions = useMemo(() => ({
    async join(codename, emoji, color) {
      const r = await request('join', { codename, emoji, color })
      dispatch({ type: 'me', id: r.you })
    },
    say: text => request('msg', { text }),
    propose: title => request('idea', { title }),
    removeIdea: id => request('remove_idea', { id }),
    // Votes show instantly and roll back if the server refuses them.
    async vote(aid, v) {
      const { me, votes } = latest.current
      const before = votes[me]?.[aid] || 0
      dispatch({ type: 'vote', pid: me, aid, v })
      try { await request('vote', { aid, v }) } catch (e) { dispatch({ type: 'vote', pid: me, aid, v: before }); throw e }
    },
    saveInfo: info => request('info', info),
    async unlockAdmin(code) {
      await request('admin', { code })
      lsSet(KEYS.admin, code)
      dispatch({ type: 'admin', value: true })
    },
    leaveAdmin() {
      lsSet(KEYS.admin, null)
      dispatch({ type: 'admin', value: false })
      request('admin', { code: '' }).catch(() => {})
    },
    enterPasscode(code) { lsSet(KEYS.pass, code); hello() },
    typing: on => conn.current?.send({ type: 'typing', on }),
    resetDemo: () => conn.current?.reset?.(),
  }), []) // eslint-disable-line react-hooks/exhaustive-deps

  return [party, actions]
}
