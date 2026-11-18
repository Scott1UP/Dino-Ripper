// The collection, kept in the browser's local storage.

import { type Luck, NEW_LUCK } from './odds';
import set from './set.json';

const KEY = 'dino-ripper:v2';

interface Save {
  counts: Record<string, number>;
  luck: Luck;
  /** "Auto open next pack" is ticked. */
  auto: boolean;
  /** The collection-complete celebration has been shown. */
  celebrated: boolean;
}

/** The ten-card test set used three ids that now belong to different cards of the same dinosaur. */
const RENAMED: Record<string, string> = { rex: 'rex-gold', spino: 'spino-secret', raptor: 'raptor-ultra' };

function load(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Partial<Save>;
      return { counts: s.counts ?? {}, luck: { ...NEW_LUCK, ...s.luck }, auto: s.auto ?? false, celebrated: s.celebrated ?? false };
    }
    // Carry a collection over from the test set.
    const old = localStorage.getItem('dino-ripper:v1');
    if (old) {
      const s = JSON.parse(old) as { counts?: Record<string, number>; packs?: number };
      const counts: Record<string, number> = {};
      for (const [id, n] of Object.entries(s.counts ?? {})) counts[RENAMED[id] ?? id] = n;
      return { counts, luck: { ...NEW_LUCK, packs: s.packs ?? 0, gold: (counts['rex-gold'] ?? 0) > 0 }, auto: false, celebrated: false };
    }
  } catch {
    // Storage can be blocked; play without saving.
  }
  return { counts: {}, luck: { ...NEW_LUCK }, auto: false, celebrated: false };
}

/**
 * Showcases: `?force=<name>` in the address starts from a made-up collection, for showing the artwork
 * or trying out the end of the game. A showcase is never saved and never touches the visitor's real
 * collection; reloading starts it afresh.
 *
 *   all    every card, one of each: a full binder to look through
 *   trade  95 cards and ten spare copies: the trade for the remaining 5 cards is on offer
 *   ten    90 cards and ten spare copies: the same, with 10 cards to gain
 *   early  89 cards and ten spares: one short of where trading starts, so no offer
 *   last   99 cards, missing only the gold card, and every pack's last card is the gold one
 */
const first = (n: number, tripled: number) => Object.fromEntries(set.slice(0, n).map((c, i) => [c.id, i < tripled ? 3 : 1]));
const SHOWCASES: Record<string, () => Record<string, number>> = {
  all: () => first(set.length, 0),
  trade: () => first(95, 5),
  ten: () => first(90, 5),
  early: () => first(89, 5),
  last: () => first(99, 0),
};
/** The showcase named in the address, if any. */
export const showcaseName = new URLSearchParams(location.search).get('force') ?? '';
const showcase = showcaseName in SHOWCASES;
const save: Save = showcase
  ? {
      counts: SHOWCASES[showcaseName](),
      luck: { ...NEW_LUCK, packs: showcaseName === 'all' ? 0 : 150, gold: showcaseName === 'all' },
      auto: false,
      celebrated: showcaseName === 'all',
    }
  : load();

function persist() {
  if (showcase) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // ignore
  }
}

export const store = {
  count: (id: string) => save.counts[id] ?? 0,
  owned: () => Object.keys(save.counts).filter((id) => save.counts[id] > 0).length,
  get luck() {
    return save.luck;
  },
  /** Empties the collection and starts the luck over, as if the app had never been opened. */
  reset() {
    save.counts = {};
    save.luck = { ...NEW_LUCK };
    save.celebrated = false;
    persist();
    if (showcase) return;
    try {
      // Otherwise a save left over from the test set would be brought back in on the next visit.
      localStorage.removeItem('dino-ripper:v1');
    } catch {
      // ignore
    }
  },
  get auto() {
    return save.auto;
  },
  set auto(on: boolean) {
    save.auto = on;
    persist();
  },
  get celebrated() {
    return save.celebrated;
  },
  set celebrated(done: boolean) {
    save.celebrated = done;
    persist();
  },
  /** How many spare copies there are: every copy of a card beyond the first. */
  spares: () => Object.values(save.counts).reduce((sum, n) => sum + Math.max(0, n - 1), 0),
  /** Hands in every spare copy, leaving one of each card, and adds the given missing cards. */
  trade(missing: string[]) {
    for (const id of Object.keys(save.counts)) if (save.counts[id] > 1) save.counts[id] = 1;
    for (const id of missing) save.counts[id] = 1;
    // The gold card no longer needs guaranteeing once it has been traded for.
    if (missing.includes('rex-gold')) save.luck = { ...save.luck, gold: true };
    persist();
  },
  /** Records an opened pack: its cards, and the luck to carry into the next one. */
  add(ids: string[], luck: Luck) {
    for (const id of ids) save.counts[id] = (save.counts[id] ?? 0) + 1;
    save.luck = luck;
    persist();
  },
};
