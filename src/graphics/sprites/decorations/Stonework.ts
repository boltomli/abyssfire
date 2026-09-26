// src/graphics/sprites/decorations/Stonework.ts
// Shared masonry helpers for ruins, pillars, altars and statues.
import { shade, tone, polyP, line, flat, type Rand } from './DecorKit';

/**
 * A 2.5D stone block: front face (x..x+w, top..bottom), a lit top face
 * receding `d` px up-right, and a shaded side face.
 */
export function block(ctx: CanvasRenderingContext2D, x: number, bottom: number, w: number, h: number, d: number, col: number, r?: Rand, chip = true): void {
  const t = tone(col, { shadow: 0.45, light: 0.38 });
  const top = bottom - h;
  const dx = d * 0.9;
  const dy = d * 0.5;
  // Side (right).
  flat(ctx, polyP(ctx, [[x + w, bottom], [x + w, top], [x + w + dx, top - dy], [x + w + dx, bottom - dy]]), t.shade, t.line, 0.6);
  // Top.
  const cut = chip && r ? r() * w * 0.25 : 0;
  flat(ctx, polyP(ctx, [[x, top], [x + dx, top - dy], [x + w + dx, top - dy], [x + w, top], [x + w - cut, top + (cut ? 1.5 : 0)]]), t.light, t.line, 0.6);
  // Front.
  shade(ctx, polyP(ctx, [[x, bottom], [x, top], [x + w - cut, top + (cut ? 1.5 : 0)], [x + w, top + (cut ? 3 : 0)], [x + w, bottom]]), t, { band: Math.min(3, w * 0.12), hi: 0.8, stroke: 0.7 });
}

/** Masonry courses scratched into a front face. */
export function courses(ctx: CanvasRenderingContext2D, x: number, bottom: number, w: number, h: number, rowH: number, col: number, r: Rand): void {
  const t = tone(col);
  let row = 0;
  for (let y = bottom - rowH; y > bottom - h + 2; y -= rowH, row++) {
    line(ctx, [[x + 1, y], [x + w - 1, y]], t.shade, 0.6);
    const off = row % 2 ? w * 0.33 : w * 0.66;
    const jx = x + off + (r() - 0.5) * 3;
    line(ctx, [[jx, y], [jx, y + rowH]], t.shade, 0.6);
  }
}

/** Ivy / moss drip on stonework. */
export function ivy(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, col: number, r: Rand): void {
  const t = tone(col);
  let px = x;
  let py = y;
  for (let i = 0; i < len; i++) {
    const nx = px + (r() - 0.5) * 3;
    const ny = py + 3;
    line(ctx, [[px, py], [nx, ny]], t.shade, 0.7);
    flat(ctx, () => ctx.ellipse(nx + (i % 2 ? 1.5 : -1.5), ny - 1, 1.8, 1.2, i % 2 ? 0.5 : -0.5, 0, Math.PI * 2), i % 3 ? t.base : t.light, t.line, 0.35);
    px = nx;
    py = ny;
  }
}

/** A standing column with capital and base (cel shaded cylinder). */
export function column(ctx: CanvasRenderingContext2D, x: number, bottom: number, h: number, w: number, col: number, broken: boolean, r: Rand): void {
  const t = tone(col, { shadow: 0.45, light: 0.38 });
  const top = bottom - h;
  // Base.
  block(ctx, x - w * 0.7, bottom, w * 1.4, 5, 4, col, r, false);
  const bodyTop = broken ? top + 4 : top + 5;
  const path = () => {
    ctx.moveTo(x - w / 2, bottom - 5);
    ctx.lineTo(x - w / 2 + 0.6, bodyTop);
    if (broken) {
      ctx.lineTo(x - w * 0.2, bodyTop - 5);
      ctx.lineTo(x, bodyTop - 1);
      ctx.lineTo(x + w * 0.2, bodyTop - 7);
    }
    ctx.lineTo(x + w / 2 - 0.6, bodyTop + (broken ? 2 : 0));
    ctx.lineTo(x + w / 2, bottom - 5);
    ctx.closePath();
  };
  shade(ctx, path, t, { band: w * 0.35, hi: 1.2, stroke: 0.7 });
  // Flutes.
  for (const f of [-0.2, 0.1]) line(ctx, [[x + w * f, bottom - 7], [x + w * f, bodyTop + 4]], t.shade, 0.6);
  if (!broken) block(ctx, x - w * 0.65, top + 5, w * 1.3, 5, 4, col, r, false);
}
