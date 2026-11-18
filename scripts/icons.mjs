// Makes the app's icons and its link-preview picture from art that is already in the project.
//
//   npm run icons
//
//   public/favicon.ico            16, 32 and 48 pixel browser tab icon
//   public/icon-192.png           home-screen icons for Android (see public/manifest.webmanifest)
//   public/icon-512.png
//   public/icon-maskable-512.png  the same, filling the whole square so Android can cut its own shape
//   public/apple-touch-icon.png   home-screen icon for iPhones and iPads
//   public/og.jpg                 the picture shown when a link to the app is shared
//   android/app/src/main/res/mipmap-*/   launcher icons for the Android app
//
// The icon is the back of a card: green dinosaur hide with the piece of amber in the middle. The
// larger sizes have the Dino Ripper logo inside the amber, as the cards do; at tab-icon size the
// logo would be a smudge, so the small ones are the amber alone.
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');
const art = (name) => join(pub, 'art', `${name}.webp`);
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };

const hide = await sharp(art('back-skin')).png().toBuffer();
const amber = await sharp(art('amber')).trim().png().toBuffer();
const logo = await sharp(art('logo')).trim().png().toBuffer();

/** The amber, `width` pixels across, with the logo inside it if asked for. */
async function gem(width, withLogo) {
  const stone = await sharp(amber).resize({ width }).png().toBuffer();
  if (!withLogo) return stone;
  const { height } = await sharp(stone).metadata();
  const mark = await sharp(logo).resize({ width: Math.round(width * 0.68) }).png().toBuffer();
  const m = await sharp(mark).metadata();
  return sharp(stone)
    .composite([{ input: mark, left: Math.round((width - m.width) / 2), top: Math.round((height - m.height) / 2) }])
    .png()
    .toBuffer();
}

/**
 * A square icon: the amber on a tile of dinosaur hide.
 * `corner` rounds the tile (as a fraction of its size); `fill` is how much of the tile's width the
 * amber takes; `withLogo` puts the logo in the amber.
 */
async function icon(size, { corner = 0, fill = 0.86, withLogo = size >= 96 } = {}) {
  // The hide is zoomed in for small icons, so the scales stay big enough to read.
  const zoom = size < 96 ? 0.35 : 0.6;
  const meta = await sharp(hide).metadata();
  const side = Math.round(meta.width * zoom);
  const tile = await sharp(hide)
    .extract({ left: Math.round((meta.width - side) / 2), top: Math.round((meta.height - side) / 2), width: side, height: side })
    .resize(size, size)
    .png()
    .toBuffer();
  const shade = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <defs><radialGradient id="v" cx="50%" cy="50%" r="72%">
        <stop offset="0.45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.55"/>
      </radialGradient></defs>
      <rect width="${size}" height="${size}" fill="url(#v)"/>
    </svg>`,
  );
  const stone = await gem(Math.round(size * fill), withLogo);
  const s = await sharp(stone).metadata();
  const flat = await sharp(tile)
    .composite([{ input: shade }, { input: stone, left: Math.round((size - s.width) / 2), top: Math.round((size - s.height) / 2) }])
    .png()
    .toBuffer();
  if (!corner) return flat;
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${size * corner}" fill="#fff"/></svg>`,
  );
  return sharp(flat).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
}

/** An .ico file holding the given PNG pictures (each one square, and smaller than 256 pixels). */
function ico(pngs) {
  const header = Buffer.alloc(6 + 16 * pngs.length);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach(({ size, data }, n) => {
    const at = 6 + 16 * n;
    header.writeUInt8(size, at);
    header.writeUInt8(size, at + 1);
    header.writeUInt16LE(1, at + 4); // colour planes
    header.writeUInt16LE(32, at + 6); // bits per pixel
    header.writeUInt32LE(data.length, at + 8);
    header.writeUInt32LE(offset, at + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...pngs.map((p) => p.data)]);
}

async function write(name, data) {
  await writeFile(join(pub, name), data);
  console.log(`wrote public/${name}`);
}

// The tab icon is a rounded tile with the amber nearly filling it, so it still reads at 16 pixels.
const tab = { corner: 0.22, fill: 0.92 };
await write('favicon.ico', ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await icon(size, tab) })))));
await write('icon-192.png', await icon(192, { corner: 0.22 }));
await write('icon-512.png', await icon(512, { corner: 0.22 }));
// Android may crop a maskable icon to a circle 80% of its width, so the amber stays inside that.
await write('icon-maskable-512.png', await icon(512, { fill: 0.66 }));
// iOS rounds the corners itself, and shows black wherever an icon is see-through.
await write('apple-touch-icon.png', await icon(180));

// The Android app's launcher icons, one set for each screen density, if the Android project is there.
// Newer Android draws the "foreground" picture over a plain colour (res/values/ic_launcher_background.xml)
// and cuts its own shape out of the middle, so the amber sits well inside it. The other two are for
// older Android, which is what Fire tablets use.
const res = join(root, 'android/app/src/main/res');
if (existsSync(res)) {
  const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [density, scale] of Object.entries(densities)) {
    const size = 48 * scale;
    const full = 108 * scale;
    const stone = await gem(Math.round(full * 0.56), true);
    const s = await sharp(stone).metadata();
    const top = Math.round((full - s.height) / 2);
    const left = Math.round((full - s.width) / 2);
    const files = {
      'ic_launcher.png': await icon(size, { corner: 0.22, withLogo: true }),
      'ic_launcher_round.png': await icon(size, { corner: 0.5, fill: 0.72, withLogo: true }),
      'ic_launcher_foreground.png': await sharp(stone)
        .extend({ top, bottom: full - s.height - top, left, right: full - s.width - left, background: CLEAR })
        .png()
        .toBuffer(),
    };
    for (const [name, data] of Object.entries(files)) {
      await writeFile(join(res, `mipmap-${density}`, name), data);
      console.log(`wrote android/app/src/main/res/mipmap-${density}/${name}`);
    }
  }
}

// The link preview: five of the full-art cards' pictures side by side, dimmed, with the logo over them.
const OG_W = 1200;
const OG_H = 630;
const strips = ['raptor-secret', 'spino-secret', 'rex-gold', 'brachio-secret', 'rex-ultra'];
const stripW = OG_W / strips.length;
const backdrop = await sharp({ create: { width: OG_W, height: OG_H, channels: 3, background: '#071216' } })
  .composite(
    await Promise.all(
      strips.map(async (id, i) => ({
        input: await sharp(art(id)).resize(stripW, OG_H, { fit: 'cover', position: 'top' }).toBuffer(),
        left: i * stripW,
        top: 0,
      })),
    ),
  )
  .png()
  .toBuffer();
const dim = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_W}" height="${OG_H}">
    <defs><radialGradient id="d" cx="50%" cy="50%" r="65%">
      <stop offset="0" stop-color="#03080a" stop-opacity="0.72"/><stop offset="1" stop-color="#03080a" stop-opacity="0.3"/>
    </radialGradient></defs>
    <rect width="${OG_W}" height="${OG_H}" fill="url(#d)"/>
  </svg>`,
);
const title = await sharp(logo).resize(OG_W - 520, OG_H - 230, { fit: 'inside' }).png().toBuffer();
// A soft dark copy of the logo underneath itself, to lift it off the pictures.
const shadow = await sharp(title)
  .ensureAlpha()
  .linear([0, 0, 0, 0.6], [0, 0, 0, 0])
  .extend({ top: 50, bottom: 50, left: 50, right: 50, background: CLEAR })
  .blur(18)
  .toBuffer();
const t = await sharp(title).metadata();
const left = Math.round((OG_W - t.width) / 2);
const top = Math.round((OG_H - t.height) / 2);
await write(
  'og.jpg',
  await sharp(backdrop)
    .composite([{ input: dim }, { input: shadow, left: left - 50, top: top - 50 + 14 }, { input: title, left, top }])
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer(),
);
