// Keep EMOJI and ROBES the same length as EMOJI_COUNT / COLOR_COUNT in app/store.py (24 and 8).
export const EMOJI = ['🦊','🐺','🐱','🦉','🐸','🐗','🐲','🦇','🐐','🐍','🐙','🦄','🐰','🐭','🐻','🐼','🐯','🦁','🐷','🐮','🐴','🦝','🐵','🐟']

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
]

export const IDEAS = ['Costume contest', 'Tarot readings', 'Pumpkin carving', 'Murder mystery', 'Horror film night', 'Ghost story circle', 'Melange tasting', 'Séance']

export const HISTORY = 300 // messages kept in the browser
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

