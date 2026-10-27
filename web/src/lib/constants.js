// Keep EMOJI and ROBES the same length as EMOJI_COUNT / COLOR_COUNT in app/store.py (24 and 8).
export const EMOJI = ['🦊','🐺','🐱','🦉','🐸','🐗','🐲','🦇','🐐','🐍','🐙','🦄','🐰','🐭','🐻','🐼','🐯','🦁','🐷','🐮','🐴','🦝','🐵','🐟']

// Robe colours. `fill` is the cloth, `lit` the candlelit edge of the folds.
export const ROBES = [
  { name: 'Obsidian', fill: '#1b1a21', lit: '#3a3744' },
  { name: 'Oxblood', fill: '#4f1019', lit: '#8a2331' },
  { name: 'Midnight', fill: '#172042', lit: '#2f3f78' },
  { name: 'Nightshade', fill: '#34183a', lit: '#5e3368' },
  { name: 'Moss', fill: '#1f2e1c', lit: '#3d5536' },
  { name: 'Ash', fill: '#45414d', lit: '#6d6878' },
  { name: 'Bone', fill: '#b9ae9a', lit: '#e3d9c6' },
  { name: 'Gilt', fill: '#6e531f', lit: '#b38a3c' },
]

export const IDEAS = ['Costume contest', 'Tarot readings', 'Pumpkin carving', 'Murder mystery', 'Horror film night', 'Ghost story circle', 'Candlelit dinner', 'Séance']

export const HISTORY = 300 // messages kept in the browser

const TITLES = ['Acolyte', 'Oracle', 'Keeper', 'Warden', 'Seer', 'Herald', 'Archivist', 'Envoy']
const ADJ = ['Velvet', 'Hollow', 'Ashen', 'Gilded', 'Silent', 'Crimson', 'Veiled', 'Waning', 'Moonlit', 'Obsidian', 'Shrouded', 'Pale', 'Ember', 'Midnight', 'Sable', 'Wandering']
const NOUN = ['Moth', 'Raven', 'Owl', 'Fox', 'Serpent', 'Hare', 'Toad', 'Bat', 'Lynx', 'Stag', 'Goat', 'Wolf', 'Spider', 'Crow', 'Elk', 'Newt']

export const rand = n => Math.floor(Math.random() * n)
const pick = list => list[rand(list.length)]

export function randomName() {
  for (;;) {
    const base = `${pick(ADJ)} ${pick(NOUN)}`
    const name = Math.random() < 0.6 ? `${pick(TITLES)} ${base}` : `The ${base}`
    if (name.length <= 28) return name
  }
}

export function roman(n) {
  if (n <= 0) return '—'
  const table = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]
  let out = ''
  for (const [v, s] of table) while (n >= v) { out += s; n -= v }
  return out
}
