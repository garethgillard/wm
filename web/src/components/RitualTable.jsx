// The centrepiece: a round table in a candlelit dungeon. Every member sits at it as a robed,
// masked figure. Their candle is lit while they are here; empty chairs wait for newcomers.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Chair, Figure } from './Cult'
import { roman } from '../lib/constants'
import { nameOf } from '../lib/format'

const CX = 400
const CY = 292
const TABLE = { rx: 228, ry: 84 }

// Seats sit on an ellipse round the table. The back row is pulled down so the table hides
// their laps, and figures shrink a little with distance and as the circle fills up.
function seatLayout(count) {
  const seats = count > 45 ? count : Math.max(8, count + 3)
  const crowd = seats <= 10 ? 0.82 : Math.max(0.44, 0.82 * Math.sqrt(10 / seats))
  return Array.from({ length: seats }, (_, k) => {
    const angle = Math.PI / 2 + (2 * Math.PI * k) / seats
    const s = Math.sin(angle)
    return {
      k,
      x: CX + 292 * Math.cos(angle),
      y: CY + 92 * s + 34 * s * s,
      back: s < -0.05,
      scale: crowd * (0.8 + 0.25 * ((s + 1) / 2)),
    }
  })
}

// Each member gets their own steady rhythm, so the room never moves in lockstep.
function motion(id) {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const r = n => ((h >>> n) % 1000) / 1000
  return {
    '--sway': `${3.2 + r(1) * 2.6}s`,
    '--tilt': `${5 + r(4) * 5}s`,
    '--pace': `${9 + r(7) * 8}s`,
    '--delay': `${-r(10) * 8}s`,
  }
}

const TABLE_ITEMS = [
  ...[{ a: -150, h: 34 }, { a: -118, h: 46 }, { a: -30, h: 30 }, { a: 30, h: 40 }, { a: 150, h: 36 }, { a: 90, h: 28 }].map(c => {
    const r = (c.a * Math.PI) / 180
    return { kind: 'candle', x: CX + 150 * Math.cos(r), y: CY + 54 * Math.sin(r), h: c.h, delay: (Math.abs(c.a) % 7) / 10 }
  }),
  { kind: 'cup', x: CX + 66, y: CY - 32 },
  { kind: 'platter', x: CX - 72, y: CY - 30 },
].sort((a, b) => a.y - b.y)

// A salmon in profile, facing right, centred on (0, 0).
function Salmon() {
  return (
    <g>
      <path d="M-25 0 L-37 -9 L-33 0 L-37 9 Z" fill="#c25d48" />
      <path d="M-26 0 C-18 -9 8 -10 20 -3 C24 -1 24 1 20 3 C8 10 -18 9 -26 0 Z" fill="#e8866c" />
      <path d="M-24 -1.5 C-14 -7.5 8 -8.5 19 -3" fill="none" stroke="#9c4535" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M-5 -7.5 L1 -12.5 L4 -7 Z" fill="#c25d48" />
      <path d="M-14 1 C-6 3 6 3 14 1" fill="none" stroke="#f6c2ae" strokeWidth="1.1" strokeLinecap="round" opacity="0.8" />
      <circle cx="-8" cy="-4" r="0.9" fill="#5e2a20" /><circle cx="-2" cy="-5" r="0.9" fill="#5e2a20" /><circle cx="4" cy="-4.5" r="0.9" fill="#5e2a20" />
      <circle cx="15" cy="-1.6" r="1.5" fill="#1d1414" />
    </g>
  )
}

// A cup of melange: coffee under milk foam, on a saucer. `tail` adds the secret ingredient.
function Melange({ tail = false, steam = true }) {
  return (
    <g>
      <ellipse cx="0" cy="0" rx="20" ry="5" fill="#e7e0d2" />
      <ellipse cx="0" cy="-0.8" rx="13" ry="3" fill="#cfc6b4" />
      <path d="M12 -16 C21 -16 21 -6 10 -6" fill="none" stroke="#f3eee4" strokeWidth="3" />
      <path d="M-13 -20 L13 -20 L10 -3 Q0 1.5 -10 -3 Z" fill="#f3eee4" />
      <path d="M-13 -20 L13 -20 L12.2 -16 Q0 -13 -12.2 -16 Z" fill="#d9d0bf" opacity="0.6" />
      <ellipse cx="0" cy="-20" rx="13" ry="3.6" fill="#6b3f22" />
      <ellipse cx="0" cy="-20.4" rx="11" ry="2.7" fill="#f4e4c4" />
      {tail && <path d="M-1.5 -21 C-2.5 -26 -1 -30 0.5 -32 L-5 -39 L1.5 -36 L6 -40.5 L3.6 -32 C4.6 -28 3.8 -24.5 2.8 -21 Z" fill="#e8866c" stroke="#9c4535" strokeWidth="0.6" />}
      {steam && (
        <g className="steam" fill="none" stroke="#efe6d4" strokeWidth="1.4" strokeLinecap="round" opacity="0.55">
          <path d="M-5 -26 C-8 -31 -2 -34 -5 -39" />
          <path d="M5 -27 C2 -32 8 -35 5 -41" />
        </g>
      )}
    </g>
  )
}

function Platter() {
  return (
    <g>
      <ellipse cx="0" cy="2" rx="34" ry="9" fill="#000" opacity="0.4" />
      <ellipse cx="0" cy="0" rx="32" ry="8.5" fill="url(#silver)" />
      <ellipse cx="0" cy="-0.5" rx="26" ry="6.2" fill="none" stroke="#f1f3f5" strokeOpacity="0.35" />
      <g transform="translate(0 -3) scale(0.78 0.6)"><Salmon /></g>
      <path d="M-20 3 l-4 -3 M-20 3 l-1 -4 M18 4 l4 -2 M18 4 l1 -4" stroke="#5f7d3a" strokeWidth="1.2" strokeLinecap="round" />
    </g>
  )
}

function SalmonPortrait({ x, y }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse rx="37" ry="47" fill="#000" opacity="0.5" transform="translate(3 4)" />
      <ellipse rx="36" ry="46" fill="url(#gold)" />
      <ellipse rx="31" ry="41" fill="none" stroke="#3b2a10" strokeWidth="1.5" />
      <ellipse rx="29" ry="39" fill="url(#canvas)" />
      <g transform="rotate(-32) scale(0.92)"><Salmon /></g>
      <rect x="-13" y="49" width="26" height="7" rx="1" fill="url(#gold)" />
    </g>
  )
}

function MelangePainting({ x, y }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="-33" y="-41" width="70" height="86" fill="#000" opacity="0.5" />
      <rect x="-36" y="-44" width="72" height="88" fill="url(#gold)" />
      <rect x="-31" y="-39" width="62" height="78" fill="none" stroke="#3b2a10" strokeWidth="1.5" />
      <rect x="-29" y="-37" width="58" height="74" fill="url(#canvas)" />
      <g transform="translate(0 22) scale(1.25)"><Melange tail steam={false} /></g>
      <rect x="-13" y="47" width="26" height="7" rx="1" fill="url(#gold)" />
    </g>
  )
}

function Candle({ x, y, h, delay }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="0" cy="2" rx="9" ry="3.5" fill="#000" opacity="0.5" />
      <rect x="-5" y={-h} width="10" height={h} rx="2" fill="#e6dcc6" />
      <path d={`M-5 ${-h + 2} q3 6 1 12 q2 -5 4 -12`} fill="#cfc3aa" />
      <g className="flicker" style={{ animationDelay: `${delay}s` }}>
        <circle cx="0" cy={-h - 8} r="26" fill="url(#flame-glow)" />
        <path d={`M0 ${-h - 18} C5 ${-h - 10} 4 ${-h - 3} 0 ${-h} C-4 ${-h - 3} -5 ${-h - 10} 0 ${-h - 18} Z`} fill="#ffd27a" />
        <path d={`M0 ${-h - 10} C2 ${-h - 6} 2 ${-h - 3} 0 ${-h - 1} C-2 ${-h - 3} -2 ${-h - 6} 0 ${-h - 10} Z`} fill="#fff4d6" />
      </g>
    </g>
  )
}

function Torch({ x }) {
  return (
    <g transform={`translate(${x} 150)`}>
      <circle cx="0" cy="-22" r="70" fill="url(#flame-glow)" opacity="0.7" />
      <path d="M-12 0 L12 0 L6 18 L-6 18 Z" fill="#2a2018" stroke="#5a4526" />
      <rect x="-3" y="18" width="6" height="30" fill="#2a2018" />
      <g className="flicker">
        <path d="M0 -34 C10 -20 9 -8 0 0 C-9 -8 -10 -20 0 -34 Z" fill="#f39b3a" />
        <path d="M0 -20 C5 -12 4 -6 0 -2 C-4 -6 -5 -12 0 -20 Z" fill="#ffe2a0" />
      </g>
    </g>
  )
}

function Banner({ x }) {
  return (
    <g transform={`translate(${x} 0)`}>
      <line x1="-38" y1="34" x2="38" y2="34" stroke="#6e531f" strokeWidth="3" />
      <circle cx="-38" cy="34" r="4" fill="url(#gold)" />
      <circle cx="38" cy="34" r="4" fill="url(#gold)" />
      <path d="M-30 36 H30 V188 L0 168 L-30 188 Z" fill="url(#banner)" />
      <path d="M-24 40 V176 M24 40 V176" stroke="#c9a55c" strokeOpacity="0.35" />
      <g color="#c9a55c" opacity="0.85"><use href="#wm-sigil" x="-20" y="80" width="40" height="40" /></g>
    </g>
  )
}

export function RitualTable({ party }) {
  const { players, online, typing, me, messages } = party

  // Whoever just whispered hops in their seat for a moment.
  const [speaking, setSpeaking] = useState(() => new Set())
  const lastMsg = useRef(undefined)
  const hopTimers = useRef({})
  useEffect(() => {
    const last = messages[messages.length - 1]
    const firstLoad = lastMsg.current === undefined
    if (!last || last.id === lastMsg.current) return
    lastMsg.current = last.id
    if (firstLoad || last.kind !== 'msg') return
    const pid = last.pid
    setSpeaking(s => new Set(s).add(pid))
    clearTimeout(hopTimers.current[pid])
    hopTimers.current[pid] = setTimeout(() => setSpeaking(s => { const n = new Set(s); n.delete(pid); return n }), 1500)
  }, [messages])
  useEffect(() => () => Object.values(hopTimers.current).forEach(clearTimeout), [])
  const [selected, setSelected] = useState(null)
  const [expanded, setExpanded] = useState(false) // the big view of the chamber
  const lightbox = useRef(null)

  useEffect(() => {
    if (!expanded) return
    const el = lightbox.current
    if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2 // phones: start in the middle of the room
    const onKey = e => { if (e.key === 'Escape') setExpanded(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [expanded])

  const members = useMemo(
    () => Object.values(players).sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id)),
    [players],
  )
  // Only those who said yes sit at the table.
  const seats = useMemo(() => {
    const attending = members.filter(p => p.rsvp === 'yes')
    const layout = seatLayout(attending.length)
    const taken = new Map()
    attending.forEach((p, i) => taken.set(Math.round((i * layout.length) / attending.length), p))
    return layout.map(seat => ({ ...seat, player: taken.get(seat.k) || null })).sort((a, b) => a.y - b.y)
  }, [members])

  // Maybes and the undecided stand in the shadows along the back wall, unseated.
  const shadows = useMemo(() => {
    const lurkers = members.filter(p => p.rsvp !== 'yes' && p.rsvp !== 'no')
    const n = lurkers.length
    const scale = n <= 8 ? 0.5 : Math.max(0.32, 0.5 * Math.sqrt(8 / n))
    return lurkers.map((p, i) => ({ k: `shadow-${p.id}`, x: 70 + (660 * (i + 0.5)) / n, y: 214 + (i % 2) * 8, scale, player: p, shadow: true }))
  }, [members])

  const attendingCount = seats.filter(s => s.player).length
  const here = members.filter(p => online.includes(p.id)).length

  function renderSeat(seat) {
    const p = seat.player
    const transform = `translate(${seat.x}px, ${seat.y}px) scale(${seat.scale})`
    if (!p) {
      return <g key={`empty-${seat.k}`} className="seat" style={{ transform }}><Chair empty /></g>
    }
    const isHere = online.includes(p.id)
    const status = seat.shadow ? (p.rsvp === 'maybe' ? ', maybe attending' : ', undecided') : ', attending'
    return (
      <g key={p.id} className={`seat${isHere ? ' here' : ' away'}${p.id === me ? ' mine' : ''}${seat.shadow ? ' shadow' : ''}`} style={{ transform }}
        role="button" tabIndex={0} aria-label={`${nameOf(players, p.id)}${p.id === me ? ' (you)' : ''}${status}${isHere ? ', here now' : ''}`}
        onClick={e => { e.stopPropagation(); setSelected(selected === p.id ? null : p.id) }}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(selected === p.id ? null : p.id) } }}>
        <title>{nameOf(players, p.id)}</title>
        {!seat.shadow && <Chair />}
        {p.id === me && <ellipse cx="0" cy="2" rx="44" ry="10" fill="none" stroke="url(#gold)" strokeWidth="2.5" />}
        <g className="actor" style={motion(p.id)}>
          <g className={`hop${speaking.has(p.id) ? ' speaking' : ''}`}>
            <Figure player={p} lit={isHere && !seat.shadow} />
          </g>
        </g>
      </g>
    )
  }

  // Name tags and typing dots float above everything, at a readable size.
  function renderTag(seat) {
    const p = seat.player
    if (!p) return null
    const top = seat.y - 128 * seat.scale
    const showName = selected === p.id
    const isTyping = typing.includes(p.id)
    if (!showName && p.id !== me && !isTyping) return null
    const label = showName ? nameOf(players, p.id) : p.id === me ? 'You' : ''
    const width = Math.max(30, label.length * 6.6 + 16)
    return (
      <g key={`tag-${p.id}`} transform={`translate(${seat.x} ${top})`} className="tag">
        {label && (
          <>
            <rect x={-width / 2} y="-24" width={width} height="18" rx="9" fill="#0b0a0d" fillOpacity="0.85" stroke="#c9a55c" strokeOpacity="0.6" />
            <text x="0" y="-11" textAnchor="middle" className="tag-text">{label}</text>
          </>
        )}
        {isTyping && (
          <g className="typing-dots" transform={`translate(0 ${label ? -34 : -12})`}>
            <circle cx="-7" r="2.6" /><circle cx="0" r="2.6" /><circle cx="7" r="2.6" />
          </g>
        )}
      </g>
    )
  }

  const back = seats.filter(s => s.back)
  const front = seats.filter(s => !s.back)

  const caption = attendingCount ? (
    <>
      <span className="count-roman" aria-hidden="true">{roman(attendingCount)}</span>
      <span>
        {attendingCount} attending
        {shadows.length > 0 && ` · ${shadows.length} in the shadows`}
        {` · ${here} here now`}
      </span>
    </>
  ) : <span>{members.length ? 'No one has said yes yet. The table waits.' : 'The table is empty. Take the first seat.'}</span>

  // One scene element, shown either in the panel or in the big view (never both, so ids stay unique).
  const scene = (
      <svg className="scene" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice" role="img"
        onClick={() => { if (!expanded) setExpanded(true) }}
        aria-label={`The ritual table. ${attendingCount} attending, ${here} here now.`}>
        <defs>
          <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1a141e" /><stop offset="0.55" stopColor="#120e15" /><stop offset="1" stopColor="#09070b" />
          </linearGradient>
          <pattern id="bricks" width="64" height="30" patternUnits="userSpaceOnUse">
            <path d="M0 0.5 H64 M0 15.5 H64 M0.5 0 V15 M32.5 15 V30" stroke="#fff" strokeOpacity="0.05" fill="none" />
          </pattern>
          <radialGradient id="doorway-light" cx="0.5" cy="0.75" r="0.6">
            <stop offset="0" stopColor="#7a1424" stopOpacity="0.55" /><stop offset="1" stopColor="#7a1424" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="banner" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#6d1622" /><stop offset="1" stopColor="#2c070d" />
          </linearGradient>
          <radialGradient id="light-pool" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#f3a64a" stopOpacity="0.28" /><stop offset="0.6" stopColor="#b5602a" stopOpacity="0.08" /><stop offset="1" stopColor="#000" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="table-top" cx="0.5" cy="0.4" r="0.65">
            <stop offset="0" stopColor="#3a2c25" /><stop offset="0.7" stopColor="#21181a" /><stop offset="1" stopColor="#140f12" />
          </radialGradient>
          <radialGradient id="vignette" cx="0.5" cy="0.48" r="0.75">
            <stop offset="0.55" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.85" />
          </radialGradient>
          <radialGradient id="canvas" cx="0.45" cy="0.35" r="0.8">
            <stop offset="0" stopColor="#3a2b1f" /><stop offset="1" stopColor="#120d0a" />
          </radialGradient>
          <linearGradient id="silver" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#d9dde2" /><stop offset="1" stopColor="#7d838b" />
          </linearGradient>
          <filter id="fog-blur" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="14" /></filter>
        </defs>

        {/* the chamber */}
        <rect width="800" height="500" fill="url(#wall)" />
        <rect width="800" height="260" fill="url(#bricks)" />
        <path d="M322 250 V120 Q322 58 400 36 Q478 58 478 120 V250 Z" fill="#050406" />
        <path d="M322 250 V120 Q322 58 400 36 Q478 58 478 120 V250 Z" fill="url(#doorway-light)" />
        <path d="M322 250 V120 Q322 58 400 36 Q478 58 478 120 V250" fill="none" stroke="#2c2431" strokeWidth="6" />
        <Banner x={248} />
        <Banner x={552} />
        <Torch x={80} />
        <Torch x={720} />
        <SalmonPortrait x={165} y={112} />
        <MelangePainting x={635} y={112} />
        <rect x="0" y="0" width="34" height="500" fill="#0c0a0e" />
        <rect x="766" y="0" width="34" height="500" fill="#0c0a0e" />
        <path d="M34 0 V500 M766 0 V500" stroke="#2c2431" strokeWidth="2" />
        <path d="M0 250 H800" stroke="#000" strokeOpacity="0.6" strokeWidth="3" />
        <path d="M400 210 L60 500 M400 210 L250 500 M400 210 L550 500 M400 210 L740 500 M0 330 H800 M0 410 H800" stroke="#fff" strokeOpacity="0.03" />
        <ellipse cx={CX} cy={CY + 40} rx="380" ry="170" fill="url(#light-pool)" />

        {shadows.map(renderSeat)}
        {back.map(renderSeat)}

        {/* the table */}
        <ellipse cx={CX} cy={CY + 26} rx={TABLE.rx + 10} ry={TABLE.ry + 8} fill="#000" opacity="0.55" />
        <ellipse cx={CX} cy={CY + 14} rx={TABLE.rx} ry={TABLE.ry} fill="#140e0f" />
        <ellipse cx={CX} cy={CY} rx={TABLE.rx} ry={TABLE.ry} fill="url(#table-top)" stroke="#4a3a2a" strokeWidth="1.5" />
        <ellipse cx={CX} cy={CY} rx={TABLE.rx * 0.9} ry={TABLE.ry * 0.9} fill="none" stroke="url(#gold)" strokeOpacity="0.55" strokeWidth="1.6" />
        <ellipse cx={CX} cy={CY} rx={TABLE.rx * 0.84} ry={TABLE.ry * 0.84} fill="none" stroke="#c9a55c" strokeOpacity="0.25" strokeDasharray="2 7" />
        <g className="table-sigil" color="#d0453a" transform={`translate(${CX} ${CY}) scale(1 0.37)`}>
          <use href="#wm-sigil" x="-92" y="-92" width="184" height="184" filter="url(#soft-glow)" />
        </g>
        {TABLE_ITEMS.map((item, i) =>
          item.kind === 'candle' ? <Candle key={i} {...item} />
            : <g key={i} transform={`translate(${item.x} ${item.y})`}>{item.kind === 'cup' ? <Melange /> : <Platter />}</g>)}

        {front.map(renderSeat)}

        <g className="fog"><ellipse cx="230" cy="470" rx="260" ry="34" fill="#8a8095" opacity="0.13" filter="url(#fog-blur)" /></g>
        <g className="fog fog-2"><ellipse cx="600" cy="480" rx="280" ry="30" fill="#8a8095" opacity="0.1" filter="url(#fog-blur)" /></g>
        <rect width="800" height="500" fill="url(#vignette)" pointerEvents="none" />

        {[...shadows, ...seats].map(renderTag)}
      </svg>
  )

  return (
    <figure className="ritual">
      {expanded ? <div className="scene scene-placeholder" aria-hidden="true" /> : (
        <div className="scene-wrap">
          {scene}
          <button type="button" className="expand-btn" onClick={() => setExpanded(true)} aria-label="Open the chamber full screen">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
          </button>
        </div>
      )}
      <figcaption>{caption}</figcaption>
      {expanded && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label="The chamber">
          <div className="lightbox-scroll" ref={lightbox}>{scene}</div>
          <p className="lightbox-caption">{caption}</p>
          <button type="button" className="lightbox-close" onClick={() => setExpanded(false)} aria-label="Close the chamber view" autoFocus>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5 L19 19 M19 5 L5 19" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
          </button>
        </div>
      )}
    </figure>
  )
}

