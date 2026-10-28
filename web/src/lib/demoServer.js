// Demo mode only: a pretend server that runs in the browser and speaks the same
// messages as app/main.py, plus a few simulated colleagues who chat and vote.
// Used by `npm run build:demo`; the real build never includes it.

import { rand } from './constants'

export const DEMO_ADMIN_CODE = 'demo'
const STORE_KEY = 'partyhq-demo-v6'

const BOTS = [
  { id: 'bot-hare', codename: 'Keeper Ashen Hare', emoji: 12, color: 1, rsvp: 'yes' },
  { id: 'bot-owl', codename: 'Oracle of the Ribosome', emoji: 3, color: 2, rsvp: 'yes' },
  { id: 'bot-wolf', codename: 'Warden Hollow Wolf', emoji: 1, color: 0, rsvp: 'yes' },
  { id: 'bot-toad', codename: 'The Methylated Toad', emoji: 4, color: 4, rsvp: 'maybe' },
  { id: 'bot-cat', codename: 'The Pale Oracle', emoji: 2, color: 6, rsvp: 'yes' },
  { id: 'bot-goat', codename: 'Herald of the Genome', emoji: 8, color: 7, rsvp: 'yes' },
  { id: 'bot-fish', codename: 'Keeper of the Melange', emoji: 23, color: 3, rsvp: 'maybe' },
  { id: 'bot-bat', codename: 'Envoy Sable Bat', emoji: 7, color: 5, rsvp: 'no' },
]
const LINES = [
  'The candles are ordered. Black, obviously.',
  'Do we chant before or after the snacks?',
  "I've ironed my robe. Twice.",
  'Who is bringing the punch? It should be red.',
  'Can the ritual start after 18:00? Lab meeting always runs late.',
  "Is there a dress code beyond 'ominous'?",
  'I propose we offer the old printer to the void.',
  'Masks on at the door, I assume?',
  "I'll book whichever rite wins by Friday.",
  'The basement room by the freezers has excellent acoustics for chanting.',
  'Why does the coffee smell faintly of the fjord?',
  'Second cup of melange. I feel strangely like swimming upstream.',
]
const BOT_IDEAS = ['Salmon and coffee pairing', 'Pumpkin carving', 'Ghost story circle']
const REACTIONS = ['{t}? The circle approves.', '{t} could work.', '{t}. Intriguing.', 'Not sure about {t}, but I will honour the vote.']

function seed() {
  const now = Date.now()
  const min = 60000
  let id = 0
  const msg = (pid, kind, text, minsAgo, aid = '') => ({ id: String(++id), pid, kind, text, aid, ts: now - minsAgo * min })
  const acts = [
    { id: 'a1', title: 'Murder mystery', pid: 'bot-owl', ts: now - 44 * min },
    { id: 'a2', title: 'Séance in the basement', pid: 'bot-toad', ts: now - 38 * min },
    { id: 'a3', title: 'Tarot readings', pid: 'bot-cat', ts: now - 30 * min },
    { id: 'a4', title: 'Horror film night', pid: 'bot-wolf', ts: now - 21 * min },
  ]
  return {
    nextId: 100,
    info: { name: 'The Melange Conclave', when: 'Friday 30 October', where: 'CIGENE' },
    notices: [
      { id: 'n1', text: 'Dress code: a dark robe and a mask. Animal ears encouraged.', ts: now - 70 * min },
      { id: 'n2', text: 'Bring something for the offering table. Snacks count.', ts: now - 65 * min },
      { id: 'n3', text: 'The sacred melange will be served. Do not ask what is in it.', ts: now - 62 * min },
      { id: 'n4', text: 'Cast your votes by Wednesday so the rites can be booked.', ts: now - 60 * min },
    ],
    players: BOTS.map((b, i) => ({ ...b, joinedAt: now - (90 - i * 8) * min })),
    activities: acts,
    votes: {
      'bot-hare': { a1: 1, a2: 1, a4: -1 },
      'bot-owl': { a1: 1, a3: 1 },
      'bot-wolf': { a1: 1, a2: -1, a4: 1 },
      'bot-toad': { a2: 1, a3: 1 },
      'bot-cat': { a3: 1, a1: 1 },
      'bot-goat': { a1: 1, a2: 1, a4: 1 },
    },
    messages: [
      msg('bot-hare', 'join', '', 90),
      msg('bot-hare', 'msg', 'The circle gathers on Friday. Robes are mandatory.', 72),
      msg('bot-owl', 'msg', 'Finally. I have had the mask ready since August.', 70),
      msg('bot-fish', 'msg', 'The melange will be brewed to the old recipe. You know the one.', 55),
      msg('bot-owl', 'suggest', 'Murder mystery', 44, 'a1'),
      msg('bot-toad', 'suggest', 'Séance in the basement', 38, 'a2'),
      msg('bot-wolf', 'msg', 'A séance in the basement with the freezers humming would be properly unsettling.', 36),
      msg('bot-cat', 'suggest', 'Tarot readings', 30, 'a3'),
      msg('bot-wolf', 'suggest', 'Horror film night', 21, 'a4'),
      msg('bot-goat', 'msg', 'I can bring the projector. And the fog machine.', 19),
      msg('bot-bat', 'rsvp', 'no', 15),
      msg('bot-bat', 'msg', "Alas, I'm at a conference that week. I shall haunt the chat instead.", 14),
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
  const online = new Set(['bot-hare', 'bot-owl', 'bot-wolf', 'bot-toad', 'bot-goat'])
  const timers = new Set()

  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); if (open) fn() }, ms); timers.add(t) }
  const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(db)) } catch { /* demo still works without storage */ } }
  // Same small delay for every event keeps them in order, like a real network.
  const emit = m => later(() => onMessage(JSON.parse(JSON.stringify(m))), 60)
  const clean = (v, n) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '')
  const nextId = () => String(++db.nextId)
  const presence = () => emit({ type: 'presence', online: [...online, ...(me ? [me] : [])], typing: [...typing] })
  db.reactions ||= [] // demo data saved before reactions existed
  const snapshot = () => ({ info: db.info, notices: db.notices, players: db.players, activities: db.activities, votes: db.votes, messages: db.messages.slice(-300), reactions: db.reactions })

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
    } else if (roll < 0.86) {
      const doubter = db.players.find(p => p.id.startsWith('bot-') && p.rsvp === 'maybe' && online.has(p.id))
      if (doubter) {
        doubter.rsvp = 'yes'
        save()
        emit({ type: 'player', player: doubter })
        addMessage(doubter.id, 'rsvp', 'yes')
      }
    } else if (db.botIdeasUsed < BOT_IDEAS.length && db.activities.length < 7) {
      const title = BOT_IDEAS[db.botIdeasUsed++]
      if (!db.activities.some(a => a.title.toLowerCase() === title.toLowerCase())) addActivity(bot, title)
    }
    later(tick, 9000 + rand(9000))
  }
  function churn() {
    if (online.has('bot-fish')) online.delete('bot-fish'); else online.add('bot-fish')
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
      let player = db.players.find(p => p.id === me)
      // Members can rename themselves; old whispers follow the new name.
      const codename = clean(m.codename, 28) || (player ? player.codename : '')
      if (codename.length < 2) return ack(false, { error: 'invalid' })
      if (db.players.some(p => p.id !== player?.id && p.codename.toLowerCase() === codename.toLowerCase())) return ack(false, { error: 'taken' })
      const created = !player
      if (created) {
        player = { id: 'you-' + nextId(), joinedAt: Date.now() }
        db.players.push(player)
        me = player.id
        db.tokens[myToken] = me
      }
      if (m.rsvp != null && !['yes', 'maybe', 'no'].includes(m.rsvp)) return ack(false, { error: 'invalid' })
      const before = player.rsvp
      Object.assign(player, { codename, emoji: m.emoji, color: m.color, rsvp: m.rsvp ?? player.rsvp ?? null })
      save()
      ack(true, { you: me })
      emit({ type: 'player', player })
      if (created) {
        addMessage(me, 'join', player.rsvp || '')
        botSay('bot-hare', player.rsvp === 'no' ? `A pity, ${codename}. Your seat will stay warm.` : `Welcome, ${codename}. Your seat was waiting.`, 2500)
      } else if (m.rsvp && before !== m.rsvp) addMessage(me, 'rsvp', m.rsvp)
      presence()
      return
    }

    if (!me) return ack(false, { error: 'not_joined' })

    // Remove a member and their votes; their whispers stay, unattributed.
    function removePlayer(pid, kind) {
      const p = db.players.find(x => x.id === pid)
      if (!p) return false
      db.players = db.players.filter(x => x.id !== pid)
      delete db.votes[pid]
      for (const [t, id] of Object.entries(db.tokens)) if (id === pid) delete db.tokens[t]
      save()
      emit({ type: 'player_removed', id: pid })
      addMessage(pid, kind, p.codename)
      return true
    }

    switch (m.type) {
      case 'leave': {
        const pid = me
        me = null
        removePlayer(pid, 'leave')
        presence()
        return ack(true)
      }
      case 'kick': {
        if (!admin) return ack(false, { error: 'forbidden' })
        if (m.id === me) return ack(false, { error: 'invalid' })
        if (!removePlayer(m.id, 'kick')) return ack(false, { error: 'gone' })
        online.delete(m.id)
        presence()
        return ack(true)
      }
      case 'reset': {
        if (!admin) return ack(false, { error: 'forbidden' })
        if (m.confirm !== 'RESET') return ack(false, { error: 'invalid' })
        db = seed(); me = null; typing.clear(); save() // the demo starts over with its sample members
        ack(true)
        emit({ type: 'reset', state: snapshot() })
        presence()
        return
      }
      case 'emote': {
        if (!Number.isInteger(m.e) || m.e < 0 || m.e >= 18) return ack(false, { error: 'invalid' })
        emit({ type: 'emote', pid: me, e: m.e })
        return ack(true)
      }
      case 'react': {
        const { mid, e, on } = m
        if (!Number.isInteger(e) || e < 0 || e >= 8 || typeof on !== 'boolean') return ack(false, { error: 'invalid' })
        if (!db.messages.some(x => x.id === mid && x.kind === 'msg')) return ack(false, { error: 'gone' })
        db.reactions = db.reactions.filter(r => !(r.mid === mid && r.pid === me && r.e === e))
        if (on) db.reactions.push({ mid, pid: me, e })
        save()
        emit({ type: 'reaction', mid, pid: me, e, on })
        return ack(true)
      }
      case 'delete_message': {
        if (!admin) return ack(false, { error: 'forbidden' })
        db.messages = db.messages.filter(x => x.id !== m.id)
        save()
        emit({ type: 'message_removed', id: m.id })
        return ack(true)
      }
      case 'rsvp': {
        if (!['yes', 'maybe', 'no'].includes(m.value)) return ack(false, { error: 'invalid' })
        const player = db.players.find(p => p.id === me)
        if (player.rsvp !== m.value) {
          player.rsvp = m.value
          save()
          emit({ type: 'player', player })
          addMessage(me, 'rsvp', m.value)
        }
        return ack(true)
      }
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
      case 'edit_idea': {
        const a = db.activities.find(x => x.id === m.id)
        if (!a) return ack(false, { error: 'gone' })
        if (a.pid !== me && !admin) return ack(false, { error: 'forbidden' })
        const title = clean(m.title, 80)
        if (!title) return ack(false, { error: 'invalid' })
        const dup = db.activities.find(x => x.id !== a.id && x.title.toLowerCase() === title.toLowerCase())
        if (dup) return ack(false, { error: 'duplicate', title: dup.title })
        a.title = title
        save()
        emit({ type: 'activity', activity: a })
        return ack(true)
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
      case 'notice': {
        if (!admin) return ack(false, { error: 'forbidden' })
        const text = clean(m.text, 200)
        if (!text) return ack(false, { error: 'invalid' })
        const n = { id: 'n' + nextId(), text, ts: Date.now() }
        db.notices.push(n)
        save()
        emit({ type: 'notice', notice: n })
        return ack(true)
      }
      case 'edit_notice': {
        if (!admin) return ack(false, { error: 'forbidden' })
        const n = db.notices.find(x => x.id === m.id)
        const text = clean(m.text, 200)
        if (!n) return ack(false, { error: 'gone' })
        if (!text) return ack(false, { error: 'invalid' })
        n.text = text
        save()
        emit({ type: 'notice', notice: n })
        return ack(true)
      }
      case 'remove_notice': {
        if (!admin) return ack(false, { error: 'forbidden' })
        db.notices = db.notices.filter(n => n.id !== m.id)
        save()
        emit({ type: 'notice_removed', id: m.id })
        return ack(true)
      }
      case 'info': {
        if (!admin) return ack(false, { error: 'forbidden' })
        db.info = { name: clean(m.name, 40) || 'The Melange Conclave', when: clean(m.when, 60), where: clean(m.where, 60) }
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
