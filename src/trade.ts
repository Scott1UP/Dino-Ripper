// Trading in duplicates. Near the end of the set the last few cards can take a great many packs to
// turn up, so from TRADE_AT cards onwards every spare copy can be handed in, all at once, for every
// card still missing.

import { audio } from './audio';
import { createCard } from './card';
import { type CardDef, CARDS, TOTAL } from './cards';
import { celebrateIfComplete } from './complete';
import { store } from './store';

/** How many different cards must be collected before the trade is offered. */
const TRADE_AT = 90;
export const TRADE_LABEL = 'Trade duplicates for the remaining cards';

export function canTrade(): boolean {
  const owned = store.owned();
  return owned >= TRADE_AT && owned < TOTAL && store.spares() > 0;
}

const root = document.querySelector<HTMLElement>('#gained')!;
/** Cards in a row when the gained cards are shown: five or fewer make one row, up to ten make two. */
const PER_ROW = 5;
const CARD_RATIO = 88 / 63;
let trading = false;

/**
 * Lays the cards just gained out on a dark screen, face up, and waits for the button under them.
 */
function showGained(gained: CardDef[]): Promise<void> {
  const rows = Math.ceil(gained.length / PER_ROW);
  const cols = Math.min(PER_ROW, gained.length);
  const gap = Math.min(innerWidth, innerHeight) * 0.022;
  // As large as fits between the heading and the button.
  const width = Math.min((innerWidth * 0.94 - gap * (cols - 1)) / cols, (innerHeight * 0.7 - gap * (rows - 1)) / rows / CARD_RATIO, 300);

  root.innerHTML = `
    <h2>${gained.length === 1 ? 'Your last card!' : `Your last ${gained.length} cards!`}</h2>
    <div class="gained-grid" style="--w:${width}px;--gap:${gap}px;--cols:${cols}"></div>
    <button class="trade" type="button">Add to binder</button>`;
  const grid = root.querySelector<HTMLElement>('.gained-grid')!;
  /** Seconds between one card starting to arrive and the next. */
  const STEP = 0.07;
  gained.forEach((def, i) => {
    const card = createCard(def);
    card.classList.add('shine');
    // The card sits in a slot with a cover over it; the entrance lifts the cover (see style.css).
    const slot = document.createElement('div');
    slot.className = 'gained-slot';
    slot.style.setProperty('--deal', `${i * STEP}s`);
    slot.append(card);
    grid.append(slot);
  });
  // The button arrives just after the last card.
  root.style.setProperty('--after', `${0.15 + gained.length * STEP}s`);
  root.classList.remove('go');
  root.classList.add('on');

  // The cards are put in place, hidden, and only start to arrive once their pictures are decoded and
  // the browser has drawn them. Full-art foil cards take a moment to draw the first time; starting the
  // entrance straight away would spend all of it on that, and the cards would just pop in at the end.
  const pictures = [...grid.querySelectorAll('img')].map((img) => img.decode().catch(() => undefined));
  const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
  void Promise.all(pictures)
    .then(frame)
    .then(frame)
    .then(() => {
      root.classList.add('go');
      gained.forEach((_, i) => setTimeout(() => audio.slide(i), i * STEP * 1000));
    });

  return new Promise((resolve) => {
    root.querySelector('button')!.addEventListener('click', () => {
      audio.tap();
      root.classList.remove('on', 'go');
      root.innerHTML = '';
      resolve();
    });
  });
}

/**
 * Hands in every duplicate and completes the collection: the cards gained are shown first, then the
 * collection-complete celebration. Anything showing the collection hears about the change.
 */
export async function tradeAll() {
  if (trading || !canTrade()) return;
  trading = true;
  const gained = CARDS.filter((c) => store.count(c.id) === 0);
  store.trade(gained.map((c) => c.id));
  audio.binder();
  dispatchEvent(new Event('collection-changed'));
  await showGained(gained);
  celebrateIfComplete();
  trading = false;
}
