// Looking closely at cards. The chosen card lifts out of where it was, comes to the middle on
// black, and can be tilted and turned over. The cards before and after it wait at the sides,
// turned away and dimmed; tapping one brings it to the middle.
//
// The same view serves the binder (the whole collection) and the table (the cards of the pack
// just opened): whoever opens it says which cards to show and where each one lives on screen.

import { audio } from './audio';
import { createCard } from './card';
import { type CardDef, isBigPull } from './cards';
import { clamp, wait } from './tween';

export interface ZoomHost {
  /** The cards that can be looked through, in order. */
  defs: CardDef[];
  /** The card's own element on screen: where it lifts out of and goes back to. */
  sourceOf(def: CardDef): HTMLElement | null;
}

const root = document.querySelector<HTMLElement>('#zoom')!;
let open = false;

const MOVE = 460;
const EASE = 'cubic-bezier(0.25, 0.9, 0.3, 1)';

export async function zoomCards(host: ZoomHost, first: CardDef) {
  let i = host.defs.indexOf(first);
  let source = host.sourceOf(first);
  if (open || i < 0 || !source) return;
  open = true;

  const from = source.getBoundingClientRect();
  // Cards are built at their full viewing size and scaled down to start, so they are sharp in the middle.
  const grow = Math.min((innerHeight * 0.74) / from.height, (innerWidth * 0.7) / from.width);
  const w = from.width * grow;
  const h = from.height * grow;
  const cx = innerWidth / 2;
  const cy = innerHeight * 0.46;

  root.innerHTML = `
    <div class="zoom-shade"></div>
    <button class="zoom-rotate" type="button">
      <i><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z" /></svg></i>
      <span>Rotate</span>
    </button>
    <button class="zoom-btn zoom-close" type="button" aria-label="Close">✕</button>`;
  root.classList.add('on');
  // Tells the rest of the page it is covered, so it can stop animating underneath.
  document.body.classList.add('zooming');

  // ---- where a card can be ---------------------------------------------------

  /** Every position is the same list of transforms, so a card can glide from any one to any other. */
  const at = (x: number, y: number, turn: number, scale: number) =>
    `translate(${x - w / 2}px, ${y - h / 2}px) perspective(1400px) rotateY(${turn}deg) scale(${scale})`;
  const centre = () => at(cx, cy, 0, 1);
  /** At one side (dir -1 left, 1 right), its outer edge swung away from the viewer. */
  const side = (dir: number) => at(cx + dir * w * 1.08, cy, dir * 42, 0.66);
  /** Further out and gone: where side cards arrive from and leave to. */
  const gone = (dir: number) => at(cx + dir * w * 1.8, cy, dir * 62, 0.5);

  const move = (el: HTMLElement, transform: string, ms: number, easing = EASE) => {
    el.style.transition = ms ? `transform ${ms}ms ${easing}, filter ${ms}ms ease, opacity ${ms}ms ease` : 'none';
    el.style.transform = transform;
  };

  /**
   * Resolves once the cards have really finished gliding. A slow device can run a transition
   * late, so a timer alone would let the next tap land on a card that is still moving.
   */
  const settled = async (ms: number, ...els: HTMLElement[]) => {
    await wait(ms);
    const running = els.flatMap((el) => el.getAnimations().map((a) => a.finished.catch(() => undefined)));
    await Promise.race([Promise.all(running), wait(ms * 4)]);
  };

  // ---- the cards ---------------------------------------------------------------

  const cards = new Map<number, HTMLElement>();
  const innerOf = (el: HTMLElement) => el.querySelector<HTMLElement>('.card-inner')!;
  const sleeveOf = (el: HTMLElement) => el.querySelector<HTMLElement>('.sleeve');

  // Tilt and turning of the card in the middle, eased towards their targets every frame.
  // `turn` only ever grows by half turns, so 180 is the back and 360 is the front again.
  let turn = 0;
  let turnTo = 0;
  const tilt = { x: 0, y: 0 };
  const tiltTo = { x: 0, y: 0 };
  let held = false;
  let alive = true;
  let moving = true;
  let closing = false;

  const make = (index: number): HTMLElement => {
    const def = host.defs[index];
    const el = createCard(def);
    el.classList.add('zoomed', 'side');
    el.style.width = `${w}px`;
    innerOf(el).style.transition = 'none';
    // The big pulls live in sleeves; the sleeve only comes off the card being looked at.
    if (isBigPull(def)) {
      const sleeve = document.createElement('span');
      sleeve.className = 'sleeve still';
      el.append(sleeve);
    }

    const aim = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      tiltTo.y = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1) * 26;
      tiltTo.x = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1) * -20;
    };
    el.addEventListener('pointerdown', (e) => {
      if (cards.get(i) !== el || moving || closing) return;
      aim(e);
      held = true;
      el.setPointerCapture(e.pointerId);
      audio.tap();
    });
    el.addEventListener('pointermove', (e) => {
      if (held && cards.get(i) === el) aim(e);
    });
    // Letting go sets the card flat again.
    const release = () => {
      held = false;
      tiltTo.x = 0;
      tiltTo.y = 0;
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    // A card waiting at the side comes to the middle when tapped.
    el.addEventListener('click', () => {
      if (cards.get(i - 1) === el) void go(-1);
      else if (cards.get(i + 1) === el) void go(1);
    });

    cards.set(index, el);
    root.append(el);
    return el;
  };

  /** Makes a card the one being looked at: lit, live to the light, out of its sleeve. */
  const focus = (el: HTMLElement) => {
    el.classList.remove('side');
    el.classList.add('shine', 'manual', 'focus');
    innerOf(el).style.transition = 'none';
    sleeveOf(el)?.classList.add('off');
    turn = turnTo = 0;
    tilt.x = tilt.y = tiltTo.x = tiltTo.y = 0;
  };
  /** And back to a plain, flat, sleeved card. */
  const unfocus = (el: HTMLElement) => {
    el.classList.remove('shine', 'manual', 'focus');
    el.classList.add('side');
    // It always ends face-up. Whole turns it has been given are dropped first, without animating,
    // so it does not spin back through them on its way to the side: a card showing its front just
    // settles, and a card showing its back makes the one half turn it needs.
    const shown = ((turnTo % 360) + 360) % 360;
    const inner = innerOf(el);
    inner.style.transition = 'none';
    inner.style.transform = `rotateX(${tilt.x}deg) rotateY(${shown + (turn - turnTo) + tilt.y}deg)`;
    inner.getBoundingClientRect();
    inner.style.transition = 'transform 0.4s ease';
    inner.style.transform = 'rotateX(0deg) rotateY(0deg)';
    sleeveOf(el)?.classList.remove('off');
  };

  /** Brings in the card waiting at one side; everything else shuffles along one place. */
  async function go(dir: number) {
    if (moving || closing || !host.defs[i + dir]) return;
    moving = true;
    held = false;
    audio.slide();

    const was = cards.get(i)!;
    const next = cards.get(i + dir)!;
    const leaving = cards.get(i - dir);
    i += dir;

    unfocus(was);
    move(was, side(-dir), MOVE);
    focus(next);
    move(next, centre(), MOVE);
    if (leaving) {
      cards.delete(i - 2 * dir);
      move(leaving, gone(-dir), MOVE);
      leaving.style.opacity = '0';
      setTimeout(() => leaving.remove(), MOVE);
    }
    if (host.defs[i + dir]) {
      const arriving = make(i + dir);
      move(arriving, gone(dir), 0);
      arriving.style.opacity = '0';
      arriving.getBoundingClientRect();
      move(arriving, side(dir), MOVE);
      arriving.style.opacity = '';
    }

    // The card's own place on screen stays empty while it is out being looked at.
    if (source) source.style.visibility = '';
    source = host.sourceOf(host.defs[i]);
    if (source) source.style.visibility = 'hidden';

    await settled(MOVE, was, next);
    moving = false;
  }

  // ---- arriving ------------------------------------------------------------------

  const card = make(i);
  card.classList.remove('side');
  source.style.visibility = 'hidden';
  const middleOf = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

  // Straight up out of its place first, then across to the middle.
  const p0 = middleOf(from);
  move(card, at(p0.x, p0.y, 0, from.width / w), 0);
  card.getBoundingClientRect();
  audio.lift();
  move(card, at(p0.x, p0.y - from.height * 0.72, 0, from.width / w), 260, 'cubic-bezier(0.3, 0.8, 0.3, 1)');
  await wait(250);

  // The neighbours are put in place unseen, and fade in as the screen darkens.
  for (const dir of [-1, 1]) {
    if (!host.defs[i + dir]) continue;
    const el = make(i + dir);
    move(el, side(dir), 0);
    el.getBoundingClientRect();
    el.style.transition = 'opacity 0.4s ease';
  }
  card.getBoundingClientRect();
  root.classList.add('dark');
  audio.whoosh(0.4);
  focus(card);
  move(card, centre(), 480);
  await settled(480, card);
  moving = false;

  const frame = () => {
    if (!alive) return;
    turn += (turnTo - turn) * 0.14;
    tilt.x += (tiltTo.x - tilt.x) * 0.16;
    tilt.y += (tiltTo.y - tilt.y) * 0.16;
    const el = cards.get(i);
    if (el && !moving) {
      innerOf(el).style.transform = `rotateX(${tilt.x}deg) rotateY(${turn + tilt.y}deg)`;
      // The light moves across the finish as the card tilts and turns.
      const swing = Math.sin(((turn + tilt.y) * Math.PI) / 180);
      el.style.setProperty('--px', `${clamp(50 + swing * 130, 0, 100)}%`);
      el.style.setProperty('--py', `${clamp(50 - tilt.x * 2.4, 0, 100)}%`);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  root.querySelector('.zoom-rotate')!.addEventListener('click', () => {
    if (moving || closing) return;
    turnTo += 180;
    audio.flip();
  });

  // ---- leaving -------------------------------------------------------------------

  const close = async () => {
    if (closing || moving) return;
    closing = true;
    const el = cards.get(i)!;
    // Finish face-up and flat before going back.
    turnTo = Math.round(turnTo / 360) * 360;
    tiltTo.x = 0;
    tiltTo.y = 0;
    const sleeve = sleeveOf(el);
    if (sleeve) {
      // Back into its sleeve first.
      await wait(320);
      audio.slide();
      sleeve.classList.remove('off');
      await wait(460);
    }
    audio.whoosh(0.35);
    root.classList.remove('dark');
    if (source) {
      const to = source.getBoundingClientRect();
      const p1 = middleOf(to);
      move(el, at(p1.x, p1.y - to.height * 0.72, 0, to.width / w), 420, 'cubic-bezier(0.4, 0, 0.3, 1)');
      await wait(420);
      move(el, at(p1.x, p1.y, 0, to.width / w), 240, 'cubic-bezier(0.4, 0, 0.6, 1)');
      await wait(240);
      source.style.visibility = '';
    } else {
      await wait(450);
    }
    alive = false;
    document.body.classList.remove('zooming');
    root.classList.remove('on');
    root.innerHTML = '';
    open = false;
  };
  root.querySelector('.zoom-close')!.addEventListener('click', close);
  root.querySelector('.zoom-shade')!.addEventListener('click', close);
}
