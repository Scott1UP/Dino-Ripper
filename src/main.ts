import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/lilita-one/400.css';
import './style.css';
import './card.css';

import { audio } from './audio';
import { initBinder, refreshPeek } from './binder';
import { createCard } from './card';
import { type CardDef, isBigPull, openPack, PACK_SIZE, RARITY } from './cards';
import { fx } from './fx';
import { Packs } from './packs';
import { store } from './store';
import { wait } from './tween';
import { zoomCards } from './zoom';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const table = $('#table');
const hint = $('#hint');
const nextBtn = $<HTMLButtonElement>('#next');
const celebrate = $('#celebrate');
const banner = $('#banner');
const sleeveBtn = $('#tap');
const arrow = $('#arrow');
const peek = $('#binder-peek');
const mute = $<HTMLButtonElement>('#mute');

const CARD_RATIO = 88 / 63;

interface Pulled {
  def: CardDef;
  el: HTMLElement;
  isNew: boolean;
  flipped: boolean;
  /** Its place on the table. */
  x: number;
  y: number;
}

type State = 'idle' | 'opening' | 'reveal' | 'collecting';
let state: State = 'idle';
let pulled: Pulled[] = [];
/** True while a big reveal has the screen. */
let busy = false;
let cardW = 200;

const packs = new Packs($<HTMLCanvasElement>('#packs'));

/** The arrow points at the shelf while the only thing to do is pick a pack. */
function showArrow(on: boolean) {
  const edge = packs.shelfEdge();
  const size = arrow.offsetWidth;
  arrow.style.transform = `translate(${edge.x - size * 1.15}px, ${edge.y - size / 2}px)`;
  arrow.classList.toggle('on', on);
}

function setHint(text: string) {
  hint.textContent = text;
  hint.classList.toggle('on', text !== '');
}

function put(el: HTMLElement, x: number, y: number, scale = 1, rot = 0, ms = 0, easing = 'cubic-bezier(0.2, 0.9, 0.25, 1)') {
  el.style.transition = ms ? `transform ${ms}ms ${easing}, opacity ${ms}ms ease` : 'none';
  el.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg) scale(${scale})`;
}

/** Lays the cards out as large as the screen allows: one row, two rows or three. A short last row is centred. */
function layout() {
  const vw = innerWidth;
  const vh = innerHeight;
  const area = { x: vw * 0.04, y: vh * 0.1, w: vw * 0.92, h: vh * 0.7 };
  let best = { w: 0, cols: PACK_SIZE, rows: 1, gap: 0 };
  for (const cols of [PACK_SIZE, 3, 2]) {
    const rows = Math.ceil(PACK_SIZE / cols);
    const gap = Math.min(area.w, area.h) * 0.035;
    const w = Math.min((area.w - gap * (cols - 1)) / cols, (area.h - gap * (rows - 1)) / rows / CARD_RATIO, 320);
    if (w > best.w) best = { w, cols, rows, gap };
  }
  const { w, cols, rows, gap } = best;
  const h = w * CARD_RATIO;
  const y0 = area.y + (area.h - (rows * h + (rows - 1) * gap)) / 2;
  const spots = Array.from({ length: PACK_SIZE }, (_, i) => {
    const row = Math.floor(i / cols);
    const inRow = Math.min(cols, PACK_SIZE - row * cols);
    const x0 = area.x + (area.w - (inRow * w + (inRow - 1) * gap)) / 2;
    return { x: x0 + (i % cols) * (w + gap), y: y0 + row * (h + gap) };
  });
  return { w, h, spots, bottom: y0 + rows * h + (rows - 1) * gap };
}

// ---- opening a pack ----------------------------------------------------------

async function open() {
  if (state !== 'idle') return;
  state = 'opening';
  packs.interactive = false;
  setHint('');
  showArrow(false);
  peek.classList.add('away');

  const defs = openPack();
  const fresh = new Set<string>();
  for (const d of defs) if (store.count(d.id) === 0) fresh.add(d.id);
  store.add(defs.map((d) => d.id));

  await packs.spin();

  // The cards wait inside the wrapper, behind the pack layer.
  const rect = packs.centerRect();
  const lay = layout();
  cardW = lay.w;
  const inPack = (rect.w * 0.84) / cardW;
  const sx = rect.x + rect.w / 2 - cardW / 2;
  const sy = rect.y + rect.h * 0.52 - lay.h / 2;
  pulled = defs.map((def, i) => {
    const el = createCard(def, true);
    el.classList.add('on-table');
    el.style.width = `${cardW}px`;
    el.style.zIndex = String(10 - i);
    put(el, sx, sy, inPack);
    table.append(el);
    const p: Pulled = { def, el, isNew: fresh.delete(def.id), flipped: false, x: lay.spots[i].x, y: lay.spots[i].y };
    el.addEventListener('click', () => void flip(p));
    return p;
  });

  await packs.rip();

  // Up out of the torn top...
  audio.slide();
  pulled.forEach((p, i) => put(p.el, sx, sy - rect.h * 0.4 - i * 2, inPack, 0, 420));
  await wait(430);

  // ...the wrapper leaves to the left, and the cards spread out left and right.
  packs.dismiss();
  packs.showShelf(false);
  await wait(200);
  pulled.forEach((p, i) => {
    setTimeout(() => {
      audio.slide(i);
      p.el.style.zIndex = '';
      put(p.el, p.x, p.y, 1, 0, 620);
    }, i * 75);
  });
  await wait(620 + PACK_SIZE * 75);
  state = 'reveal';
  setHint('Tap a card to flip it!');
}

// ---- turning cards over --------------------------------------------------------

function centreOf(p: Pulled) {
  return { x: p.x + cardW / 2, y: p.y + (cardW * CARD_RATIO) / 2 };
}

function afterFlip(p: Pulled) {
  p.el.classList.add('shine');
  if (p.isNew) {
    const chip = document.createElement('span');
    chip.className = 'new-chip';
    chip.textContent = 'NEW';
    p.el.append(chip);
  }
  if (pulled.every((c) => c.flipped)) {
    setHint('');
    nextBtn.style.top = `${Math.min(layout().bottom + innerHeight * 0.035, innerHeight - 90)}px`;
    nextBtn.classList.add('on');
  }
}

/**
 * The best card of the pack always turns up last, whichever order the cards are tapped in. The
 * face-down cards all look alike, so if the best one is tapped early it quietly trades places
 * with another face-down card, and that one is turned instead.
 */
function saveBestForLast(p: Pulled): Pulled {
  const best = pulled.reduce((a, b) => (RARITY[b.def.rarity].tier >= RARITY[a.def.rarity].tier ? b : a));
  const other = pulled.find((c) => !c.flipped && c !== p);
  if (p !== best || !other) return p;
  [p.x, p.y, other.x, other.y] = [other.x, other.y, p.x, p.y];
  put(p.el, p.x, p.y);
  put(other.el, other.x, other.y);
  return other;
}

/** Tapping a card that is already turned over opens the close-up view, on this pack's turned cards only. */
function lookAt(p: Pulled) {
  const turned = pulled.filter((c) => c.flipped).sort((a, b) => a.y - b.y || a.x - b.x);
  void zoomCards({ defs: turned.map((c) => c.def), sourceOf: (def) => turned.find((c) => c.def === def)?.el ?? null }, p.def);
}

async function flip(tapped: Pulled) {
  if (state !== 'reveal' || busy) return;
  if (tapped.flipped) return lookAt(tapped);
  const p = saveBestForLast(tapped);
  p.flipped = true;
  audio.unlock();
  const tier = RARITY[p.def.rarity].tier;

  if (isBigPull(p.def)) {
    await bigReveal(p);
  } else {
    p.el.classList.remove('down');
    audio.flip();
    audio.reveal(tier);
    if (tier === 2) {
      // Rare: the card jumps forward with a puff of sparkles.
      const c = centreOf(p);
      p.el.style.zIndex = '8';
      put(p.el, p.x, p.y, 1.08, 0, 260);
      setTimeout(() => fx.sparkle(c.x, c.y, 16, cardW * 2.2), 220);
      await wait(520);
      put(p.el, p.x, p.y, 1, 0, 320);
      setTimeout(() => (p.el.style.zIndex = ''), 320);
    }
  }
  afterFlip(p);
}

/** How big a fuss each of the top three rarities gets. */
const WOW = {
  ultra: { title: 'ULTRA RARE!', build: 1000, burst: 90, rain: 1400, hold: 900 },
  secret: { title: 'SECRET RARE!', build: 1400, burst: 150, rain: 2600, hold: 1500 },
  gold: { title: 'GOLD CARD!', build: 2100, burst: 260, rain: 6500, hold: 2600 },
};

/** Ultra rares, secret illustration rares and the gold card stop everything and take the whole screen. */
async function bigReveal(p: Pulled) {
  busy = true;
  setHint('');
  const kind = p.def.rarity as keyof typeof WOW;
  const wow = WOW[kind];
  const gold = kind === 'gold';
  const vw = innerWidth;
  const vh = innerHeight;
  const h = cardW * CARD_RATIO;
  const scale = Math.min((vh * 0.66) / h, (vw * 0.7) / cardW);
  const cx = (vw - cardW) / 2;
  const cy = (vh - h) / 2 + vh * 0.02;

  // The card comes to the middle, still face down, and something is clearly up.
  celebrate.className = `on ${kind}`;
  p.el.style.zIndex = '25';
  p.el.classList.add('charge', 'slow');
  put(p.el, cx, cy, scale, 0, 650);
  audio.riser(wow.build / 1000);
  await wait(wow.build);

  // The turn.
  p.el.classList.remove('charge', 'down');
  p.el.classList.add('glow');
  celebrate.classList.add('lit');
  document.body.classList.add('flash');
  setTimeout(() => document.body.classList.remove('flash'), 700);
  if (gold) audio.gold();
  else if (kind === 'secret') audio.secret();
  else audio.reveal(3);
  await wait(380);

  fx.burst(vw / 2, vh / 2, wow.burst, gold);
  fx.sparkle(vw / 2, vh / 2, 70, vw * 0.9, gold);
  fx.rain(wow.rain, gold);
  if (gold) {
    document.body.classList.add('shake');
    setTimeout(() => document.body.classList.remove('shake'), 900);
    setTimeout(() => fx.burst(vw * 0.2, vh * 0.5, 140, true), 600);
    setTimeout(() => fx.burst(vw * 0.8, vh * 0.5, 140, true), 950);
    setTimeout(() => fx.burst(vw / 2, vh * 0.4, 200, true), 1500);
  }
  banner.innerHTML = `<small>${RARITY[kind].stars}</small>${wow.title}`;
  banner.className = `on ${kind}`;

  // It stays until tapped (after a moment, so an excited tap does not skip it).
  await wait(wow.hold);
  sleeveBtn.classList.add('on');
  await new Promise<void>((resolve) => addEventListener('pointerdown', () => resolve(), { once: true }));

  sleeveBtn.classList.remove('on');
  banner.className = '';

  // A good pull goes into a sleeve before it rejoins the others.
  const sleeve = document.createElement('span');
  sleeve.className = 'sleeve';
  p.el.append(sleeve);
  audio.slide();
  await wait(520);

  celebrate.className = '';
  p.el.classList.remove('slow');
  put(p.el, p.x, p.y, 1, 0, 520);
  await wait(520);
  p.el.style.zIndex = '';
  busy = false;
}

// ---- putting the cards away -----------------------------------------------------

async function collect() {
  if (state !== 'reveal' || busy) return;
  state = 'collecting';
  audio.tap();
  nextBtn.classList.remove('on');
  peek.classList.remove('away');
  await wait(150);

  const target = peek.getBoundingClientRect();
  const tx = target.left + target.width * 0.45 - cardW / 2;
  const ty = target.top + target.height * 0.3 - (cardW * CARD_RATIO) / 2;
  pulled.forEach((p, i) => {
    setTimeout(() => {
      audio.collect(i);
      p.el.querySelector('.new-chip')?.remove();
      put(p.el, tx, ty, 0.18, -12, 480, 'cubic-bezier(0.5, 0, 0.7, 0.4)');
      p.el.style.opacity = '0.2';
      setTimeout(() => {
        p.el.remove();
        peek.classList.remove('bump');
        void peek.offsetWidth;
        peek.classList.add('bump');
      }, 480);
    }, i * 80);
  });
  await wait(480 + PACK_SIZE * 80);
  pulled = [];
  refreshPeek();
  packs.showShelf(true);
  packs.interactive = true;
  state = 'idle';
  setHint('Grab a pack!');
  showArrow(true);
}

// ---- start -----------------------------------------------------------------------

function showMute() {
  mute.textContent = audio.muted ? '🔇' : '🔊';
}

addEventListener('pointerdown', () => audio.unlock(), { once: true });
addEventListener('resize', () => {
  // After the pack layer has measured the new size.
  requestAnimationFrame(() => showArrow(arrow.classList.contains('on')));
  if (state !== 'reveal') return;
  const lay = layout();
  cardW = lay.w;
  pulled.forEach((p, i) => {
    p.x = lay.spots[i].x;
    p.y = lay.spots[i].y;
    p.el.style.width = `${cardW}px`;
    put(p.el, p.x, p.y);
  });
});
nextBtn.addEventListener('click', () => void collect());
mute.addEventListener('click', () => {
  audio.toggle();
  showMute();
});
showMute();
initBinder();

packs.onOpen = () => void open();
packs.onCenter = (has) => {
  if (state !== 'idle') return;
  setHint(has ? 'Tap the pack to rip it open!' : 'Grab a pack!');
  showArrow(!has);
};
void packs.init().then(() => {
  setHint('Grab a pack!');
  showArrow(true);
});
