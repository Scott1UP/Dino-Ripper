// The collection, kept in the browser's local storage.

const KEY = 'dino-ripper:v1';

interface Save {
  counts: Record<string, number>;
  packs: number;
}

function load(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Partial<Save>;
      return { counts: s.counts ?? {}, packs: s.packs ?? 0 };
    }
  } catch {
    // Storage can be blocked; play without saving.
  }
  return { counts: {}, packs: 0 };
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
  add(ids: string[]) {
    for (const id of ids) save.counts[id] = (save.counts[id] ?? 0) + 1;
    save.packs += 1;
    persist();
  },
};
