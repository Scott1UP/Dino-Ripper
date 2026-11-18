// Checks the card set and the pack odds. Run with `npm run sim`.
//
// It confirms the set has the right shape, that every pack is well formed, that 100,000 packs
// with the guarantees switched off come out at the configured odds, and that each guarantee
// fires when it should.

import { readFile } from 'node:fs/promises';
import { dealPack, NEW_LUCK, PACK_SIZE, PRESETS } from '../src/odds.ts';

const cards = JSON.parse(await readFile(new URL('../src/set.json', import.meta.url), 'utf8'));
const byId = new Map(cards.map((c) => [c.id, c]));
let failed = 0;
const check = (ok, label) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}`);
  if (!ok) failed++;
};

// ---- the set -------------------------------------------------------------------
const WANT = { common: 36, uncommon: 24, rare: 16, ultra: 18, secret: 5, gold: 1 };
const count = (r) => cards.filter((c) => c.rarity === r).length;
check(cards.length === 100, `100 cards (${cards.length})`);
for (const [r, n] of Object.entries(WANT)) check(count(r) === n, `${n} ${r} (${count(r)})`);
check(cards.every((c, i) => c.no === i + 1), 'numbered 1 to 100 in collection order');

const alts = cards.filter((c) => ['ultra', 'secret', 'gold'].includes(c.rarity));
check(alts.every((c) => byId.has(c.base)), 'every full-art card points at a base card');
check(alts.filter((c) => c.rarity !== 'ultra').every((c) => byId.get(c.base)?.rarity === 'rare'), 'secret and gold cards are new pictures of rares');
const versions = (id) => 1 + cards.filter((c) => c.base === id).length;
check(versions('rex') === 4, `T. rex has 4 versions besides the baby (${versions('rex')})`);
for (const id of ['spino', 'trike', 'raptor', 'brachio']) check(versions(id) === 3, `${byId.get(id).name} has 3 versions (${versions(id)})`);
for (const id of ['anky', 'giga', 'stego', 'allo', 'carno']) check(versions(id) === 2, `${byId.get(id).name} has 2 versions (${versions(id)})`);

// ---- 100,000 packs, guarantees off -----------------------------------------------
const N = 100_000;
for (const [name, preset] of Object.entries(PRESETS)) {
  const fair = { ...preset, pity: null };
  const last = {};
  const better = {};
  let wellFormed = true;
  let luck = { ...NEW_LUCK };
  for (let i = 0; i < N; i++) {
    const pack = dealPack(cards, luck, fair);
    luck = pack.luck;
    const r = pack.cards.map((c) => c.rarity);
    if (
      pack.cards.length !== PACK_SIZE ||
      new Set(pack.cards.map((c) => c.id)).size !== PACK_SIZE ||
      r.slice(0, 3).sort().join() !== 'common,common,uncommon' ||
      !(r[3] in preset.better) ||
      !(r[4] in preset.last)
    ) wellFormed = false;
    better[r[3]] = (better[r[3]] ?? 0) + 1;
    last[r[4]] = (last[r[4]] ?? 0) + 1;
  }
  check(wellFormed, `${name}: every pack has ${PACK_SIZE} different cards with the right tier in each slot`);
  for (const [slot, seen, table] of [['rare slot', last, preset.last], ['better slot', better, preset.better]]) {
    const total = Object.values(table).reduce((a, b) => a + b, 0);
    for (const [r, w] of Object.entries(table)) {
      const p = w / total;
      const got = (seen[r] ?? 0) / N;
      const se = Math.sqrt((p * (1 - p)) / N);
      check(Math.abs(got - p) <= 3 * se, `${name}: ${slot} ${r} ${(got * 100).toFixed(2)}% against ${(p * 100).toFixed(2)}% (3 standard errors is ${(300 * se).toFixed(2)})`);
    }
  }
}

// ---- the guarantees ----------------------------------------------------------------
const kid = PRESETS.kid;
// With a roll that always lands on the commonest outcome, only the guarantees can produce anything better.
const unlucky = { rng: () => 0 };
let luck = { ...NEW_LUCK };
const pulls = [];
for (let i = 1; i <= kid.pity.gold; i++) {
  const pack = dealPack(cards, luck, kid, unlucky);
  luck = pack.luck;
  pulls.push(pack.cards[4].rarity);
}
const packsWith = (r) => pulls.map((x, i) => (x === r ? i + 1 : 0)).filter(Boolean);
check(packsWith('ultra')[0] === kid.pity.ultra + 1, `ultra rare guaranteed after ${kid.pity.ultra} dry packs (first at pack ${packsWith('ultra')[0]})`);
check(packsWith('secret')[0] === kid.pity.secret + 1, `secret rare guaranteed after ${kid.pity.secret} packs without one (first at pack ${packsWith('secret')[0]})`);
check(packsWith('gold')[0] === kid.pity.gold, `gold card by pack ${kid.pity.gold} (at pack ${packsWith('gold')[0]})`);
let longest = 0, run = 0;
for (const r of pulls) longest = Math.max(longest, (run = r === 'rare' ? run + 1 : 0));
check(longest <= kid.pity.ultra, `never more than ${kid.pity.ultra} dry packs in a row (longest ${longest})`);
luck = { ...NEW_LUCK, gold: true, packs: 100 };
check(dealPack(cards, luck, kid, unlucky).pity === null, 'the gold guarantee switches off once the gold card has been pulled');

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exitCode = failed ? 1 : 0;
