// The collection, kept in the browser's local storage.

import { type Luck, NEW_LUCK } from './odds';

const KEY = 'dino-ripper:v2';

interface Save {
  counts: Record<string, number>;
  luck: Luck;
}

/** The ten-card test set used three ids that now belong to different cards of the same dinosaur. */
const RENAMED: Record<string, string> = { rex: 'rex-gold', spino: 'spino-secret', raptor: 'raptor-ultra' };

function load(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Partial<Save>;
      return { counts: s.counts ?? {}, luck: { ...NEW_LUCK, ...s.luck } };
    }
    // Carry a collection over from the test set.
    const old = localStorage.getItem('dino-ripper:v1');
    if (old) {
      const s = JSON.parse(old) as { counts?: Record<string, number>; packs?: number };
      const counts: Record<string, number> = {};
      for (const [id, n] of Object.entries(s.counts ?? {})) counts[RENAMED[id] ?? id] = n;
      return { counts, luck: { ...NEW_LUCK, packs: s.packs ?? 0, gold: (counts['rex-gold'] ?? 0) > 0 } };
    }
  } catch {
    // Storage can be blocked; play without saving.
  }
  return { counts: {}, luck: { ...NEW_LUCK } };
}

const save = load();

function persist() {
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
  /** Records an opened pack: its cards, and the luck to carry into the next one. */
  add(ids: string[], luck: Luck) {
    for (const id of ids) save.counts[id] = (save.counts[id] ?? 0) + 1;
    save.luck = luck;
    persist();
  },
};
