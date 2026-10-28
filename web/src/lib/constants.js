// Keep EMOJI and ROBES the same length as EMOJI_COUNT / COLOR_COUNT in app/store.py (56 and 16).
export const EMOJI = ['🦊','🐺','🐱','🦉','🐸','🐗','🐲','🦇','🐐','🐍','🐙','🦄','🐰','🐭','🐻','🐼','🐯','🦁','🐷','🐮','🐴','🦝','🐵','🐟',
  // added later; keep new ones at the end so existing members keep their familiar
  '🙈','🙊','🙉','💀','👻','🎃','👹','👺',
  '😈','🌚','👽','🐶','🐹','🐨','🦓','🐡',
  '🐠','🐳','🦀','🦑','🐞','🐝','🦋','🐌',
  '🐔','🐧','🕊️','🦅','🦆','🦜','🦢','🦩']

// Robe colours. `fill` is the cloth, `lit` the candlelit edge of the folds,
// `ink` a readable tint for that person's name in the chat.
export const ROBES = [
  { name: 'Obsidian', fill: '#1b1a21', lit: '#3a3744', ink: '#b3adc2' },
  { name: 'Oxblood', fill: '#4f1019', lit: '#8a2331', ink: '#e8737f' },
  { name: 'Midnight', fill: '#172042', lit: '#2f3f78', ink: '#8ba5f5' },
  { name: 'Nightshade', fill: '#34183a', lit: '#5e3368', ink: '#c993d8' },
  { name: 'Moss', fill: '#1f2e1c', lit: '#3d5536', ink: '#97c582' },
  { name: 'Ash', fill: '#45414d', lit: '#6d6878', ink: '#cfcad6' },
  { name: 'Bone', fill: '#b9ae9a', lit: '#e3d9c6', ink: '#f1e8d5' },
  { name: 'Gilt', fill: '#6e531f', lit: '#b38a3c', ink: '#ecc873' },
  { name: 'Ember', fill: '#5c2a0e', lit: '#a5531f', ink: '#f39a5c' },
  { name: 'Abyss', fill: '#0e3236', lit: '#1d6166', ink: '#6fd3d0' },
  { name: 'Rose', fill: '#4a1430', lit: '#8a2d5c', ink: '#ef8fbe' },
  { name: 'Violet', fill: '#23164a', lit: '#47358a', ink: '#a99af5' },
  { name: 'Ochre', fill: '#5b4a0e', lit: '#9c8422', ink: '#f0dc6a' },
  { name: 'Frost', fill: '#8fa7b8', lit: '#c9d9e4', ink: '#bfe0f5' },
  { name: 'Rust', fill: '#3e2416', lit: '#6e4430', ink: '#d8a27e' },
  { name: 'Absinthe', fill: '#3a4a0c', lit: '#6f8a1a', ink: '#c8e86a' },
]

export const IDEAS = ['Costume contest', 'Tarot readings', 'Pumpkin carving', 'Murder mystery', 'Horror film night', 'Ghost story circle', 'Melange tasting', 'Séance']

export const HISTORY = 300 // messages kept in the browser

// Reactions to whispers. Keep the length equal to REACTION_COUNT in app/store.py (8).
export const REACTIONS = ['👍', '❤️', '😂', '😮', '💀', '🔥', '☕', '🐟']
// The ones offered in the picker. 😮 is retired from the picker but stays in REACTIONS, because
// saved reactions are stored by position and must keep their meaning.
export const REACTION_PICKER = [0, 1, 2, 4, 5, 6, 7]

// Emotes at the table: pop up over your figure for everyone watching. `say` is shown under the emoji.
// Keep the count equal to EMOTE_COUNT in app/main.py (18).
export const EMOTES = [
  // classics first (no text), then the short captions
  { emoji: '👋', label: 'Wave' }, { emoji: '😂', label: 'Laugh' }, { emoji: '❤️', label: 'Love' },
  { emoji: '👏', label: 'Clap' }, { emoji: '😱', label: 'Scream' }, { emoji: '🎃', label: 'Pumpkin' },
  { emoji: '🙌', label: 'Hail', say: 'Hail!' }, { emoji: '🔥', label: 'Fire', say: 'Burn it all!' }, { emoji: '🥂', label: 'Cheers', say: 'Skål!' },
  // the WM and science specials
  { emoji: '💀', label: 'Dead', say: 'Death to NMBU!' }, { emoji: '☕', label: 'Toast the Melange', say: 'Wiener Melange!' },
  { emoji: '🐟', label: 'Salmon', say: 'Salmo salar!' }, { emoji: '🔮', label: 'Chant', say: '*chanting sounds*' },
  { emoji: '🧬', label: 'DNA', say: 'ATGCGTACGTTAGC' }, { emoji: '👯', label: 'Duplicate', say: 'Whole genome duplication!' },
  { emoji: '📈', label: 'Significant', say: 'p < 0.05!' }, { emoji: '🦠', label: 'Alive', say: "It's alive!" },
  { emoji: '💻', label: 'Laptop', say: 'Death to Orion!' },
]
export const DEFAULT_NAME = 'The Melange Conclave'

// Secret names mix three worlds: gothic cult, animals, and the lab.
const TITLES = ['Acolyte', 'Oracle', 'Keeper', 'Warden', 'Seer', 'Herald', 'Archivist', 'Envoy', 'Sexton', 'Curate']
const GOTHIC = ['Velvet', 'Hollow', 'Ashen', 'Gilded', 'Silent', 'Crimson', 'Veiled', 'Waning', 'Moonlit', 'Obsidian', 'Shrouded', 'Pale', 'Sable', 'Spectral', 'Roasted']
const LAB = ['Mutant', 'Recessive', 'Cloned', 'Diploid', 'Polyploid', 'Transgenic', 'Fermented', 'Spliced', 'Methylated', 'Duplicated', 'Isotopic', 'Centrifuged']
const ANIMALS = ['Moth', 'Raven', 'Owl', 'Salmon', 'Axolotl', 'Tardigrade', 'Zebrafish', 'Lamprey', 'Newt', 'Bat', 'Toad', 'Octopus', 'Mole Rat', 'Hagfish', 'Nematode', 'Wolf', 'Goat', 'Jellyfish']
const RELICS = ['Genome', 'Helix', 'Ribosome', 'Codon', 'Enzyme', 'Plasmid', 'Petri Dish', 'Centrifuge', 'Isotope', 'Ohnolog', 'Mitochondria', 'Pipette', 'Sequencer', 'Melange']

export const rand = n => Math.floor(Math.random() * n)
const pick = list => list[rand(list.length)]

const PATTERNS = [
  () => `${pick(TITLES)} ${pick(GOTHIC)} ${pick(ANIMALS)}`,    // Acolyte Ashen Axolotl
  () => `${pick(TITLES)} of the ${pick(RELICS)}`,               // Oracle of the Ribosome
  () => `The ${pick(LAB)} ${pick(ANIMALS)}`,                    // The Methylated Moth
  () => `${pick(GOTHIC)} ${pick(ANIMALS)} of the ${pick(RELICS)}`, // Pale Newt of the Helix
  () => `${pick(TITLES)} ${pick(LAB)} ${pick(ANIMALS)}`,        // Seer Spliced Salmon
]

export function randomName() {
  for (;;) {
    const name = pick(PATTERNS)()
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

