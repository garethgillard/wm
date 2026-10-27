// The centrepiece: a round table in a candlelit dungeon. Every member sits at it as a robed,
// masked figure. Their candle is lit while they are here; empty chairs wait for newcomers.
import { useMemo, useState } from 'react'
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

const TABLE_CANDLES = [
  { a: -150, h: 34 }, { a: -90, h: 46 }, { a: -30, h: 30 }, { a: 30, h: 40 }, { a: 150, h: 36 }, { a: 90, h: 28 },
].map(c => {
  const r = (c.a * Math.PI) / 180
  return { x: CX + 150 * Math.cos(r), y: CY + 54 * Math.sin(r), h: c.h, delay: (Math.abs(c.a) % 7) / 10 }
}).sort((a, b) => a.y - b.y)

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
      <g color="#c9a55c" opacity="0.85"><use href="#vm-sigil" x="-20" y="80" width="40" height="40" /></g>
    </g>
  )
}

export function RitualTable({ party }) {
  const { players, online, typing, me } = party
  const [selected, setSelected] = useState(null)

  const members = useMemo(
    () => Object.values(players).sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id)),
    [players],
  )
  const seats = useMemo(() => {
    const layout = seatLayout(members.length)
    const taken = new Map()
    members.forEach((p, i) => taken.set(Math.round((i * layout.length) / members.length), p))
    return layout.map(seat => ({ ...seat, player: taken.get(seat.k) || null })).sort((a, b) => a.y - b.y)
  }, [members])

  const here = members.filter(p => online.includes(p.id)).length

  function renderSeat(seat) {
    const p = seat.player
    const transform = `translate(${seat.x}px, ${seat.y}px) scale(${seat.scale})`
    if (!p) {
      return <g key={`empty-${seat.k}`} className="seat" style={{ transform }}><Chair empty /></g>
    }
    const isHere = online.includes(p.id)
    return (
      <g key={p.id} className={`seat${isHere ? ' here' : ' away'}${p.id === me ? ' mine' : ''}`} style={{ transform }}
        role="button" tabIndex={0} aria-label={`${nameOf(players, p.id)}${p.id === me ? ' (you)' : ''}${isHere ? ', here now' : ''}`}
        onClick={() => setSelected(selected === p.id ? null : p.id)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(selected === p.id ? null : p.id) } }}>
        <title>{nameOf(players, p.id)}</title>
        <Chair />
        {p.id === me && <ellipse cx="0" cy="2" rx="44" ry="10" fill="none" stroke="url(#gold)" strokeWidth="2.5" />}
        <Figure player={p} lit={isHere} />
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

  return (
    <figure className="ritual">
      <svg className="scene" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice" role="img"
        aria-label={`The ritual table. ${members.length} members have taken a seat, ${here} here now.`}>
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
        <Torch x={120} />
        <Torch x={680} />
        <rect x="0" y="0" width="34" height="500" fill="#0c0a0e" />
        <rect x="766" y="0" width="34" height="500" fill="#0c0a0e" />
        <path d="M34 0 V500 M766 0 V500" stroke="#2c2431" strokeWidth="2" />
        <path d="M0 250 H800" stroke="#000" strokeOpacity="0.6" strokeWidth="3" />
        <path d="M400 210 L60 500 M400 210 L250 500 M400 210 L550 500 M400 210 L740 500 M0 330 H800 M0 410 H800" stroke="#fff" strokeOpacity="0.03" />
        <ellipse cx={CX} cy={CY + 40} rx="380" ry="170" fill="url(#light-pool)" />

        {back.map(renderSeat)}

        {/* the table */}
        <ellipse cx={CX} cy={CY + 26} rx={TABLE.rx + 10} ry={TABLE.ry + 8} fill="#000" opacity="0.55" />
        <ellipse cx={CX} cy={CY + 14} rx={TABLE.rx} ry={TABLE.ry} fill="#140e0f" />
        <ellipse cx={CX} cy={CY} rx={TABLE.rx} ry={TABLE.ry} fill="url(#table-top)" stroke="#4a3a2a" strokeWidth="1.5" />
        <ellipse cx={CX} cy={CY} rx={TABLE.rx * 0.9} ry={TABLE.ry * 0.9} fill="none" stroke="url(#gold)" strokeOpacity="0.55" strokeWidth="1.6" />
        <ellipse cx={CX} cy={CY} rx={TABLE.rx * 0.84} ry={TABLE.ry * 0.84} fill="none" stroke="#c9a55c" strokeOpacity="0.25" strokeDasharray="2 7" />
        <g className="table-sigil" color="#d0453a" transform={`translate(${CX} ${CY}) scale(1 0.37)`}>
          <use href="#vm-sigil" x="-92" y="-92" width="184" height="184" filter="url(#soft-glow)" />
        </g>
        {TABLE_CANDLES.map((c, i) => <Candle key={i} {...c} />)}

        {front.map(renderSeat)}

        <g className="fog"><ellipse cx="230" cy="470" rx="260" ry="34" fill="#8a8095" opacity="0.13" filter="url(#fog-blur)" /></g>
        <g className="fog fog-2"><ellipse cx="600" cy="480" rx="280" ry="30" fill="#8a8095" opacity="0.1" filter="url(#fog-blur)" /></g>
        <rect width="800" height="500" fill="url(#vignette)" pointerEvents="none" />

        {seats.map(renderTag)}
      </svg>
      <figcaption>
        {members.length ? (
          <>
            <span className="count-roman" aria-hidden="true">{roman(members.length)}</span>
            <span>{members.length === 1 ? 'One has taken a seat' : `${members.length} have taken a seat`} · {here} in the chamber now<span className="hint"> · tap a figure for their name</span></span>
          </>
        ) : <span>The table is empty. Take the first seat.</span>}
      </figcaption>
    </figure>
  )
}

