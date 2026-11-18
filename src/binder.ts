// The collection binder. It peeks out of the bottom-left corner; opened, it comes to the
// middle of the screen and its pages can be turned from the first to the last.

import { audio } from './audio';
import { createCard } from './card';
import { type CardDef, CARDS, isBigPull, RARITY, type Rarity, TOTAL } from './cards';
import { store } from './store';
import { wait } from './tween';
import { zoomCards } from './zoom';

/** Pockets on each page. With the full set this wants to be 3 x 3. */
const COLS = 2;
const ROWS = 2;
const PER_PAGE = COLS * ROWS;
const PAGES = Math.ceil(TOTAL / PER_PAGE);
/** Side 0 is the inside of the front cover, sides 1..PAGES hold cards; the last side must be a right-hand one. */
const LAST_SIDE = PAGES % 2 ? PAGES : PAGES + 1;
const LAST_SPREAD = (LAST_SIDE - 1) / 2;

const root = document.querySelector<HTMLElement>('#binder')!;
const peek = document.querySelector<HTMLElement>('#binder-peek')!;
const pad = (n: number) => String(n).padStart(3, '0');

let book: HTMLElement;
let left: HTMLElement;
let right: HTMLElement;
/** The spread on show: -1 is the closed front cover. */
let spread = -1;
let busy = false;
let isOpen = false;

export function refreshPeek() {
  peek.querySelector('.peek-count')!.textContent = `${store.owned()}/${TOTAL}`;
}

function el(html: string): HTMLElement {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
}

function cardPage(page: number): HTMLElement {
  const side = el(`<div class="side sheet" style="--cols:${COLS};--rows:${ROWS}"></div>`);
  for (const def of CARDS.slice((page - 1) * PER_PAGE, page * PER_PAGE)) {
    const count = store.count(def.id);
    const slot = el(`<div class="slot"><div class="pocket"></div></div>`);
    const pocket = slot.firstElementChild as HTMLElement;
    if (count > 0) {
      const card = createCard(def);
      card.classList.add('shine');
      // The big pulls are kept in their sleeves.
      if (isBigPull(def)) card.append(el(`<span class="sleeve still"></span>`));
      pocket.append(card);
      if (count > 1) slot.append(el(`<span class="count">×${count}</span>`));
      slot.addEventListener('click', () => {
        if (!busy) void zoomCards(collection(), def);
      });
    } else {
      pocket.append(el(`<div class="missing"><b>${pad(def.no)}</b><span>${RARITY[def.rarity].stars}</span></div>`));
    }
    side.append(slot);
  }
  return side;
}

/**
 * The collected cards, for looking through one at a time. As the view moves from card to card
 * the binder quietly turns to that card's page behind it, so each card goes back into its own pocket.
 */
function collection() {
  return {
    defs: CARDS.filter((c) => store.count(c.id) > 0),
    sourceOf(def: CardDef) {
      const page = Math.floor(CARDS.indexOf(def) / PER_PAGE) + 1;
      const wanted = Math.floor(page / 2);
      if (wanted !== spread) {
        spread = wanted;
        setPage(left, 2 * spread);
        setPage(right, 2 * spread + 1);
        updateNav();
      }
      return book.querySelector<HTMLElement>(`.page .card[data-id="${def.id}"]`);
    },
  };
}

function infoPage(): HTMLElement {
  const owned = store.owned();
  const rows = (Object.keys(RARITY) as Rarity[])
    .map((r) => {
      const all = CARDS.filter((c) => c.rarity === r);
      const have = all.filter((c) => store.count(c.id) > 0).length;
      return `<li><span class="stars s-${r}">${RARITY[r].stars}</span><span>${RARITY[r].label}</span><em>${have}/${all.length}</em></li>`;
    })
    .join('');
  return el(`
    <div class="side inside info">
      <img src="./art/set-logo.webp" alt="Titan Dawn" draggable="false" />
      <div class="info-count"><b>${owned}</b> of ${TOTAL} cards</div>
      <div class="info-bar"><i style="width:${(owned / TOTAL) * 100}%"></i></div>
      <ul>${rows}</ul>
    </div>`);
}

function side(i: number): HTMLElement | null {
  if (i === -1) {
    return el(`
      <div class="side cover">
        <img class="cover-art" src="./art/binder.webp" alt="" draggable="false" />
      </div>`);
  }
  if (i === 0) return infoPage();
  if (i >= 1 && i <= PAGES) return cardPage(i);
  if (i === LAST_SIDE) return el(`<div class="side inside"></div>`);
  return null;
}

function setPage(page: HTMLElement, i: number) {
  const content = side(i);
  page.replaceChildren(...(content ? [content] : []));
  page.classList.toggle('empty', !content);
}

function updateNav() {
  root.querySelector<HTMLElement>('.book-prev')!.hidden = spread <= 0;
  root.querySelector<HTMLElement>('.book-next')!.hidden = spread < 0 || spread >= LAST_SPREAD;
  root.querySelector('.book-page')!.textContent = spread < 0 ? '' : `${spread + 1} / ${LAST_SPREAD + 1}`;
}

/** Turns one leaf: forwards (dir 1) lifts the right-hand page over to the left, backwards the reverse. */
async function turn(dir: 1 | -1) {
  const target = spread + dir;
  if (busy || target < 0 || target > LAST_SPREAD) return;
  busy = true;
  audio.page();

  const leaf = el(`<div class="leaf ${dir > 0 ? 'from-right' : 'from-left'}"><div class="leaf-face leaf-front"></div><div class="leaf-face leaf-back"></div></div>`);
  const front = side(dir > 0 ? 2 * spread + 1 : 2 * spread);
  const back = side(dir > 0 ? 2 * spread + 2 : 2 * spread - 1);
  if (front) leaf.children[0].append(front);
  if (back) leaf.children[1].append(back);
  book.append(leaf);
  if (dir > 0) setPage(right, 2 * spread + 3);
  else setPage(left, 2 * spread - 2);

  await leaf.animate([{ transform: 'rotateY(0deg)' }, { transform: `rotateY(${-180 * dir}deg)` }], {
    duration: 700,
    easing: 'cubic-bezier(0.45, 0, 0.2, 1)',
    fill: 'forwards',
  }).finished;

  if (dir > 0) setPage(left, 2 * spread + 2);
  else setPage(right, 2 * spread - 1);
  leaf.remove();
  spread = target;
  updateNav();
  busy = false;
}

function size() {
  const ph = Math.min(innerHeight * 0.84, innerWidth * 0.43 * 1.32);
  book.style.setProperty('--ph', `${ph}px`);
  book.style.setProperty('--pw', `${ph / 1.32}px`);
  return { pw: ph / 1.32, ph };
}

/**
 * The transform that puts the closed binder exactly over the corner where it peeks out.
 * Measured with the peeking binder in its resting place, even while it is tucked away.
 */
function atPeek(pw: number): string {
  const hidden = document.body.classList.contains('binder-open');
  peek.style.transition = 'none';
  document.body.classList.remove('binder-open');
  const r = peek.querySelector('.peek-cover')!.getBoundingClientRect();
  document.body.classList.toggle('binder-open', hidden);
  void peek.offsetWidth;
  peek.style.transition = '';
  const dx = r.left + r.width / 2 - innerWidth / 2;
  const dy = r.top + r.height / 2 - innerHeight / 2;
  // The peeking binder leans 9 degrees, so its true width is used, not the width of its box.
  const k = peek.offsetWidth / pw;
  return `translate(${dx}px, ${dy}px) scale(${k}) rotate(9deg) translateX(${-pw / 2}px)`;
}

export async function openBinder() {
  if (isOpen) return;
  isOpen = true;
  busy = true;
  audio.binder();

  root.innerHTML = `
    <div class="binder-shade"></div>
    <div class="book closed"><div class="page left"></div><div class="page right"></div></div>
    <button class="book-nav book-prev" type="button" aria-label="Previous page"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg></button>
    <button class="book-nav book-next" type="button" aria-label="Next page"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg></button>
    <button class="book-close" type="button" aria-label="Close binder">✕</button>
    <div class="book-page"></div>`;
  book = root.querySelector('.book')!;
  left = root.querySelector('.page.left')!;
  right = root.querySelector('.page.right')!;
  spread = -1;
  setPage(left, -2);
  setPage(right, -1);
  updateNav();
  const { pw } = size();

  // The closed binder travels from where it peeks out to the middle of the screen.
  root.classList.add('on');
  document.body.classList.add('binder-open');
  await book.animate([{ transform: atPeek(pw) }, { transform: `translateX(${-pw / 2}px)` }], {
    duration: 520,
    easing: 'cubic-bezier(0.25, 0.9, 0.3, 1)',
  }).finished;

  // Then the cover swings open.
  await wait(80);
  book.classList.remove('closed');
  busy = false;
  await turn(1);
}

/** Closing is opening in reverse: the cover swings shut, then the binder goes back to its corner. */
async function closeBinder() {
  if (busy || !isOpen) return;
  busy = true;
  root.classList.add('leaving');
  audio.page();

  // The left-hand page swings over to the right, and its other side is the front cover.
  const leaf = el(`<div class="leaf from-left"><div class="leaf-face leaf-front"></div><div class="leaf-face leaf-back"></div></div>`);
  const front = side(2 * spread);
  if (front) leaf.children[0].append(front);
  leaf.children[1].append(side(-1)!);
  book.append(leaf);
  setPage(left, -2);
  // Shutting is brisker than opening.
  book.style.transitionDuration = '0.46s';
  book.classList.add('closed');
  await leaf.animate([{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(180deg)' }], {
    duration: 460,
    easing: 'cubic-bezier(0.45, 0, 0.2, 1)',
    fill: 'forwards',
  }).finished;
  setPage(right, -1);
  leaf.remove();
  spread = -1;

  // The closed binder travels back to where it peeks out, and the peeking one takes over.
  audio.binder();
  const pw = size().pw;
  root.classList.add('going');
  await book.animate([{ transform: `translateX(${-pw / 2}px)` }, { transform: atPeek(pw) }], {
    duration: 320,
    easing: 'cubic-bezier(0.5, 0, 0.75, 0.4)',
    fill: 'forwards',
  }).finished;
  peek.style.transition = 'none';
  document.body.classList.remove('binder-open');
  void peek.offsetWidth;
  peek.style.transition = '';

  root.classList.remove('on', 'leaving', 'going');
  root.innerHTML = '';
  isOpen = false;
  busy = false;
}

export function initBinder() {
  refreshPeek();
  peek.addEventListener('click', () => void openBinder());
  root.addEventListener('click', (e) => {
    const t = e.target as Element;
    if (t.closest('.book-prev')) void turn(-1);
    else if (t.closest('.book-next')) void turn(1);
    else if (t.closest('.book-close') || t.classList.contains('binder-shade')) void closeBinder();
  });
  addEventListener('resize', () => {
    if (isOpen) size();
  });
}
