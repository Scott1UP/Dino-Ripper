// The card set. The cards themselves live in set.json (written by scripts/build-set.py).

import { dealPack, DEFAULT_PRESET, PRESETS } from './odds';
import set from './set.json';
import { showcaseName, store } from './store';
import type { Rarity } from './types';

export type { Rarity };
export { PACK_SIZE } from './odds';
export type DinoType = 'leaf' | 'rock' | 'sky' | 'water' | 'fire' | 'storm';
/** The print finish. Rarity sets the tier; the finish says how that card wears it (see card.css). */
export type Finish = 'matte' | 'lattice' | 'bubbles' | 'frame' | 'spot' | 'gold';

export interface Move {
  name: string;
  cost: number;
  dmg: number;
}

export interface CardDef {
  id: string;
  /** Its place in the collection, 1 to 100. */
  no: number;
  name: string;
  rarity: Rarity;
  finish: Finish;
  type: DinoType;
  power: number;
  era: string;
  diet: string;
  size: string;
  moves: Move[];
  fact: string;
  /** The invented artist credited on the card. */
  artistName: string;
  /** For a new picture of a dinosaur that already has a card: that card's id. */
  base?: string;
  /** Where the foil goes on a spot-finish card, as CSS gradients. */
  spots?: string;
}

export const RARITY: Record<Rarity, { tier: number; label: string; stars: string; fullArt: boolean }> = {
  common: { tier: 0, label: 'Common', stars: '●', fullArt: false },
  uncommon: { tier: 1, label: 'Uncommon', stars: '◆', fullArt: false },
  rare: { tier: 2, label: 'Rare', stars: '★', fullArt: false },
  ultra: { tier: 3, label: 'Ultra Rare', stars: '★★', fullArt: true },
  secret: { tier: 4, label: 'Secret Illustration Rare', stars: '★★', fullArt: true },
  gold: { tier: 5, label: 'Gold Rare', stars: '★★★', fullArt: true },
};

// Rares take turns between the two patterned foils.
let rares = 0;
const finishFor = (rarity: Rarity): Finish => {
  if (rarity === 'rare') return rares++ % 2 ? 'bubbles' : 'lattice';
  const plain: Record<Exclude<Rarity, 'rare'>, Finish> = { common: 'matte', uncommon: 'matte', ultra: 'frame', secret: 'spot', gold: 'gold' };
  return plain[rarity];
};

/** The set, in collection order: commons first, the gold card last. */
export const CARDS: CardDef[] = (set as unknown as Omit<CardDef, 'finish'>[]).map((c) => ({ ...c, finish: finishFor(c.rarity) }));
export const TOTAL = CARDS.length;

/** True for the rarities that get the big reveal, and a sleeve afterwards. */
export const isBigPull = (def: CardDef) => RARITY[def.rarity].tier >= 3;

/**
 * Opens a pack and records it. Returns the cards, rare slot last, and which were not in the
 * collection before. `?force=gold` (or any rarity) in the address fixes the last card, for testing;
 * so does the `last` showcase (see store.ts), which is about pulling the final card of the set.
 */
export function openPack(): { cards: CardDef[]; fresh: Set<string> } {
  const asked = showcaseName === 'last' ? 'gold' : showcaseName;
  const force = asked in RARITY ? (asked as Rarity) : undefined;
  const { cards, luck } = dealPack(CARDS, store.luck, PRESETS[DEFAULT_PRESET], { force });
  const fresh = new Set(cards.filter((c) => store.count(c.id) === 0).map((c) => c.id));
  store.add(cards.map((c) => c.id), luck);
  return { cards, fresh };
}
