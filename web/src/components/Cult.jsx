// Shared drawings: the VM sigil, robed and masked figures, chairs and small avatars.
// Every drawing uses local coordinates with the seat point at (0, 0) and the hood tip near y = -118.
import { EMOJI, ROBES } from '../lib/constants'

// Gradients, clip paths and the sigil, defined once and referenced by every drawing on the page.
export function SvgDefs() {
  return (
    <svg className="svg-defs" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        {ROBES.map((r, i) => (
          <linearGradient key={i} id={`robe-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={r.lit} />
            <stop offset="0.45" stopColor={r.fill} />
            <stop offset="1" stopColor="#060508" />
          </linearGradient>
        ))}
        <radialGradient id="hood-shade" cx="0.5" cy="0.15" r="0.9">
          <stop offset="0" stopColor="#000" stopOpacity="0.85" />
          <stop offset="0.55" stopColor="#000" stopOpacity="0.25" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6dc9a" />
          <stop offset="0.5" stopColor="#c9a55c" />
          <stop offset="1" stopColor="#7c5a22" />
        </linearGradient>
        <radialGradient id="flame-glow">
          <stop offset="0" stopColor="#ffd88a" stopOpacity="0.85" />
          <stop offset="0.35" stopColor="#f39b3a" stopOpacity="0.35" />
          <stop offset="1" stopColor="#f39b3a" stopOpacity="0" />
        </radialGradient>
        <clipPath id="hood-hole"><ellipse cx="0" cy="-80" rx="15" ry="19" /></clipPath>
        <filter id="soft-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <symbol id="vm-sigil" viewBox="-50 -50 100 100">
          <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
            <circle r="46" strokeWidth="2.2" />
            <circle r="40.5" strokeWidth="0.9" />
            {Array.from({ length: 24 }, (_, i) => (
              <line key={i} x1="0" y1="-40.5" x2="0" y2={i % 2 ? -43.5 : -46} strokeWidth="0.9" transform={`rotate(${i * 15})`} />
            ))}
            <path d="M0 -36 L31.2 18 L-31.2 18 Z" strokeWidth="1.8" />
            <path d="M-15 -4 Q0 -16 15 -4 Q0 8 -15 -4 Z" strokeWidth="1.6" />
            <circle cy="-4" r="4.2" fill="currentColor" stroke="none" />
            <path d="M-14 26 L-9 38 L-4 26 M2 38 L2 26 L7 33 L12 26 L12 38" strokeWidth="1.6" />
          </g>
        </symbol>
      </defs>
    </svg>
  )
}

export function Sigil({ className, title }) {
  return (
    <svg className={className} viewBox="-50 -50 100 100" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : 'true'}>
      <use href="#vm-sigil" x="-50" y="-50" width="100" height="100" />
    </svg>
  )
}

const BODY = 'M-36 0 C-37 -22 -33 -44 -22 -56 C-15 -63 15 -63 22 -56 C33 -44 37 -22 36 0 Z'
const HOOD = 'M-25 -56 C-30 -78 -22 -104 0 -118 C22 -104 30 -78 25 -56 C12 -50 -12 -50 -25 -56 Z'
const FOLDS = 'M-11 -52 C-15 -32 -18 -14 -21 0 M10 -52 C13 -32 16 -14 18 0 M0 -50 C1 -30 -1 -14 0 0'
const MASK = 'M-15 -85 C-11 -91 -3 -90 0 -86 C3 -90 11 -91 15 -85 C14 -78 8 -76 4 -78 C2 -79 1 -80 0 -80 C-1 -80 -2 -79 -4 -78 C-8 -76 -14 -78 -15 -85 Z ' +
  'M-10.6 -83 a3.4 2.1 0 1 0 6.8 0 a3.4 2.1 0 1 0 -6.8 0 Z M3.8 -83 a3.4 2.1 0 1 0 6.8 0 a3.4 2.1 0 1 0 -6.8 0 Z'
export const CHAIR = 'M-31 6 L-31 -96 C-31 -121 -15 -135 0 -142 C15 -135 31 -121 31 -96 L31 6 Z'

// The hooded head: hood, face in the hood opening, shadow, and the gold masquerade mask.
function Head({ player, masked = true }) {
  const robe = player.color ?? 0
  return (
    <>
      <path d={HOOD} fill={`url(#robe-${robe})`} />
      <ellipse cx="0" cy="-80" rx="15" ry="19" fill="#07060a" />
      <g clipPath="url(#hood-hole)">
        <text x="0" y="-77" fontSize="23" textAnchor="middle" dominantBaseline="central">{EMOJI[player.emoji] ?? '❔'}</text>
        <ellipse cx="0" cy="-80" rx="15" ry="19" fill="url(#hood-shade)" />
      </g>
      {masked && <path d={MASK} fill="url(#gold)" fillRule="evenodd" stroke="#3b2a10" strokeWidth="0.6" />}
    </>
  )
}

// A seated, robed figure holding a candle. The candle is lit while the person is here.
export function Figure({ player, lit = false }) {
  const robe = player.color ?? 0
  return (
    <g className="figure">
      <path d={BODY} fill={`url(#robe-${robe})`} />
      <path d={FOLDS} fill="none" stroke="#000" strokeOpacity="0.35" strokeWidth="1.4" />
      <circle cx="0" cy="-56" r="2.6" fill="url(#gold)" />
      {/* candle held at the chest */}
      <ellipse cx="-6" cy="-24" rx="6" ry="4.5" fill={ROBES[robe].lit} opacity="0.9" />
      <ellipse cx="6" cy="-24" rx="6" ry="4.5" fill={ROBES[robe].lit} opacity="0.9" />
      <rect x="-2.6" y="-42" width="5.2" height="18" rx="1.2" fill="#e8dfcc" />
      {lit && (
        <g className="flame">
          <circle cx="0" cy="-48" r="16" fill="url(#flame-glow)" />
          <path d="M0 -55 C3 -50 3 -46 0 -43 C-3 -46 -3 -50 0 -55 Z" fill="#ffd27a" />
        </g>
      )}
      <Head player={player} />
    </g>
  )
}

export function Chair({ empty }) {
  return (
    <g className={empty ? 'chair empty' : 'chair'}>
      <path d={CHAIR} fill="#120f15" stroke="#2c2431" strokeWidth="1.5" />
      <path d="M-22 -96 C-22 -114 -10 -125 0 -130 C10 -125 22 -114 22 -96" fill="none" stroke="#2c2431" strokeWidth="1" />
      <circle cx="0" cy="-146" r="3.2" fill="url(#gold)" opacity="0.7" />
    </g>
  )
}

// Small hooded avatar for chat and lists.
export function Avatar({ player, size = 'sm' }) {
  return (
    <svg className={`av av-${size}`} viewBox="-31 -121 62 66" aria-hidden="true" focusable="false">
      {player ? <Head player={player} /> : <path d={HOOD} fill="#2a2530" />}
    </svg>
  )
}

export function AvatarStack({ ids, players, max = 6, title }) {
  const shown = ids.filter(id => players[id])
  if (!shown.length) return null
  return (
    <span className="stack" title={title}>
      {shown.slice(0, max).map(id => <Avatar key={id} player={players[id]} size="xs" />)}
      {shown.length > max && <span className="stack-more">+{shown.length - max}</span>}
    </span>
  )
}
