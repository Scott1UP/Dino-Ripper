// Confetti and sparkles, drawn on a canvas above everything else.

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  color: string;
  life: number;
  ttl: number;
  shape: 'rect' | 'star' | 'coin';
  gravity: number;
}

const RAINBOW = ['#ff5f6d', '#ffb347', '#f9f871', '#5dfdcb', '#5cc8ff', '#b28dff', '#ffffff'];
const GOLD = ['#fff3b0', '#ffd84a', '#f5b700', '#c9971c', '#ffffff'];

const canvas = document.querySelector<HTMLCanvasElement>('#fx')!;
const g = canvas.getContext('2d')!;
const parts: Particle[] = [];
let running = false;
let last = 0;

function resize() {
  const dpr = Math.min(devicePixelRatio, 2);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resize();
addEventListener('resize', resize);

function star(size: number) {
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 ? size * 0.22 : size;
    g.lineTo(Math.cos((i * Math.PI) / 4) * r, Math.sin((i * Math.PI) / 4) * r);
  }
  g.closePath();
  g.fill();
}

function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  g.clearRect(0, 0, innerWidth, innerHeight);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life += dt;
    if (p.life > p.ttl || p.y > innerHeight + 60) {
      parts.splice(i, 1);
      continue;
    }
    p.vy += p.gravity * dt;
    p.vx *= 1 - 1.2 * dt;
    p.vy *= 1 - 0.6 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
    g.save();
    g.translate(p.x, p.y);
    g.globalAlpha = Math.min(1, (p.ttl - p.life) * 2.5);
    g.fillStyle = p.color;
    if (p.shape === 'star') {
      g.rotate(p.rot * 0.3);
      star(p.size * (0.6 + 0.4 * Math.sin(p.life * 12 + p.rot)));
    } else if (p.shape === 'coin') {
      g.scale(1, Math.cos(p.rot));
      g.beginPath();
      g.arc(0, 0, p.size * 0.6, 0, Math.PI * 2);
      g.fill();
    } else {
      g.rotate(p.rot);
      g.scale(1, Math.cos(p.life * 9 + p.rot));
      g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    }
    g.restore();
  }
  if (parts.length) requestAnimationFrame(frame);
  else running = false;
}

function start() {
  if (running) return;
  running = true;
  last = performance.now();
  requestAnimationFrame(frame);
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const from = <T>(list: T[]) => list[Math.floor(Math.random() * list.length)];

export const fx = {
  /** A small puff of twinkling stars. */
  sparkle(x: number, y: number, count: number, spread: number, gold = false) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = rand(0.3, 1) * spread;
      parts.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: Math.random() * 6, vr: rand(-3, 3),
        size: rand(5, 13), color: from(gold ? GOLD : RAINBOW), life: 0, ttl: rand(0.6, 1.3), shape: 'star', gravity: 0,
      });
    }
    start();
  },
  /** Confetti thrown outwards from a point. */
  burst(x: number, y: number, count: number, gold = false) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = rand(300, 1300);
      parts.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 350, rot: Math.random() * 6, vr: rand(-9, 9),
        size: rand(9, 18), color: from(gold ? GOLD : RAINBOW), life: 0, ttl: rand(1.8, 3.4),
        shape: gold && Math.random() < 0.5 ? 'coin' : Math.random() < 0.2 ? 'star' : 'rect', gravity: 900,
      });
    }
    start();
  },
  /** Confetti falling from the top of the screen for a while. */
  rain(ms: number, gold = false) {
    const end = performance.now() + ms;
    const drop = () => {
      for (let i = 0; i < 7; i++) {
        parts.push({
          x: rand(0, innerWidth), y: -20, vx: rand(-80, 80), vy: rand(150, 450), rot: Math.random() * 6, vr: rand(-8, 8),
          size: rand(9, 18), color: from(gold ? GOLD : RAINBOW), life: 0, ttl: 5,
          shape: gold && Math.random() < 0.6 ? 'coin' : 'rect', gravity: 320,
        });
      }
      start();
      if (performance.now() < end) setTimeout(drop, 60);
    };
    drop();
  },
};
