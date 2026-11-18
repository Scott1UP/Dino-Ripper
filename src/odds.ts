// Pack odds, in one place. This file knows nothing about the page, so scripts/sim.mjs can run it
// on its own to check the numbers.

import type { Rarity } from './types';

type Table = Partial<Record<Rarity, number>>;

export interface Preset {
  /** Slot 4: a second chance at something better than a common. */
  better: Table;
  /** Slot 5, the rare slot. Always the best card in the pack. */
  last: Table;
  /**
   * Guarantees against bad luck, or null for none.
   * ultra: after this many packs in a row with nothing better than a rare, the next has an ultra rare.
   * secret: after this many in a row without a secret rare or the gold card, the next has a secret rare.
   * gold: the gold card is in this pack at the latest, if it has not turned up before.
   */
  pity: { ultra: number; secret: number; gold: number } | null;
}

export const PRESETS: Record<'kid' | 'realistic', Preset> = {
  // Generous, with guarantees: tuned for a young child.
  kid: {
    better: { common: 40, uncommon: 40, rare: 20 },
    last: { rare: 76, ultra: 16, secret: 7, gold: 1 },
    pity: { ultra: 5, secret: 15, gold: 60 },
  },
  // Close to the pull rates of a real modern set, with no guarantees.
  realistic: {
    better: { common: 40, uncommon: 40, rare: 20 },
    last: { rare: 87.3, ultra: 11, secret: 1.5, gold: 0.2 },
    pity: null,
  },
};
export const DEFAULT_PRESET: keyof typeof PRESETS = 'kid';
export const PACK_SIZE = 5;

/** What the guarantees need remembered between packs. Saved with the collection. */
export interface Luck {
  packs: number;
  /** Packs in a row with nothing better than a rare. */
  sinceUltra: number;
  /** Packs in a row with no secret rare and no gold card. */
  sinceSecret: number;
  gold: boolean;
}
export const NEW_LUCK: Luck = { packs: 0, sinceUltra: 0, sinceSecret: 0, gold: false };

export interface PackCard {
  id: string;
  no: number;
  rarity: Rarity;
}

export interface PackOptions {
  /** Fixes the rarity of the last card, for testing. */
  force?: Rarity;
  rng?: () => number;
}

/**
 * Deals one pack: two commons, an uncommon, the better slot and the rare slot, in that order.
 * A pack never holds the same card twice. Returns the cards, the luck to save for next time,
 * and which guarantee (if any) decided the last card.
 */
export function dealPack<T extends PackCard>(all: T[], luck: Luck, preset: Preset, options: PackOptions = {}) {
  const rng = options.rng ?? Math.random;
  const cards: T[] = [];

  const pick = (table: Table): T => {
    const fresh = (r: Rarity) => all.filter((c) => c.rarity === r && !cards.includes(c));
    // A rarity with no card left to give drops out of the roll.
    const open = (Object.entries(table) as [Rarity, number][]).filter(([r]) => fresh(r).length > 0);
    let roll = rng() * open.reduce((sum, [, w]) => sum + w, 0);
    let rarity = open[0][0];
    for (const [r, w] of open) {
      roll -= w;
      if (roll < 0) {
        rarity = r;
        break;
      }
    }
    const pool = fresh(rarity);
    return pool[Math.floor(rng() * pool.length)];
  };

  // One at a time, so that each pick can see what is already in the pack.
  for (const slot of [{ common: 1 }, { common: 1 }, { uncommon: 1 }]) cards.push(pick(slot));
  cards.sort((a, b) => a.no - b.no);
  cards.push(pick(preset.better));

  // The rare slot: a guarantee if one is due, otherwise the roll.
  const n = luck.packs + 1;
  const pity = preset.pity;
  let due: Rarity | null = null;
  if (pity && !luck.gold && n >= pity.gold) due = 'gold';
  else if (pity && luck.sinceSecret >= pity.secret) due = 'secret';
  else if (pity && luck.sinceUltra >= pity.ultra) due = 'ultra';
  const last = pick(options.force ? { [options.force]: 1 } : due ? { [due]: 1 } : preset.last);
  cards.push(last);

  const big = last.rarity === 'secret' || last.rarity === 'gold';
  const next: Luck = {
    packs: n,
    sinceUltra: big || last.rarity === 'ultra' ? 0 : luck.sinceUltra + 1,
    sinceSecret: big ? 0 : luck.sinceSecret + 1,
    gold: luck.gold || last.rarity === 'gold',
  };
  return { cards, luck: next, pity: options.force ? null : due };
}
