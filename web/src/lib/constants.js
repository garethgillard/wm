// Keep EMOJI and COLORS the same length as EMOJI_COUNT / COLOR_COUNT in app/store.py.
export const EMOJI = ['🦊','🐙','🦉','🐧','🦄','🐸','🐼','🦖','🐳','🦩','🐝','🦦','🐨','🐯','🦁','🐷','🐵','🦔','🐢','🦀','🍄','👽','🤖','🐟']
export const COLORS = ['#FFD6A5','#FDF1A0','#C6F3BA','#A6EEF5','#B4CCFF','#CDBFFF','#FFC9F2','#FFB3AE']

export const IDEAS = ['Bowling', 'Karaoke night', 'Pub quiz', 'Escape room', 'Taco Friday', 'Sauna and fjord dip', 'Board game night', 'Curling']

export const HISTORY = 300 // messages kept in the browser

const TITLES = ['Agent', 'Captain', 'Doctor', 'Professor', 'Baron', 'Admiral', 'Detective', 'Commander']
const ADJ = ['Disco', 'Turbo', 'Velvet', 'Midnight', 'Cosmic', 'Sneaky', 'Polar', 'Neon', 'Crispy', 'Jazzy', 'Silent', 'Golden', 'Funky', 'Rogue', 'Fuzzy', 'Electric']
const NOUN = ['Puffin', 'Moose', 'Herring', 'Lynx', 'Walrus', 'Troll', 'Otter', 'Narwhal', 'Lemming', 'Waffle', 'Reindeer', 'Salmon', 'Brunost', 'Viking', 'Pickle', 'Badger']

export const rand = n => Math.floor(Math.random() * n)
const pick = list => list[rand(list.length)]

export function randomName() {
  const base = `${pick(ADJ)} ${pick(NOUN)}`
  return Math.random() < 0.55 ? `${pick(TITLES)} ${base}` : base
}
