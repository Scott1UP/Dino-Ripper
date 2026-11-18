// Art pipeline (ported from dino-kart's scripts/sprites.mjs). Run through npm so the API key is loaded:
//
//   npm run art -- all            generate everything that is missing, then pack
//   npm run art -- gen rex        generate (or regenerate) one image by id
//   npm run art -- pack           convert art/raw/*.png into public/art/*.webp
//   npm run art -- list           list every id
//
// Raw model output is kept in art/raw/ so `pack` can be re-run for free.

import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'art', 'raw');
const OUT = path.join(ROOT, 'public', 'art');

const MODEL = process.env.ART_MODEL ?? 'gpt-image-2.6-sunburst';
const QUALITY = process.env.ART_QUALITY ?? 'high';
const CONCURRENCY = 4;

const ORIGINAL =
  'An original dinosaur design for a children\'s collectible card game about real dinosaurs. It does not ' +
  'resemble any character from an existing game, film or cartoon. Friendly and exciting, suitable for a young child.';
const NO_TEXT =
  'No text, no letters, no numbers, no logos, no signature, no border, no card frame: the artwork fills the whole image edge to edge.';

// One art style per rarity.
const STYLE = {
  common:
    'Style: a pencil and wax-crayon drawing on cream sketchbook paper, like a page from a talented young ' +
    'artist\'s sketchbook: visible waxy crayon strokes, soft graphite outlines, slightly uneven colouring, paper grain showing through.',
  uncommon:
    'Style: a loose traditional watercolour painting with fine ink linework: wet-on-wet washes, soft colour ' +
    'bleeds and blooms, granulating pigment, white paper showing at the edges of the washes, cold-press paper texture.',
  rare:
    'Style: detailed 16-bit pixel art like a classic 1990s console game: crisp square pixels, a limited ' +
    'vivid palette, dithered shading, clean dark outlines, a layered parallax-style background.',
  ultra:
    'Style: spray-paint street art on a wall: bold stencil shapes, soft aerosol overspray, paint drips, ' +
    'splatter, neon colours against deep shadow, thick confident highlights, energetic abstract bursts of colour behind the subject.',
  secret:
    'Style: a breathtaking, richly detailed storybook illustration in gouache and coloured ink, the kind you ' +
    'could look at for minutes: luminous colour, glowing light, hundreds of small charming details, ' +
    'decorative flowing shapes, a complete living world around the subject.',
  gold:
    'Style: the entire image is one solid slab of polished yellow gold, sculpted as a bas-relief: the subject ' +
    'is raised, embossed metal; the background is gold too, finely engraved with radiating sunburst lines and a ' +
    'border of small scale patterns. Everything is gold, only gold: bright highlights, deep amber shadows, no other colours.',
};

const WIDE = '1536x1024';
const TALL = '1024x1536';
const FULL_ART =
  'Vertical composition for a full-art trading card: the dinosaur\'s head and body sit in the upper two thirds ' +
  'of the image; the lower third is calmer scenery so that words can be printed over it.';

const card = (style, size, subject) => ({
  size,
  prompt: `${subject} ${size === TALL ? FULL_ART : ''} ${STYLE[style]} ${ORIGINAL} ${NO_TEXT}`,
});

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

export const IMAGES = {
  // --- cards -----------------------------------------------------------------
  // Each card names its own camera angle and facing, so the set does not all look the same way.
  compy: card('common', WIDE,
    'A small, slender green Compsognathus with a yellow belly, seen from the front in three-quarter view, sprinting ' +
    'towards the viewer and to the LEFT. Its head is on the left side of the picture, jaws open, snapping up at a blue ' +
    'dragonfly in the top left corner; its tail trails away to the right between big ferns.'),
  para: card('common', WIDE,
    'Two orange Parasaurolophus with long striped head crests at the edge of a lake, seen from a low camera near the water. ' +
    'The nearer one fills the left half of the picture, facing LEFT with its head lowered to drink, ripples spreading; ' +
    'the other stands further back on the right, head thrown straight up, calling.'),
  pachy: card('common', WIDE,
    'A blue-grey Pachycephalosaurus seen exactly head-on, charging straight at the viewer down a rocky hillside. Its thick ' +
    'domed head, ringed with little knobs, is lowered and huge in the middle of the picture, its body foreshortened ' +
    'behind it, dust and pebbles flying out to both sides.'),
  stego: card('uncommon', WIDE,
    'A big Stegosaurus with tall rust-red back plates, seen from behind in a rear three-quarter view as it walks away ' +
    'into a meadow of ferns and horsetails in warm evening light. Its spiked tail swings large in the foreground on the ' +
    'right; it looks back over its shoulder towards the LEFT.'),
  anky: card('uncommon', WIDE,
    'A sand-coloured, heavily armoured Ankylosaurus seen from directly above, a bird\'s-eye view looking straight down on ' +
    'its wide knobbly back. Its body is curled in a C shape as it whips its heavy tail club round in an arc, the club ' +
    'smashing into the red rock at the bottom left, dust bursting outwards.'),
  trike: card('rare', WIDE,
    'A green Triceratops with a bright patterned frill and three long horns, charging through a jungle clearing.'),
  ptera: card('rare', WIDE,
    'A Pteranodon with a long red crest seen from below as it flies directly overhead, heading towards the top LEFT ' +
    'corner. Its huge wings span the whole picture on a diagonal with the setting sun glowing through them; sea cliffs ' +
    'and crashing waves are small and far below along the bottom edge.'),
  raptor: card('ultra', TALL,
    'A feathered Velociraptor in electric blue and hot orange, crouched low on a rock and facing the viewer head-on, seen ' +
    'from a low camera. Its head is tilted to one side with a sharp curious stare, one foot raised to show its big sickle ' +
    'claw, feathered arms spread wide, its long tail curling up and round behind it on the LEFT.'),
  spino: card('secret', TALL,
    'A magnificent Spinosaurus with a tall glowing sail wading through a river at twilight in a prehistoric jungle. ' +
    'Glowing fireflies and luminous plants reflect in the water, a waterfall falls in the distance, small pterosaurs ' +
    'cross a huge moon, and tiny dinosaurs and fish hide among giant leaves and flowers.'),
  rex: card('gold', TALL,
    'A mighty Tyrannosaurus rex roaring, head and shoulders in three-quarter view, every scale and tooth sculpted, wearing a small crown.'),

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
  const res = await fetch(`https://api.openai.com/v1/${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
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

async function pack() {
  await mkdir(OUT, { recursive: true });
  for (const [id, spec] of Object.entries(IMAGES)) {
    const src = path.join(RAW, `${id}.png`);
    if (!(await exists(src))) continue;
    let img = sharp(src);
    if (spec.transparent) img = img.trim().resize({ width: 1000, withoutEnlargement: true });
    else if (spec.size === WIDE) img = img.resize({ width: 1080 });
    else img = img.resize({ width: 900 });
    await img.webp({ quality: 88 }).toFile(path.join(OUT, `${id}.webp`));
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
  console.log('usage: npm run art -- all | gen <id...> | pack | list');
}
