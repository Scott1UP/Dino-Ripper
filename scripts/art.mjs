// Art pipeline (ported from dino-kart's scripts/sprites.mjs). Run through npm so the API key is loaded:
//
//   npm run art -- all            generate everything that is missing, then pack
//   npm run art -- gen rex        generate (or regenerate) one image by id
//   npm run art -- tweak rex "..."  redraw one picture with a change, keeping everything else
//   npm run art -- pack           convert art/raw/*.png into public/art/*.webp
//   npm run art -- list           list every id
//
// The cards come from src/set.json (written by scripts/build-set.py): each card names its artist
// and the scene to draw. Raw model output is kept in art/raw/ so `pack` can be re-run for free.

import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'art', 'raw');
const OUT = path.join(ROOT, 'public', 'art');

const MODEL = process.env.ART_MODEL ?? 'gpt-image-2.6-sunburst';
const QUALITY = process.env.ART_QUALITY ?? 'high';
const CONCURRENCY = 6;

const ORIGINAL =
  'An original dinosaur design for a children\'s collectible card game about real dinosaurs. It does not ' +
  'resemble any character from an existing game, film or cartoon. Friendly and exciting, suitable for a young child.';
const NO_TEXT =
  'No text, no letters, no numbers, no logos, no signature, no border, no card frame: the artwork fills the whole image edge to edge.';

const WIDE = '1536x1024';
const TALL = '1024x1536';
// A full-art card prints its name and power across the top and its moves across the bottom third.
const FULL_ART =
  'Vertical composition for a full-art trading card: the top sixth of the image is only sky or background, with ' +
  'no head, face or other important detail in it; the dinosaur\'s head and body sit below that, in the upper two ' +
  'thirds of the image; the lower third is calmer scenery so that words can be printed over it.';

// `pose` says how the dinosaur is posed and seen; it differs from pack to pack.
const packArt = (subject, pose) => ({
  size: TALL,
  prompt:
    `${subject} ${pose} ` +
    'Key art for the front of a shiny foil booster pack of dinosaur trading cards: an explosive, dynamic digital ' +
    'illustration, the dinosaur surrounded by crystalline shards of light, diagonal energy beams and swirling ribbons ' +
    'of colour. Saturated, high contrast, strong rim light, glossy rendering. Vertical composition: the dinosaur ' +
    'fills the middle of the image; the top fifth and the bottom quarter are darker and simpler, because logos will ' +
    `be printed over them. ${ORIGINAL} ${NO_TEXT}`,
});

const LOGO_STYLE =
  'A video game style logo, flat front-on, centred, with generous empty space around it. Fully transparent ' +
  'background, no ground, no shadow on the background, no other text, no other objects.';

// ---- the artists -----------------------------------------------------------------------------
// The full set is drawn by a roster of invented artists, each with a hand of their own, the way a
// real card set is. This is how each one draws; their names are in scripts/build-set.py. These are interpretations, not studies: an artist may simplify, exaggerate or
// reinvent the animal, so long as you can still tell which dinosaur it is.
const LOOSE =
  'This is the artist\'s own interpretation, not a realistic or scientific picture: the anatomy and proportions do ' +
  'not need to be correct and should be simplified, exaggerated or reinvented in this artist\'s style, while the ' +
  'animal stays clearly recognisable by its most famous features. An original design for a children\'s collectible ' +
  'card game about dinosaurs, friendly and suitable for a young child; it does not resemble any character from an ' +
  'existing game, film or cartoon.';

export const ARTISTS = {
  crayon: {
    style:
      'Style: a pencil and wax-crayon drawing on cream sketchbook paper: visible waxy crayon strokes, soft graphite ' +
      'outlines, slightly uneven colouring, paper grain showing through.',
  },
  watercolour: {
    style:
      'Style: a loose traditional watercolour painting with fine ink linework: wet-on-wet washes, soft colour ' +
      'bleeds and blooms, granulating pigment, white paper showing at the edges of the washes.',
  },
  pixel: {
    style:
      'Style: detailed 16-bit pixel art like a classic 1990s console game: crisp square pixels, a limited vivid ' +
      'palette, dithered shading, clean dark outlines, a layered parallax-style background.',
  },
  spray: {
    style:
      'Style: spray-paint street art on a wall: bold stencil shapes, soft aerosol overspray, paint drips, splatter, ' +
      'neon colours against deep shadow, energetic abstract bursts of colour behind the subject.',
  },
  storybook: {
    style:
      'Style: a breathtaking, richly detailed storybook illustration in gouache and coloured ink, the kind you could ' +
      'look at for minutes: luminous colour, glowing light, hundreds of small charming details, decorative flowing ' +
      'shapes, a complete living world around the subject.',
  },
  gold: {
    style:
      'Style: the entire image is one solid slab of polished yellow gold, sculpted as a bas-relief: the subject is ' +
      'raised, embossed metal; the background is gold too, finely engraved with radiating sunburst lines and a ' +
      'border of small scale patterns. Everything is gold, only gold: bright highlights, deep amber shadows.',
  },
  mabel: {
    style:
      'Style: a real drawing by a six-year-old child, in felt-tip pens and wax crayon on white printer paper. Wobbly ' +
      'outlines, scribbled colouring that goes over the lines and leaves white gaps, wildly wrong proportions, ' +
      'stick legs, a huge head with a big smile and far too many triangle teeth, dots for eyes. A yellow sun with ' +
      'stick rays in one corner, a strip of spiky green grass along the bottom, a scribbled blue sky stripe along the ' +
      'top. Genuinely naive and charming, not a skilled adult imitating a child.',
  },
  collage: {
    style:
      'Style: a cut-paper collage. The animal and everything around it are built from simple shapes cut and torn ' +
      'out of hand-painted tissue paper and coloured card, with visible brush texture, overlapping layers, slightly ' +
      'ragged edges and soft shadows under the paper, on an off-white background. Bold, simple, joyful shapes.',
  },
  clay: {
    style:
      'Style: a photograph of a handmade plasticine clay model, like a frame from a stop-motion film. A chubby, ' +
      'lumpy clay animal with visible thumbprints and tool marks, simple round ball eyes, sitting in a tiny handmade ' +
      'clay and cardboard set, lit softly like a miniature film stage.',
  },
  lino: {
    style:
      'Style: a hand-pulled linocut print in just two ink colours plus the cream paper. Bold carved shapes, chunky ' +
      'gouged lines and hatch marks, slightly uneven ink coverage and misregistered colour layers, strong decorative ' +
      'pattern on the animal\'s body. Graphic and striking.',
  },
  shapes: {
    style:
      'Style: a flat mid-century modern poster built only from simple geometric shapes: circles, triangles, ' +
      'rectangles and half-circles in five flat colours with no outlines and no shading, a little printed grain. ' +
      'The animal is reduced to a clever, minimal arrangement of shapes.',
  },
  toon: {
    style:
      'Style: a frame from a modern preschool animated TV series. Clean, flat vector shapes with soft rounded ' +
      'corners, a warm bright palette, simple friendly faces with small dot eyes and expressive eyebrows, thin ' +
      'outlines in a darker shade of each colour instead of black, flat colour with a single soft shadow tone, and ' +
      'a simple sunny backdrop of rolling hills and tidy stylised trees. Gentle, warm and funny.',
  },
  kawaii: {
    style:
      'Style: a super-cute sticker illustration. The animal is a tiny round blob with a huge head, stubby limbs, ' +
      'big sparkly eyes and pink cheeks, drawn with smooth pastel colours and a thick white sticker outline, with ' +
      'little stars and hearts floating around it on a soft pastel background.',
  },
  glass: {
    style:
      'Style: a stained-glass window. The animal and its world are made of pieces of richly coloured glass ' +
      'separated by thick black lead lines, with light glowing through the glass, bold simplified shapes and a ' +
      'radiating sunburst behind.',
  },
  chalk: {
    style:
      'Style: a drawing in coloured chalk on a dusty green school blackboard. Soft smudgy chalk lines, patches of ' +
      'rubbed-in colour, chalk dust and half-wiped marks around it, drawn with simple confident strokes.',
  },
  felt: {
    style:
      'Style: a photograph of a handmade felt applique picture. The animal is made from pieces of coloured felt ' +
      'sewn on with big visible stitches, button eyes, embroidered thread details and a little stuffing so it puffs ' +
      'out, on a patterned fabric background.',
  },
  ink: {
    style:
      'Style: an East Asian ink-wash brush painting. The animal is suggested in a few bold, sweeping black brush ' +
      'strokes with dry-brush texture and soft grey washes, one accent of red, and a great deal of empty rice paper.',
  },
  cave: {
    style:
      'Style: a prehistoric cave painting. The animal is drawn in red and yellow ochre and charcoal on a rough ' +
      'sandy rock wall, simple and stylised, with a few small hand prints and tiny stick figures holding spears nearby.',
  },
  neon: {
    style:
      'Style: glowing neon line art on a black background. The animal is drawn in a few continuous bright tube-light ' +
      'lines in hot pink, cyan and yellow, with a soft glow, like a neon sign, above a simple glowing grid horizon.',
  },
  biro: {
    style:
      'Style: a doodle in blue ballpoint pen on lined school notebook paper with a red margin line. Scratchy, ' +
      'energetic scribbled lines, heavy cross-hatching, bits coloured in with a yellow highlighter, the animal ' +
      'given comic-book action lines and explosions, as drawn by a bored and dinosaur-mad ten-year-old.',
  },
  origami: {
    style:
      'Style: a photograph of an origami model. The animal is folded from a single sheet of patterned paper, all ' +
      'flat facets and crisp creases, standing on a plain surface among a few simple folded paper plants, in soft daylight.',
  },
  swirl: {
    style:
      'Style: a 1960s psychedelic poster. The animal is drawn in flowing, melting curves and filled with swirling ' +
      'patterns in clashing saturated colours, orange against purple, pink against green, with rippling rings ' +
      'radiating out from it across the whole picture.',
  },
};

const SET = JSON.parse(await readFile(path.join(ROOT, 'src', 'set.json'), 'utf8'));
/** Common, uncommon and rare cards have a picture window; the rarer ones are full art. */
const fullArt = (card) => ['ultra', 'secret', 'gold'].includes(card.rarity);
const cardImage = (card) => {
  const size = fullArt(card) ? TALL : WIDE;
  return {
    size,
    prompt: `${card.scene} ${size === TALL ? FULL_ART : ''} ${ARTISTS[card.artist].style} ${LOOSE} ${NO_TEXT}`,
  };
};

export const IMAGES = {
  // --- cards -----------------------------------------------------------------
  ...Object.fromEntries(SET.map((card) => [card.id, cardImage(card)])),

  // --- packs -----------------------------------------------------------------
  'pack-rex': packArt(
    'A ferocious red and orange Tyrannosaurus rex roaring, with fire-coloured energy, on a background of deep crimson and gold.',
    'The dinosaur bursts towards the viewer in a dramatic foreshortened pose.'),
  'pack-trike': packArt(
    'An emerald-green Triceratops with glowing horns, with green and teal energy, on a background of dark teal and lime.',
    'Seen from low down and side-on, it rears right up on its hind legs facing LEFT, head tossed back so its three horns ' +
    'sweep up towards the top left, front feet high in the air about to stomp down.'),
  'pack-spino': packArt(
    'A Spinosaurus with a glowing sail rising out of a great splash of water, with blue and violet energy, on a background of deep indigo and cyan.',
    'The dinosaur bursts towards the viewer in a dramatic foreshortened pose.'),
  'pack-ptera': packArt(
    'A Pteranodon with a long crest, with lightning-yellow and magenta energy, on a background of deep purple and hot pink.',
    'Seen from below, it rockets straight UP the image in a tight corkscrew climb, its beak pointing at the top edge, one ' +
    'wing swept high to the upper right and the other low to the lower left, a spiral trail of light twisting behind it.'),

  // --- logos -----------------------------------------------------------------
  logo: {
    size: WIDE, transparent: true,
    prompt:
      'A logo that reads exactly "DINO RIPPER" on two lines, "DINO" above "RIPPER". Big chunky rounded 3D ' +
      'letters with a glossy orange-to-yellow gradient, a bevelled chrome edge and a thick dark forest-green outline. ' +
      'Three diagonal dinosaur claw slashes rip through the letters, with torn foil edges curling back. ' +
      `The text reads exactly DINO RIPPER and nothing else. ${LOGO_STYLE}`,
  },
  'set-logo': {
    size: WIDE, transparent: true,
    prompt:
      'A logo for a trading card expansion that reads exactly "TITAN DAWN" on two lines, "TITAN" above "DAWN". ' +
      'Sharp, slanted, angular metallic letters in polished silver and white with a gold trim and a magenta-to-orange ' +
      'sunrise glow behind them, a thin black outline, and a small rising sun with rays between the two words. ' +
      `The text reads exactly TITAN DAWN and nothing else. ${LOGO_STYLE}`,
  },

  // --- card back and binder ----------------------------------------------------
  // The card back is put together in the browser (see card.ts): this hide fills the card whatever its shape,
  // the amber sits in the middle, and the Dino Ripper logo goes inside the amber.
  'back-skin': {
    size: TALL,
    prompt:
      'A flat, front-on surface texture filling the whole image edge to edge: the hide of a dinosaur, deep teal-green, ' +
      'made of rounded bumpy reptile scales of different sizes fitted together like pebbles, slightly bigger scales ' +
      'towards the middle, evenly lit with a soft sheen. A bold, clean, simple illustration for a children\'s dinosaur ' +
      'card game: friendly and chunky, not ornate, not fantasy. No frame, no border, no corners, no gold, no metal, ' +
      'no gemstone, no claw, no eye, no text, no letters.',
  },
  amber: {
    size: WIDE, transparent: true,
    prompt:
      'One large smooth polished pebble of golden-orange amber, a wide horizontal oval, flat and front-on, centred. ' +
      'It is translucent and glows warmly from inside, with a few tiny bubbles and one small prehistoric fern leaf ' +
      'trapped near the left edge; the middle of the amber is clear and empty. A bold, clean illustration for a ' +
      'children\'s dinosaur card game. No setting, no metal, no gold frame, no claw, no insect, no text. ' +
      'Fully transparent background, no shadow on the background, no other objects.',
  },
  binder: {
    size: TALL,
    prompt:
      'A flat, front-on surface texture filling the whole image edge to edge: the cover of a premium card ' +
      'collector\'s binder in dark green leather embossed with reptile scales, a line of gold stitching near the ' +
      'edges, and in the centre a large embossed gold emblem of a Tyrannosaurus rex skull in profile inside a ring ' +
      'of fern leaves. Soft studio light, realistic leather. No text, no letters, no numbers.',
  },
};

const exists = (p) => access(p).then(() => true, () => false);

async function openai(endpoint, body) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY is not set (put it in .env.local)');
  const isForm = body instanceof FormData;
  const res = await fetch(`https://api.openai.com/v1/${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, ...(isForm ? {} : { 'Content-Type': 'application/json' }) },
    body: isForm ? body : JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${json.error?.message ?? JSON.stringify(json)}`);
  return Buffer.from(json.data[0].b64_json, 'base64');
}

async function gen(id) {
  const spec = IMAGES[id];
  if (!spec) throw new Error(`unknown image id "${id}"`);
  console.log(`[${id}] generating with ${MODEL}...`);
  const png = await openai('images/generations', {
    model: MODEL,
    prompt: spec.prompt.replace(/\s+/g, ' '),
    size: spec.size,
    quality: QUALITY,
    background: spec.transparent ? 'transparent' : 'opaque',
    output_format: 'png',
  });
  await mkdir(RAW, { recursive: true });
  await writeFile(path.join(RAW, `${id}.png`), png);
  console.log(`[${id}] wrote art/raw/${id}.png`);
}

/**
 * Redraws one picture with a change applied, keeping its artist's style and everything else about
 * it. The previous version is kept beside it as <id>.prev.png.
 */
async function tweak(id, instruction) {
  const spec = IMAGES[id];
  if (!spec) throw new Error(`unknown image id "${id}"`);
  const file = path.join(RAW, `${id}.png`);
  const current = await readFile(file);
  const form = new FormData();
  form.set('model', MODEL);
  form.set(
    'prompt',
    `Redraw this exact picture: the same subject, the same art style and materials, the same colours and the same ` +
      `scene, with one change. ${instruction} Change nothing else. ${NO_TEXT}`,
  );
  form.set('size', spec.size);
  form.set('quality', QUALITY);
  form.set('output_format', 'png');
  form.append('image[]', new Blob([current], { type: 'image/png' }), `${id}.png`);
  console.log(`[${id}] redrawing with ${MODEL}...`);
  const png = await openai('images/edits', form);
  await writeFile(path.join(RAW, `${id}.prev.png`), current);
  await writeFile(file, png);
  console.log(`[${id}] wrote art/raw/${id}.png (previous kept as ${id}.prev.png)`);
}

async function pack() {
  await mkdir(OUT, { recursive: true });
  for (const [id, spec] of Object.entries(IMAGES)) {
    const src = path.join(RAW, `${id}.png`);
    if (!(await exists(src))) continue;
    let img = sharp(src);
    if (spec.transparent) img = img.trim().resize({ width: 1000, withoutEnlargement: true });
    else if (spec.size === WIDE) img = img.resize({ width: 960 });
    else img = img.resize({ width: 840 });
    await img.webp({ quality: 84 }).toFile(path.join(OUT, `${id}.webp`));
    console.log(`[${id}] packed public/art/${id}.webp`);
  }
}

async function pool(ids) {
  const queue = [...ids];
  const failed = [];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let id = queue.shift(); id; id = queue.shift()) {
        try {
          await gen(id);
        } catch (err) {
          console.error(`[${id}] FAILED: ${err.message}`);
          failed.push(id);
        }
      }
    }),
  );
  return failed;
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === 'list') {
  console.log(Object.keys(IMAGES).join('\n'));
} else if (cmd === 'gen') {
  const failed = await pool(args);
  await pack();
  if (failed.length) process.exitCode = 1;
} else if (cmd === 'tweak') {
  await tweak(args[0], args.slice(1).join(' '));
  await pack();
} else if (cmd === 'pack') {
  await pack();
} else if (cmd === 'all') {
  const missing = [];
  for (const id of Object.keys(IMAGES)) if (!(await exists(path.join(RAW, `${id}.png`)))) missing.push(id);
  const failed = await pool(missing);
  await pack();
  if (failed.length) {
    console.error(`failed: ${failed.join(', ')}`);
    process.exitCode = 1;
  }
} else {
  console.log('usage: npm run art -- all | gen <id...> | tweak <id> "<change>" | pack | list');
}
