// What happens the moment the last card joins the collection.

import { audio } from './audio';
import { TOTAL } from './cards';
import { fx } from './fx';
import { store } from './store';

const banner = document.querySelector<HTMLElement>('#banner')!;
/** How long the celebration holds the screen, in milliseconds. */
export const COMPLETE_SHOW = 5200;

/** Celebrates a finished collection, once. Returns true if it did. */
export function celebrateIfComplete(): boolean {
  if (store.owned() < TOTAL || store.celebrated) return false;
  store.celebrated = true;
  const vw = innerWidth;
  const vh = innerHeight;
  audio.gold();
  banner.innerHTML = `<img src="./art/set-logo.webp" alt="Titan Dawn" />COLLECTION<br />COMPLETE!<small>★★★</small>`;
  banner.className = 'on gold complete';
  document.body.classList.add('flash');
  setTimeout(() => document.body.classList.remove('flash'), 700);
  fx.burst(vw / 2, vh / 2, 260, true);
  fx.rain(COMPLETE_SHOW, true);
  setTimeout(() => fx.burst(vw * 0.2, vh * 0.5, 160, true), 700);
  setTimeout(() => fx.burst(vw * 0.8, vh * 0.5, 160, true), 1200);
  setTimeout(() => fx.burst(vw / 2, vh * 0.4, 220, true), 2000);
  setTimeout(() => (banner.className = ''), COMPLETE_SHOW);
  return true;
}
