export type Rarity = 'common' | 'uncommon' | 'rare' | 'ultra' | 'secret' | 'gold';
/** The print finish. Rarity sets the tier; the finish says how that card wears it (see card.css). */
export type Finish = 'matte' | 'lattice' | 'bubbles' | 'frame' | 'spot' | 'gold';
export type DinoType = 'leaf' | 'rock' | 'sky' | 'water' | 'fire' | 'storm';

export interface Move {
  name: string;
  cost: number;
  dmg: number;
}

export interface CardDef {
  id: string;
  no: number;
  name: string;
  rarity: Rarity;
  finish: Finish;
  type: DinoType;
  power: number;
  era: string;
  diet: string;
  size: string;
  moves: [Move, Move];
  fact: string;
}

export const RARITY: Record<Rarity, { tier: number; label: string; stars: string; style: string; fullArt: boolean }> = {
  common: { tier: 0, label: 'Common', stars: '●', style: 'Crayon & Pencil', fullArt: false },
  uncommon: { tier: 1, label: 'Uncommon', stars: '◆', style: 'Watercolour', fullArt: false },
  rare: { tier: 2, label: 'Rare', stars: '★', style: 'Pixel Art', fullArt: false },
  ultra: { tier: 3, label: 'Ultra Rare', stars: '★★', style: 'Spray Paint', fullArt: true },
  secret: { tier: 4, label: 'Secret Illustration Rare', stars: '★★', style: 'Storybook', fullArt: true },
  gold: { tier: 5, label: 'Gold Rare', stars: '★★★', style: 'Gold Relief', fullArt: true },
};

/** The set, in collection order: commons first, the gold card last. */
export const CARDS: CardDef[] = [
  {
    id: 'compy', no: 1, name: 'Compsognathus', rarity: 'common', finish: 'matte', type: 'leaf', power: 40,
    era: 'Jurassic', diet: 'Meat-eater', size: '1 m long',
    moves: [{ name: 'Quick Nip', cost: 1, dmg: 10 }, { name: 'Zoom Dash', cost: 2, dmg: 30 }],
    fact: 'About the size of a chicken, and one of the fastest little hunters of its time.',
  },
  {
    id: 'para', no: 2, name: 'Parasaurolophus', rarity: 'common', finish: 'matte', type: 'water', power: 70,
    era: 'Cretaceous', diet: 'Plant-eater', size: '9 m long',
    moves: [{ name: 'Crest Honk', cost: 1, dmg: 20 }, { name: 'Herd Rush', cost: 2, dmg: 40 }],
    fact: 'Its hollow crest worked like a trumpet, so it could call to its herd from far away.',
  },
  {
    id: 'pachy', no: 3, name: 'Pachycephalosaurus', rarity: 'common', finish: 'matte', type: 'rock', power: 60,
    era: 'Cretaceous', diet: 'Plant-eater', size: '4.5 m long',
    moves: [{ name: 'Head Bonk', cost: 1, dmg: 20 }, { name: 'Dome Charge', cost: 3, dmg: 50 }],
    fact: 'The bone on top of its head was 25 cm thick. That is thicker than a brick!',
  },
  {
    id: 'stego', no: 4, name: 'Stegosaurus', rarity: 'uncommon', finish: 'matte', type: 'leaf', power: 90,
    era: 'Jurassic', diet: 'Plant-eater', size: '9 m long',
    moves: [{ name: 'Plate Shield', cost: 1, dmg: 20 }, { name: 'Spike Swing', cost: 3, dmg: 60 }],
    fact: 'The four spikes on its tail have their own name: a thagomizer.',
  },
  {
    id: 'anky', no: 5, name: 'Ankylosaurus', rarity: 'uncommon', finish: 'matte', type: 'rock', power: 100,
    era: 'Cretaceous', diet: 'Plant-eater', size: '8 m long',
    moves: [{ name: 'Armour Up', cost: 1, dmg: 10 }, { name: 'Club Smash', cost: 3, dmg: 70 }],
    fact: 'Built like a tank. Even its eyelids were covered in armour.',
  },
  {
    id: 'trike', no: 6, name: 'Triceratops', rarity: 'rare', finish: 'lattice', type: 'leaf', power: 130,
    era: 'Cretaceous', diet: 'Plant-eater', size: '9 m long',
    moves: [{ name: 'Frill Flash', cost: 2, dmg: 40 }, { name: 'Triple Horn', cost: 3, dmg: 90 }],
    fact: 'Its skull was one of the biggest of any land animal: as long as a small car.',
  },
  {
    id: 'ptera', no: 7, name: 'Pteranodon', rarity: 'rare', finish: 'bubbles', type: 'sky', power: 110,
    era: 'Cretaceous', diet: 'Fish-eater', size: '7 m wings',
    moves: [{ name: 'Sky Dive', cost: 2, dmg: 50 }, { name: 'Wind Slice', cost: 3, dmg: 80 }],
    fact: 'Not a dinosaur but a flying reptile, with wings wider than a bus is long.',
  },
  {
    id: 'raptor', no: 8, name: 'Velociraptor', rarity: 'ultra', finish: 'frame', type: 'storm', power: 180,
    era: 'Cretaceous', diet: 'Meat-eater', size: '2 m long',
    moves: [{ name: 'Claw Flurry', cost: 2, dmg: 70 }, { name: 'Pack Ambush', cost: 3, dmg: 140 }],
    fact: 'It was covered in feathers and was about as tall as a turkey.',
  },
  {
    id: 'spino', no: 9, name: 'Spinosaurus', rarity: 'secret', finish: 'spot', type: 'water', power: 260,
    era: 'Cretaceous', diet: 'Fish-eater', size: '15 m long',
    moves: [{ name: 'River Lunge', cost: 2, dmg: 110 }, { name: 'Sail Storm', cost: 4, dmg: 220 }],
    fact: 'The longest meat-eating dinosaur ever found, and it could swim.',
  },
  {
    id: 'rex', no: 10, name: 'Tyrannosaurus Rex', rarity: 'gold', finish: 'gold', type: 'fire', power: 330,
    era: 'Cretaceous', diet: 'Meat-eater', size: '12 m long',
    moves: [{ name: 'King Roar', cost: 3, dmg: 150 }, { name: 'Titan Bite', cost: 4, dmg: 300 }],
    fact: 'The king. Its bite was the strongest of any land animal that has ever lived.',
  },
];

export const TOTAL = CARDS.length;
export const PACK_SIZE = 5;

/** True for the rarities that get the big reveal, and a sleeve afterwards. */
export const isBigPull = (def: CardDef) => RARITY[def.rarity].tier >= 3;

// Pull rates. Three everyday slots, one better slot, and one rare slot at the end.
const EVERYDAY: [Rarity, number][] = [['common', 72], ['uncommon', 28]];
const BETTER: [Rarity, number][] = [['uncommon', 72], ['rare', 28]];
const RARE_SLOT: [Rarity, number][] = [['rare', 80], ['ultra', 13], ['secret', 5], ['gold', 2]];

/**
 * Picks a card for one slot. A pack never holds the same card twice: a rarity with no card left
 * to give drops out of the roll, and if the slot's whole table is used up, the commonest unused
 * card fills in.
 */
function pick(table: [Rarity, number][], taken: CardDef[]): CardDef {
  const fresh = (r: Rarity) => CARDS.filter((c) => c.rarity === r && !taken.includes(c));
  const open = table.filter(([r]) => fresh(r).length > 0);
  if (!open.length) return CARDS.find((c) => !taken.includes(c))!;
  let roll = Math.random() * open.reduce((sum, [, w]) => sum + w, 0);
  let rarity = open[0][0];
  for (const [r, w] of open) {
    roll -= w;
    if (roll < 0) {
      rarity = r;
      break;
    }
  }
  const pool = fresh(rarity);
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Five different cards, the rare slot last. `?force=gold` (or any rarity) in the address fixes the last card, for testing. */
export function openPack(): CardDef[] {
  const cards: CardDef[] = [];
  for (let i = 0; i < PACK_SIZE - 2; i++) cards.push(pick(EVERYDAY, cards));
  cards.sort((a, b) => a.no - b.no);
  cards.push(pick(BETTER, cards));
  const forced = new URLSearchParams(location.search).get('force') as Rarity | null;
  cards.push(pick(forced && forced in RARITY ? [[forced, 1]] : RARE_SLOT, cards));
  return cards;
}
