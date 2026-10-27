export const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString()

export function dayLabel(ts) {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (sameDay(ts, Date.now())) return 'Today'
  if (sameDay(ts, yesterday)) return 'Yesterday'
  return new Date(ts).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

export const timeLabel = ts => new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

// Count Go / No-go per activity: { [activityId]: { go: [playerIds], nogo: [playerIds] } }
export function tally(activities, votes) {
  const t = {}
  for (const a of activities) t[a.id] = { go: [], nogo: [] }
  for (const [pid, picks] of Object.entries(votes)) {
    for (const [aid, v] of Object.entries(picks)) {
      if (!t[aid]) continue
      if (v === 1) t[aid].go.push(pid)
      if (v === -1) t[aid].nogo.push(pid)
    }
  }
  return t
}

// Highest (go − no-go) first, then most go votes, then oldest.
export function ranked(activities, t) {
  const score = a => t[a.id].go.length - t[a.id].nogo.length
  return [...activities].sort((a, b) => score(b) - score(a) || t[b.id].go.length - t[a.id].go.length || a.ts - b.ts)
}

export function errorText(e) {
  switch (e?.error) {
    case 'slow': return 'Patience. Wait a moment and try again.'
    case 'offline':
    case 'timeout': return "You're offline. Reconnecting…"
    case 'forbidden': return 'Only the organiser can do that.'
    case 'not_joined': return 'Take your vows first.'
    case 'taken': return 'Another member already goes by that name. Divine a new one.'
    case 'duplicate': return `${e.title || 'That'} is already on the list.`
    case 'full': return 'There is no more room. Ask the organiser.'
    case 'gone': return 'That was already struck from the book.'
    default: return "That didn't save. Try again."
  }
}

export const nameOf = (players, pid) => players[pid]?.codename || 'A departed soul'

// Attendance answers, as shown on buttons and in the chat.
export const RSVP = {
  yes: { button: 'Yes', short: 'attending', event: 'takes a seat at the table' },
  maybe: { button: 'Maybe', short: 'maybe', event: 'retreats to the shadows' },
  no: { button: 'No', short: 'not coming', event: 'sends regrets' },
}
