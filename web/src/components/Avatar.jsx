import { COLORS, EMOJI } from '../lib/constants'

export function Avatar({ player, size = 'sm' }) {
  if (!player) return <span className={`av av-${size}`} aria-hidden="true">❔</span>
  return (
    <span className={`av av-${size}`} style={{ '--av': COLORS[player.color] }} aria-hidden="true">
      {EMOJI[player.emoji]}
    </span>
  )
}

export function AvatarStack({ ids, players, max = 6, title }) {
  const shown = ids.filter(id => players[id])
  if (!shown.length) return null
  return (
    <span className="stack" title={title}>
      {shown.slice(0, max).map(id => <Avatar key={id} player={players[id]} size="xs" />)}
    </span>
  )
}
