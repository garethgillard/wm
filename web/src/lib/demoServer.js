// Demo mode only: a pretend server that runs in the browser and speaks the same
// messages as app/main.py, plus a few simulated colleagues who chat and vote.
// Used by `npm run build:demo`; the real build never includes it.

import { rand } from './constants'

export const DEMO_ADMIN_CODE = 'demo'
const STORE_KEY = 'partyhq-demo-v1'

const BOTS = [
  { id: 'bot-moose', codename: 'Captain Velvet Moose', emoji: 12, color: 1 },
  { id: 'bot-herring', codename: 'Neon Herring', emoji: 23, color: 3 },
  { id: 'bot-troll', codename: 'Baron Crispy Troll', emoji: 7, color: 6 },
  { id: 'bot-lynx', codename: 'Professor Polar Lynx', emoji: 13, color: 0 },
]
const LINES = [
  "Who's in charge of the playlist?",
  'Can we start after 17:00? Lab meeting always runs late.',
  'Anything with food gets my vote.',
  "Last year's julebord set a high bar.",
  'Is there a budget per person?',
  "Karaoke is a yes from me, but I'm not going first.",
  'Sauna sounds great if there is somewhere to change.',
  'Could we do two things? Activity first, dinner after.',
  "I'll book whatever wins if we decide by Friday.",
  'Does anyone know if the boat place does group bookings?',
]
const BOT_IDEAS = ['Shuffleboard bar', 'Ice skating', 'Cooking class']
const REACTIONS = ['Ooh, {t}!', '{t} could work.', 'Not sure about {t}, but I could be convinced.', '{t}? Count me in.']

function seed() {
  const now = Date.now()
  const min = 60000
  let id = 0
  const msg = (pid, kind, text, minsAgo, aid = '') => ({ id: String(++id), pid, kind, text, aid, ts: now - minsAgo * min })
  const acts = [
    { id: 'a1', title: 'Karaoke night', pid: 'bot-troll', ts: now - 34 * min },
    { id: 'a2', title: 'Sauna and fjord dip', pid: 'bot-moose', ts: now - 30 * min },
    { id: 'a3', title: 'Escape room', pid: 'bot-herring', ts: now - 22 * min },
  ]
  return {
    nextId: 100,
    info: { name: 'Julebord 2026', when: 'Fri 11 Dec, from 17:00', where: 'Still to be decided' },
    players: BOTS.map((b, i) => ({ ...b, joinedAt: now - (60 - i * 5) * min })),
    activities: acts,
    votes: {
      'bot-moose': { a1: 1, a2: 1 },
      'bot-herring': { a1: 1, a2: -1, a3: 1 },
      'bot-troll': { a1: 1, a3: 1 },
    },
    messages: [
      msg('bot-moose', 'join', '', 60),
      msg('bot-moose', 'msg', 'Who is ready to plan the julebord?', 40),
      msg('bot-herring', 'msg', 'Me! Something that is not just dinner please', 38),
      msg('bot-troll', 'suggest', 'Karaoke night', 34, 'a1'),
      msg('bot-moose', 'suggest', 'Sauna and fjord dip', 30, 'a2'),
      msg('bot-herring', 'suggest', 'Escape room', 22, 'a3'),
      msg('bot-herring', 'msg', 'Escape room in the city centre does groups of up to 12', 21),
    ],
    tokens: {}, // browser token → player id
    linesUsed: 0,
    botIdeasUsed: 0,
  }
}

function load() {
  try { const raw = localStorage.getItem(STORE_KEY); return raw ? JSON.parse(raw) : null } catch { return null }
}

export function connectDemo({ onOpen, onMessage, onClose }) {
  let db = load() || seed()
  let me = null
  let myToken = null
  let admin = false
  let open = true
  const typing = new Set()
  const online = new Set(['bot-moose', 'bot-herring', 'bot-troll'])
  const timers = new Set()

  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); if (open) fn() }, ms); timers.add(t) }
  const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(db)) } catch { /* demo still works without storage */ } }
  // Same small delay for every event keeps them in order, like a real network.
  const emit = m => later(() => onMessage(JSON.parse(JSON.stringify(m))), 60)
  const clean = (v, n) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '')
  const nextId = () => String(++db.nextId)
  const presence = () => emit({ type: 'presence', online: [...online, ...(me ? [me] : [])], typing: [...typing] })
  const snapshot = () => ({ info: db.info, players: db.players, activities: db.activities, votes: db.votes, messages: db.messages.slice(-300) })

  function addMessage(pid, kind, text = '', aid = '') {
    const m = { id: nextId(), pid, kind, text, aid, ts: Date.now() }
    db.messages.push(m)
    if (db.messages.length > 2000) db.messages.shift()
    save()
    emit({ type: 'message', message: m })
  }
  function setVote(pid, aid, v) {
    db.votes[pid] = { ...(db.votes[pid] || {}), [aid]: v }
    save()
    emit({ type: 'vote', pid, aid, v })
  }
  function addActivity(pid, title) {
    const a = { id: 'a' + nextId(), title, pid, ts: Date.now() }
    db.activities.push(a)
    save()
    emit({ type: 'activity', activity: a })
    addMessage(pid, 'suggest', title, a.id)
    return a
  }

  // ---------- simulated colleagues ----------
  function botSay(bot, text, delay = 1500) {
    later(() => {
      typing.add(bot); presence()
      later(() => { typing.delete(bot); addMessage(bot, 'msg', text); presence() }, 1800)
    }, delay)
  }
  function botVote(bot, aid, delay) {
    later(() => {
      if (!db.activities.some(a => a.id === aid) || db.votes[bot]?.[aid]) return
      setVote(bot, aid, Math.random() < 0.75 ? 1 : -1)
    }, delay)
  }
  function tick() {
    const bots = [...online]
    const bot = bots[rand(bots.length)]
    const roll = Math.random()
    if (roll < 0.35 && db.linesUsed < LINES.length) {
      botSay(bot, LINES[db.linesUsed++], 0)
    } else if (roll < 0.8) {
      const open_ = db.activities.filter(a => !db.votes[bot]?.[a.id])
      if (open_.length) botVote(bot, open_[rand(open_.length)].id, 0)
    } else if (db.botIdeasUsed < BOT_IDEAS.length && db.activities.length < 7) {
      const title = BOT_IDEAS[db.botIdeasUsed++]
      if (!db.activities.some(a => a.title.toLowerCase() === title.toLowerCase())) addActivity(bot, title)
    }
    later(tick, 9000 + rand(9000))
  }
  function churn() {
    if (online.has('bot-lynx')) online.delete('bot-lynx'); else online.add('bot-lynx')
    if (online.has('bot-lynx') && !db.players.some(p => p.id === 'bot-lynx')) db.players.push({ ...BOTS[3], joinedAt: Date.now() })
    presence()
    later(churn, 35000 + rand(30000))
  }

  // ---------- message handling (mirrors app/main.py) ----------
  function handle(m) {
    const ack = (ok, extra = {}) => { if (m.rid != null) emit({ type: 'ack', rid: m.rid, ok, ...extra }) }

    if (m.type === 'hello') {
      myToken = m.token
      me = db.tokens[myToken] || null
      admin = m.admin === DEMO_ADMIN_CODE
      emit({ type: 'welcome', you: me, admin, hasAdmin: true, state: snapshot() })
      presence()
      return
    }
    if (m.type === 'admin') { admin = m.code === DEMO_ADMIN_CODE; return ack(admin, admin ? {} : { error: 'forbidden' }) }
    if (m.type === 'typing') return

    if (m.type === 'join') {
      const codename = clean(m.codename, 28)
      if (codename.length < 2) return ack(false, { error: 'invalid' })
      if (db.players.some(p => p.id !== me && p.codename.toLowerCase() === codename.toLowerCase())) return ack(false, { error: 'taken' })
      let player = db.players.find(p => p.id === me)
      const created = !player
      if (created) {
        player = { id: 'you-' + nextId(), joinedAt: Date.now() }
        db.players.push(player)
        me = player.id
        db.tokens[myToken] = me
      }
      Object.assign(player, { codename, emoji: m.emoji, color: m.color })
      save()
      ack(true, { you: me })
      emit({ type: 'player', player })
      if (created) {
        addMessage(me, 'join')
        botSay('bot-moose', `Welcome, ${codename}! Have a look at the votes.`, 2500)
      }
      presence()
      return
    }

    if (!me) return ack(false, { error: 'not_joined' })

    switch (m.type) {
      case 'msg': {
        const text = typeof m.text === 'string' ? m.text.trim().slice(0, 500) : ''
        if (!text) return ack(false, { error: 'invalid' })
        addMessage(me, 'msg', text)
        ack(true)
        if (Math.random() < 0.3 && db.linesUsed < LINES.length) botSay([...online][rand(online.size)], LINES[db.linesUsed++], 3000)
        return
      }
      case 'idea': {
        const title = clean(m.title, 80)
        if (!title) return ack(false, { error: 'invalid' })
        const dup = db.activities.find(a => a.title.toLowerCase() === title.toLowerCase())
        if (dup) return ack(false, { error: 'duplicate', title: dup.title })
        const a = addActivity(me, title)
        ack(true, { id: a.id })
        ;[...online].forEach((bot, i) => botVote(bot, a.id, 2500 + i * 2200 + rand(1500)))
        const reactor = [...online][rand(online.size)]
        botSay(reactor, REACTIONS[rand(REACTIONS.length)].replace('{t}', title), 4000)
        return
      }
      case 'remove_idea': {
        const a = db.activities.find(x => x.id === m.id)
        if (!a) return ack(false, { error: 'gone' })
        if (a.pid !== me && !admin) return ack(false, { error: 'forbidden' })
        db.activities = db.activities.filter(x => x.id !== a.id)
        for (const picks of Object.values(db.votes)) delete picks[a.id]
        save()
        emit({ type: 'activity_removed', id: a.id })
        return ack(true)
      }
      case 'vote': {
        if (![-1, 0, 1].includes(m.v) || !db.activities.some(a => a.id === m.aid)) return ack(false, { error: 'invalid' })
        setVote(me, m.aid, m.v)
        return ack(true)
      }
      case 'info': {
        if (!admin) return ack(false, { error: 'forbidden' })
        db.info = { name: clean(m.name, 40) || 'Work party', when: clean(m.when, 60), where: clean(m.where, 60) }
        save()
        emit({ type: 'info', info: db.info })
        return ack(true)
      }
      default:
        return ack(false, { error: 'unknown' })
    }
  }

  later(onOpen, 150)
  later(tick, 8000)
  later(churn, 40000)

  return {
    send: m => later(() => handle(m), 30),
    isOpen: () => open,
    close: () => { open = false; timers.forEach(clearTimeout); timers.clear(); onClose() },
    // Start the demo over with fresh sample data.
    reset: () => {
      db = seed(); me = null; admin = false; typing.clear(); save()
      emit({ type: 'welcome', you: null, admin: false, hasAdmin: true, state: snapshot() })
      presence()
    },
  }
}
