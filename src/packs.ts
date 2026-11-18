// The booster packs: a WebGL layer drawn over the table. Each pack is a pillow-shaped foil
// wrapper with a metallic shader; the top can be torn off.

import { CanvasTexture, Group, Mesh, PerspectiveCamera, PlaneGeometry, Scene, ShaderMaterial, type Texture, WebGLRenderer } from 'three';
import { audio } from './audio';
import { clamp, ease, lerp, tween, wait } from './tween';

/** Pack width as a fraction of its height. */
const PW = 0.56;
/** Height of the crimped seal at each end, as a fraction of the pack's height. */
const SEAL = 0.055;
/** Where the top tears off (0 = bottom of the pack, 1 = top). */
const TEAR = 0.915;
const SLOTS = 5;
/** How often a shelf of packs that are lying still is redrawn. */
const IDLE_FPS = 30;
/** Depth between packs in the pile: more than a pack is thick. */
const PILE_GAP = 26;
/** The starting fan: offsets as fractions of a pack's height, and a lean in radians. */
const FAN = [
  { dx: -0.1, dy: 0.02, rz: -0.13 },
  { dx: 0.09, dy: -0.03, rz: 0.1 },
  { dx: -0.03, dy: 0.03, rz: -0.05 },
  { dx: 0.12, dy: 0, rz: 0.15 },
  { dx: -0.06, dy: -0.02, rz: -0.09 },
];
const VARIANTS = ['pack-rex', 'pack-trike', 'pack-spino', 'pack-ptera'];

/** How far the stack of cards inside pushes the foil out, as a fraction of the pack's height. */
const DEPTH = 0.024;

// The five cards inside make a flat block under the foil. They fill the wrapper from side to side,
// so the block runs right out to the side edges; only its top and bottom ends step down to the
// loose foil. 1 on top of the cards, 0 off them.
const BLOCK = /* glsl */ `
  float block(vec2 uv) {
    vec2 p = abs(uv - 0.5) * vec2(${PW}, 1.0);
    float across = 1.0 - smoothstep(${PW} * 0.5 - 0.012, ${PW} * 0.5 - 0.002, p.x);
    float along = 1.0 - smoothstep(0.35, 0.378, p.y);
    return across * along;
  }
`;

const VERT = /* glsl */ `
  uniform float uStrip;
  uniform float uProg;
  varying vec2 vUv;
  varying vec3 vT;
  varying vec3 vB;
  varying vec3 vN;
  varying vec3 vView;
  ${BLOCK}

  void main() {
    vUv = uv;
    vec3 p = position;
    p.z += ${DEPTH} * block(uv);

    // The torn-off strip peels up and towards the viewer, from the left edge across to the right.
    if (uStrip > 0.5) {
      float a = clamp((uProg * 1.5 - uv.x) / 0.5, 0.0, 1.0);
      p.y += a * 0.035;
      p.z += a * a * 0.13;
      p.x -= a * 0.02;
    }

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vView = mv.xyz;
    vT = normalMatrix * vec3(1.0, 0.0, 0.0);
    vB = normalMatrix * vec3(0.0, 1.0, 0.0);
    vN = normalMatrix * vec3(0.0, 0.0, 1.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D map;
  uniform float uTime;
  uniform float uTorn;
  uniform float uStrip;
  uniform float uAlpha;
  uniform float uSeed;
  varying vec2 vUv;
  varying vec3 vT;
  varying vec3 vB;
  varying vec3 vN;
  varying vec3 vView;
  ${BLOCK}

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  void main() {
    vec2 uv = vUv;

    // Zig-zag cut along the top and bottom edges.
    float zig = abs(fract(uv.x * 30.0) - 0.5) * 2.0;
    if (uv.y > 1.0 - 0.011 * zig || uv.y < 0.011 * zig) discard;

    // The tear line, ragged.
    float jag = ${TEAR} + (noise(vec2(uv.x * 70.0, uSeed)) - 0.5) * 0.014 + (noise(vec2(uv.x * 9.0, uSeed + 3.0)) - 0.5) * 0.022;
    if (uTorn > 0.5) {
      if (uStrip > 0.5 && uv.y < jag) discard;
      if (uStrip < 0.5 && uv.y > jag) discard;
    }

    float inSeal = 1.0 - smoothstep(${SEAL} - 0.004, ${SEAL} + 0.004, min(uv.y, 1.0 - uv.y));
    float top = block(uv);

    // Surface slope. The foil is flat and smooth over the cards; only the bevel round the
    // cards, a few neat pleats in the loose foil at each end, and the crimped seals catch the light.
    float e = 0.004;
    vec2 slope = vec2(block(uv + vec2(e, 0.0)) - block(uv - vec2(e, 0.0)), block(uv + vec2(0.0, e)) - block(uv - vec2(0.0, e))) / (2.0 * e);
    slope *= vec2(${DEPTH} / ${PW}, ${DEPTH}) * 2.2;
    float ends = smoothstep(0.36, 0.42, abs(uv.y - 0.5)) * (1.0 - inSeal) * (1.0 - top);
    float pleats = cos(uv.x * 64.0 + noise(vec2(uv.x * 5.0, uSeed)) * 3.0) * ends;
    float ridges = sin(uv.y * 700.0) * inSeal;
    vec3 nl = normalize(vec3(-slope.x + pleats * 0.16, -slope.y + ridges * 0.45, 1.0));
    vec3 n = normalize(vT * nl.x + vB * nl.y + vN * nl.z);

    vec3 v = normalize(-vView);
    vec3 r = reflect(-v, n);

    // One broad, soft band of studio light lying across the foil, drifting slowly.
    float a = r.x * 1.7 + r.y * 1.1 + uv.x * 1.1 - uv.y * 0.7 + uTime * 0.22 + uSeed;
    float light = 0.5 + 0.5 * sin(a * 2.2);
    light = light * light * (3.0 - 2.0 * light);
    float key = pow(max(dot(r, normalize(vec3(0.3, 0.6, 0.74))), 0.0), 18.0);

    vec3 art = texture2D(map, uv).rgb;
    vec3 rainbow = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + a * 0.35));

    // Metal: the print stays readable, the light band brightens it, with a thin rainbow in the band.
    vec3 col = art * (0.66 + 0.5 * light);
    col += art * rainbow * 0.16 * light;
    col += vec3(1.0) * (pow(light, 6.0) * 0.12 + key * 0.3);
    col += pow(1.0 - max(dot(n, v), 0.0), 3.0) * 0.1;
    // A soft shadow at the foot of the bevel, so the block of cards reads as raised.
    col *= 1.0 - 0.22 * top * (1.0 - top) * 4.0;
    col = mix(col, col * 0.88 + vec3(0.08) * light, inSeal);

    // Bright torn edge.
    col += uTorn * (1.0 - smoothstep(0.0, 0.007, abs(uv.y - jag))) * 0.7;

    gl_FragColor = vec4(col, uAlpha);
  }
`;

interface Pose {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
  s: number;
}

class Pack {
  group = new Group();
  strip: Mesh;
  mats: ShaderMaterial[];
  cur: Pose;
  tgt: Pose;
  /** While true, a tween is driving `cur` and the pack does not chase `tgt`. */
  manual = false;
  where: 'shelf' | 'center' | 'drag' = 'shelf';
  phase = Math.random() * 10;
  speed = 9;

  /** Where it lies on the shelf, as fractions of the screen, and its lean. Moves when the pack is dropped somewhere new. */
  home = { fx: 0, fy: 0, rz: 0 };
  /** Stacking order on the shelf: the highest is on top. */
  order = 0;

  /** `fan` is which place in the starting fan this pack was dealt into. */
  constructor(geo: PlaneGeometry, front: Texture, back: Texture, public fan: number, start: Pose) {
    const mat = (map: Texture, strip: number) =>
      new ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        uniforms: {
          map: { value: map },
          uTime: { value: 0 },
          uTorn: { value: 0 },
          uStrip: { value: strip },
          uProg: { value: 0 },
          uAlpha: { value: 1 },
          uSeed: { value: this.phase },
        },
      });
    this.mats = [mat(front, 0), mat(front, 1), mat(back, 0)];
    const body = new Mesh(geo, this.mats[0]);
    this.strip = new Mesh(geo, this.mats[1]);
    this.strip.visible = false;
    const rear = new Mesh(geo, this.mats[2]);
    rear.rotation.y = Math.PI;
    this.group.add(body, this.strip, rear);
    this.cur = { ...start };
    this.tgt = { ...start };
  }

  dispose() {
    for (const m of this.mats) m.dispose();
  }
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${src}`));
    img.src = src;
  });
}

function drawCover(g: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const s = Math.max(w / img.width, h / img.height);
  g.drawImage(img, (w - img.width * s) / 2, (h - img.height * s) / 2, img.width * s, img.height * s);
}

function drawFit(g: CanvasRenderingContext2D, img: HTMLImageElement, cx: number, cy: number, w: number) {
  const h = (w * img.height) / img.width;
  g.drawImage(img, cx - w / 2, cy - h / 2, w, h);
}

const TW = 896;
const TH = 1600;

function canvasTexture(draw: (g: CanvasRenderingContext2D) => void): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = TW;
  canvas.height = TH;
  draw(canvas.getContext('2d')!);
  const tex = new CanvasTexture(canvas);
  tex.anisotropy = 8;
  return tex;
}

/** The printed front of a pack: artwork, the brand logo, the set name and the small print. */
function frontTexture(art: HTMLImageElement, logo: HTMLImageElement, setLogo: HTMLImageElement): CanvasTexture {
  return canvasTexture((g) => {
    drawCover(g, art, TW, TH);
    const shade = g.createLinearGradient(0, 0, 0, TH);
    shade.addColorStop(0, 'rgba(0,0,0,0.3)');
    shade.addColorStop(0.12, 'rgba(0,0,0,0)');
    shade.addColorStop(0.55, 'rgba(0,0,0,0)');
    shade.addColorStop(0.8, 'rgba(0,0,0,0.6)');
    shade.addColorStop(1, 'rgba(0,0,0,0.78)');
    g.fillStyle = shade;
    g.fillRect(0, 0, TW, TH);

    // The dinosaur keeps the top two thirds to itself; both logos sit together below it.
    g.shadowColor = 'rgba(0,0,0,0.6)';
    g.shadowBlur = 26;
    g.shadowOffsetY = 8;
    const setW = TW * 0.66;
    const setH = (setW * setLogo.height) / setLogo.width;
    const setY = TH * 0.775;
    const brandW = TW * 0.3;
    const brandH = (brandW * logo.height) / logo.width;
    drawFit(g, setLogo, TW / 2, setY, setW);
    drawFit(g, logo, TW / 2, setY - setH / 2 - brandH * 0.42, brandW);
    g.shadowColor = 'transparent';

    g.font = '46px "Lilita One", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const label = '5 DINO CARDS';
    const lw = g.measureText(label).width + 70;
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.beginPath();
    g.roundRect(TW / 2 - lw / 2, TH * 0.9 - 36, lw, 72, 36);
    g.fill();
    g.fillStyle = '#fff';
    g.fillText(label, TW / 2, TH * 0.902);
  });
}

/** The back of every pack: plain foil with a seam, the logos and some small print. */
function backTexture(logo: HTMLImageElement, setLogo: HTMLImageElement): CanvasTexture {
  return canvasTexture((g) => {
    const base = g.createLinearGradient(0, 0, TW, TH);
    base.addColorStop(0, '#5d6b78');
    base.addColorStop(0.5, '#8996a3');
    base.addColorStop(1, '#4b5763');
    g.fillStyle = base;
    g.fillRect(0, 0, TW, TH);
    // The seam where the wrapper is glued shut.
    g.fillStyle = 'rgba(255,255,255,0.22)';
    g.fillRect(TW / 2 - 46, 0, 92, TH);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(TW / 2 + 46, 0, 5, TH);
    drawFit(g, logo, TW / 2, TH * 0.24, TW * 0.6);
    drawFit(g, setLogo, TW / 2, TH * 0.47, TW * 0.46);
    g.fillStyle = 'rgba(15,20,26,0.8)';
    g.font = '40px "Lilita One", sans-serif';
    g.textAlign = 'center';
    g.fillText('5 DINO CARDS INSIDE', TW / 2, TH * 0.64);
    g.fillStyle = 'rgba(15,20,26,0.45)';
    for (let i = 0; i < 7; i++) g.fillRect(TW * 0.2, TH * 0.69 + i * 30, TW * (i === 6 ? 0.35 : 0.6), 12);
  });
}

export class Packs {
  /** Called when the pack in the middle is tapped. */
  onOpen: (() => void) | null = null;
  /** Called when a pack arrives in, or leaves, the middle. */
  onCenter: ((has: boolean) => void) | null = null;
  interactive = true;

  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(30, 1, 10, 10000);
  private geo = new PlaneGeometry(PW, 1, 44, 80);
  private fronts: Texture[] = [];
  private back!: Texture;
  private packs: Pack[] = [];
  private center: Pack | null = null;
  private vw = 1;
  private vh = 1;
  private shelfHidden = false;
  private topOrder = 0;
  private bottomOrder = 0;
  private drag: { pack: Pack; from: 'shelf' | 'center'; dx: number; dy: number; sx: number; sy: number; lastX: number; moved: boolean } | null = null;
  private last = performance.now();
  private lastDraw = 0;
  private nextVariant = Math.floor(Math.random() * VARIANTS.length);

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
    // One and a half device pixels per pixel is sharp enough for foil, and a good deal less to fill than two.
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setClearColor(0x000000, 0);
  }

  async init() {
    const [logo, setLogo, ...arts] = await Promise.all(['logo', 'set-logo', ...VARIANTS].map((id) => loadImage(`./art/${id}.webp`)));
    await document.fonts.load('46px "Lilita One"').catch(() => undefined);
    this.fronts = arts.map((art) => frontTexture(art, logo, setLogo));
    this.back = backTexture(logo, setLogo);

    this.resize();
    // Dealt top pack first, so each later one slides in beneath.
    for (let i = SLOTS - 1; i >= 0; i--) this.spawn(i, (SLOTS - 1 - i) * 90);

    addEventListener('resize', () => this.resize());
    addEventListener('pointerdown', (e) => this.down(e));
    addEventListener('pointermove', (e) => this.move(e));
    addEventListener('pointerup', () => this.up());
    addEventListener('pointercancel', () => this.up());
    requestAnimationFrame((t) => this.frame(t));
  }

  // ---- layout ---------------------------------------------------------------

  private get shelfH() {
    return Math.min(this.vh * 0.42, (this.vw * 0.19) / PW);
  }
  /** The middle of the fan of packs. */
  private get shelfX() {
    return this.vw - this.shelfH * (PW / 2 + 0.16) - this.vw * 0.015;
  }
  /** The left edge of the fan of packs, and its middle, for pointing at. */
  shelfEdge() {
    return { x: this.shelfX - this.shelfH * (PW / 2 + 0.14), y: this.vh * 0.5 };
  }
  private get centerH() {
    return Math.min(this.vh * 0.64, (this.vw * 0.5) / PW);
  }
  private get centerPos() {
    return { x: this.vw * (this.vw > this.vh ? 0.46 : 0.4), y: this.vh * 0.47 };
  }

  /** Where a pack is dealt to start with: a loose fan, each pack a little off-line and leaning its own way. */
  private fanHome(i: number) {
    const h = this.shelfH;
    return {
      fx: (this.shelfX + FAN[i % FAN.length].dx * h) / this.vw,
      fy: (this.vh * 0.5 + (i - (SLOTS - 1) / 2) * h * 0.15 + FAN[i % FAN.length].dy * h) / this.vh,
      rz: FAN[i % FAN.length].rz,
    };
  }

  /**
   * A shelf pack lies flat at its home, leaning but never tipping, and every pack has its own
   * depth, further apart than a pack is thick, so no pack ever cuts through another.
   */
  private shelfPose(p: Pack, rank: number): Pose {
    return {
      x: p.home.fx * this.vw + (this.shelfHidden ? this.vw * 0.5 : 0),
      y: p.home.fy * this.vh,
      z: rank * PILE_GAP,
      rx: 0,
      ry: 0,
      rz: p.home.rz,
      s: this.shelfH,
    };
  }

  private centerPose(): Pose {
    return { ...this.centerPos, z: SLOTS * PILE_GAP + 30, rx: 0, ry: 0, rz: 0, s: this.centerH };
  }

  private place() {
    const shelf = this.packs.filter((p) => p.where === 'shelf').sort((a, b) => a.order - b.order);
    shelf.forEach((p, rank) => (p.tgt = this.shelfPose(p, rank)));
    for (const p of this.packs) {
      if (p.where === 'center' && !p.manual) p.tgt = this.centerPose();
    }
  }

  private resize() {
    this.vw = innerWidth;
    this.vh = innerHeight;
    this.renderer.setSize(this.vw, this.vh);
    this.camera.aspect = this.vw / this.vh;
    // One world unit is one CSS pixel at z = 0.
    this.camera.position.z = this.vh / 2 / Math.tan((15 * Math.PI) / 180);
    this.camera.far = this.camera.position.z * 3;
    this.camera.updateProjectionMatrix();
    this.place();
  }

  /** Deals a new pack into place `fan` of the fan. It slides in from the right, underneath the others. */
  private spawn(fan: number, delay = 0) {
    const variant = this.nextVariant++ % VARIANTS.length;
    const pack = new Pack(this.geo, this.fronts[variant], this.back, fan, this.centerPose());
    pack.home = this.fanHome(fan);
    pack.order = --this.bottomOrder;
    pack.cur = { ...this.shelfPose(pack, 0), x: this.vw + this.shelfH };
    pack.manual = true;
    setTimeout(() => (pack.manual = false), delay);
    this.packs.push(pack);
    this.scene.add(pack.group);
    this.place();
  }

  showShelf(show: boolean) {
    this.shelfHidden = !show;
    this.place();
  }

  // ---- grabbing -------------------------------------------------------------

  private hit(x: number, y: number): Pack | null {
    const sorted = [...this.packs].sort((a, b) => b.cur.z - a.cur.z);
    return sorted.find((p) => Math.abs(x - p.cur.x) < (PW * p.cur.s) / 2 && Math.abs(y - p.cur.y) < p.cur.s / 2) ?? null;
  }

  private down(e: PointerEvent) {
    if (!this.interactive || this.drag) return;
    if ((e.target as Element).closest?.('button, #binder, #zoom')) return;
    const pack = this.hit(e.clientX, e.clientY);
    if (!pack || pack.manual) return;
    this.drag = {
      pack,
      from: pack.where === 'center' ? 'center' : 'shelf',
      dx: pack.cur.x - e.clientX,
      dy: pack.cur.y - e.clientY,
      sx: e.clientX,
      sy: e.clientY,
      lastX: e.clientX,
      moved: false,
    };
    pack.where = 'drag';
    pack.speed = 22;
    pack.tgt = { ...pack.tgt, z: SLOTS * PILE_GAP + 60, rz: 0, s: pack.cur.s * 1.06 };
    audio.grab();
  }

  private move(e: PointerEvent) {
    const d = this.drag;
    if (!d) return;
    if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 10) d.moved = true;
    const vx = e.clientX - d.lastX;
    d.lastX = e.clientX;
    d.pack.tgt.x = e.clientX + d.dx;
    d.pack.tgt.y = e.clientY + d.dy;
    d.pack.tgt.ry = clamp(vx * 0.03, -0.7, 0.7);
    d.pack.tgt.rz = clamp(vx * 0.006, -0.2, 0.2);
  }

  private up() {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    const { pack } = d;
    pack.speed = 9;
    // Let go on the shelf side of the screen, a pack stays exactly where it was put, on top of the others.
    const overShelf = pack.tgt.x > this.vw * 0.7;
    const settle = () => {
      const half = (this.shelfH * PW) / 2;
      pack.home = {
        fx: clamp(pack.tgt.x, this.vw * 0.7, this.vw - half * 0.6) / this.vw,
        fy: clamp(pack.tgt.y, this.shelfH * 0.3, this.vh - this.shelfH * 0.3) / this.vh,
        rz: pack.home.rz,
      };
      pack.order = ++this.topOrder;
      pack.where = 'shelf';
      audio.drop();
    };

    if (d.from === 'center') {
      if (!d.moved) {
        pack.where = 'center';
        pack.tgt = this.centerPose();
        this.onOpen?.();
      } else if (overShelf) {
        this.center = null;
        settle();
        this.onCenter?.(false);
      } else {
        pack.where = 'center';
        audio.drop();
      }
    } else if (d.moved && overShelf) {
      settle();
    } else {
      // Into the middle; a pack already waiting there goes back to its place on the shelf, on top.
      if (this.center) {
        this.center.where = 'shelf';
        this.center.order = ++this.topOrder;
      }
      this.center = pack;
      pack.where = 'center';
      this.onCenter?.(true);
      audio.drop();
    }
    this.place();
  }

  // ---- opening --------------------------------------------------------------

  /** Where the pack in the middle is on screen. */
  centerRect(): Rect {
    const c = this.center!.cur;
    return { x: c.x - (PW * c.s) / 2, y: c.y - c.s / 2, w: PW * c.s, h: c.s };
  }

  /** A full turn, showing the back of the pack, ending face-on and a little larger. */
  async spin() {
    const p = this.center!;
    p.manual = true;
    const from = { ...p.cur };
    const to = this.centerPose();
    audio.whoosh(0.8);
    await tween(
      950,
      (t) => {
        p.cur.x = lerp(from.x, to.x, t);
        p.cur.y = lerp(from.y, to.y, t) - Math.sin(t * Math.PI) * to.s * 0.04;
        p.cur.rz = lerp(from.rz, 0, t);
        p.cur.rx = Math.sin(t * Math.PI) * 0.12;
        p.cur.ry = t * Math.PI * 2;
        p.cur.s = lerp(from.s, to.s, t) * (1 + Math.sin(t * Math.PI) * 0.08);
      },
      ease.inOut,
    );
    p.cur.ry = 0;
    p.cur.rx = 0;
  }

  /** Tears the top off, left to right, and throws the strip away. */
  async rip() {
    const p = this.center!;
    const [body, strip] = p.mats;
    body.uniforms.uTorn.value = 1;
    strip.uniforms.uTorn.value = 1;
    p.strip.visible = true;
    audio.rip();
    const x0 = p.cur.x;
    await tween(
      460,
      (t) => {
        strip.uniforms.uProg.value = t;
        p.cur.x = x0 + Math.sin(t * 40) * 2.5 * (1 - t);
        p.cur.rz = Math.sin(t * Math.PI) * -0.035;
      },
      ease.inOut,
    );
    p.cur.x = x0;
    void tween(
      520,
      (t) => {
        p.strip.position.set(-0.25 * t, 0.3 * t - 0.25 * t * t, 0.1 * t);
        p.strip.rotation.set(-1.3 * t, 0, 0.9 * t);
        strip.uniforms.uAlpha.value = 1 - t * t;
      },
      ease.linear,
    ).then(() => (p.strip.visible = false));
    await wait(160);
  }

  /** The empty wrapper slides away to the left, and a fresh pack joins the shelf. */
  dismiss() {
    const p = this.center;
    if (!p) return;
    this.center = null;
    const from = { ...p.cur };
    audio.whoosh(0.45);
    void tween(
      600,
      (t) => {
        p.cur.x = lerp(from.x, -from.s * 0.5, t);
        p.cur.y = from.y + t * from.s * 0.12;
        p.cur.rz = t * 0.5;
        p.cur.ry = t * -0.6;
      },
      ease.in,
    ).then(() => {
      this.scene.remove(p.group);
      this.packs.splice(this.packs.indexOf(p), 1);
      p.dispose();
    });
    // A new pack takes the opened one's place in the fan, underneath the rest.
    this.spawn(p.fan);
  }

  // ---- drawing --------------------------------------------------------------

  private frame(now: number) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const time = now / 1000;
    for (const p of this.packs) {
      if (!p.manual) {
        const k = 1 - Math.exp(-dt * p.speed);
        for (const key of Object.keys(p.cur) as (keyof Pose)[]) p.cur[key] = lerp(p.cur[key], p.tgt[key], k);
      }
      // Only the pack in the middle sways, so its foil keeps catching the light; the pile lies still.
      const sway = !p.manual && p.where === 'center' ? 1 : 0;
      // `cur` is in screen pixels. Nearer packs would look bigger, so shrink them back by their depth.
      const f = (this.camera.position.z - p.cur.z) / this.camera.position.z;
      p.group.position.set((p.cur.x - this.vw / 2) * f, (this.vh / 2 - p.cur.y - Math.sin(time * 1.4 + p.phase) * 6 * sway) * f, p.cur.z);
      p.group.rotation.set(p.cur.rx + Math.sin(time * 0.9 + p.phase) * 0.045 * sway, p.cur.ry + Math.sin(time * 0.7 + p.phase * 2) * 0.14 * sway, -p.cur.rz);
      p.group.scale.setScalar(p.cur.s * f);
      for (const m of p.mats) m.uniforms.uTime.value = time;
    }
    requestAnimationFrame((t) => this.frame(t));

    // Drawing the pack layer is the expensive part, so it is only done when there is something to see.
    // Nothing is drawn while the binder or the close-up view covers the packs (the last picture stays
    // put underneath), nor while every pack is off the side of the screen.
    const covered = document.body.classList.contains('binder-open') || document.body.classList.contains('zooming');
    const onScreen = this.packs.some((p) => p.cur.x - p.cur.s < this.vw && p.cur.x + p.cur.s > 0);
    if (covered || !onScreen) return;
    // Packs being moved, spun or torn, and the one waiting in the middle, are drawn every frame.
    // A shelf of packs lying still only has the slow drift of light on the foil to show, and
    // is redrawn IDLE_FPS times a second.
    const busy =
      this.drag !== null ||
      this.center !== null ||
      this.packs.some((p) => p.manual || Math.abs(p.cur.x - p.tgt.x) + Math.abs(p.cur.y - p.tgt.y) + Math.abs(p.cur.s - p.tgt.s) > 0.5);
    if (!busy && now - this.lastDraw < 1000 / IDLE_FPS - 2) return;
    this.lastDraw = now;
    this.renderer.render(this.scene, this.camera);
  }
}
