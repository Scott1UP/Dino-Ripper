export const ease = {
  linear: (t: number) => t,
  out: (t: number) => 1 - (1 - t) ** 3,
  in: (t: number) => t * t * t,
  inOut: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
};

/** Calls `fn` every frame with eased progress from 0 to 1. */
export function tween(ms: number, fn: (t: number) => void, e: (t: number) => number = ease.out): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      fn(e(t));
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}

export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
