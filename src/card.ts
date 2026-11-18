import { type CardDef, type DinoType, RARITY, TOTAL } from './cards';

const ICONS: Record<DinoType, string> = {
  leaf: 'M4 20C4 10 10 4 20 4c0 10-6 16-16 16z',
  rock: 'M2 20l7-13 4 7 3-4 6 10z',
  sky: 'M2 15c5-9 12-10 20-9-3 2-4 4-5 6-2 0-3 1-4 3-3-1-7-1-11 0z',
  water: 'M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z',
  fire: 'M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 1-4 2-6 1 2 2 2 2 2 0-3 1-6 2-8z',
  storm: 'M13 2L4 14h6l-1 8 9-12h-6z',
};

const icon = (type: DinoType) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[type]}"/></svg>`;
const pad = (n: number) => String(n).padStart(3, '0');
/** Long names are set smaller so they still fit beside the power. */
const nameSize = (name: string) => (name.length > 17 ? ' xlong' : name.length > 13 ? ' long' : '');
const art = (id: string) => `./art/${id}.webp`;

/**
 * One card. Every rarity uses this same template, so the name, power, picture
 * window, moves and footer are always in the same place; rarity only changes
 * the artwork, the colouring and the print finish (see card.css).
 *
 * The back is the same on every card and is laid out here rather than drawn as one picture,
 * so it fits whatever shape the card is: dinosaur hide edge to edge, a piece of amber in the
 * middle, and the Dino Ripper logo inside the amber.
 */
export function createCard(def: CardDef, faceDown = false): HTMLElement {
  const r = RARITY[def.rarity];
  const el = document.createElement('div');
  el.className = `card r-${def.rarity} fin-${def.finish} t-${def.type}${r.fullArt ? ' full-art' : ''}${faceDown ? ' down' : ''}`;
  el.dataset.id = def.id;
  el.style.setProperty('--delay', `${-Math.random() * 6}s`);
  if (def.spots) el.style.setProperty('--spots', def.spots);
  el.innerHTML = `
    <div class="card-inner">
      <div class="face back">
        <img src="${art('back-skin')}" alt="" draggable="false" />
        <div class="back-amber">
          <img src="${art('amber')}" alt="" draggable="false" />
          <img class="back-logo" src="${art('logo')}" alt="" draggable="false" />
        </div>
      </div>
      <div class="face front">
        ${r.fullArt ? `<img class="bleed" src="${art(def.id)}" alt="" draggable="false" />` : ''}
        <div class="plate">
          <div class="top">
            <span class="name${nameSize(def.name)}">${def.name}</span>
            <span class="power"><small>POWER</small>${def.power}</span>
            <span class="type">${icon(def.type)}</span>
          </div>
          <div class="window">${r.fullArt ? '' : `<img src="${art(def.id)}" alt="" draggable="false" />`}</div>
          <div class="strip">${def.era} · ${def.diet} · ${def.size}</div>
          <div class="moves">
            ${def.moves
              .map(
                (m) => `<div class="move">
                  <span class="cost">${`<i>${icon(def.type)}</i>`.repeat(m.cost)}</span>
                  <span class="move-name">${m.name}</span>
                  <span class="dmg">${m.dmg}</span>
                </div>`,
              )
              .join('')}
          </div>
          <div class="fact">${def.fact}</div>
          <div class="foot">
            <span class="style">Illus. ${def.artistName}</span>
            <span class="stars">${r.stars}</span>
            <span class="no">${pad(def.no)}/${pad(TOTAL)}</span>
          </div>
        </div>
        <div class="fx tex"></div>
        <div class="fx holo"></div>
        <div class="fx glitter"></div>
        <div class="fx glare"></div>
      </div>
    </div>`;
  return el;
}
