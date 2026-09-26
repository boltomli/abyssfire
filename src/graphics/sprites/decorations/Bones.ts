// src/graphics/sprites/decorations/Bones.ts
import { defineDecor, contactShadow, shade, tone, ellipseP, limbP, flat, polyP } from './DecorKit';

export function bone(ctx: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, w: number, col = 0xe6dcc0): void {
  const t = tone(col, { shadow: 0.35, light: 0.3 });
  shade(ctx, limbP(ctx, [ax, ay], [(ax + bx) / 2, (ay + by) / 2], [bx, by], w * 0.5, w * 0.5), t, { band: w * 0.4, hi: 0, stroke: 0.55 });
  for (const [x, y] of [[ax, ay], [bx, by]] as const) {
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len * w * 0.55, ny = dx / len * w * 0.55;
    shade(ctx, ellipseP(ctx, x + nx, y + ny, w * 0.62, w * 0.62), t, { band: w * 0.3, hi: 0, stroke: 0.5 });
    shade(ctx, ellipseP(ctx, x - nx, y - ny, w * 0.62, w * 0.62), t, { band: w * 0.3, hi: 0, stroke: 0.5 });
  }
}

export function skull(ctx: CanvasRenderingContext2D, x: number, gy: number, s: number, col = 0xe6dcc0): void {
  const t = tone(col, { shadow: 0.35, light: 0.3 });
  shade(ctx, () => {
    ctx.moveTo(x - 5 * s, gy - 3 * s);
    ctx.bezierCurveTo(x - 6.5 * s, gy - 12 * s, x + 6.5 * s, gy - 12 * s, x + 5 * s, gy - 3 * s);
    ctx.lineTo(x + 3 * s, gy - 2.5 * s);
    ctx.lineTo(x + 3 * s, gy);
    ctx.lineTo(x - 3 * s, gy);
    ctx.lineTo(x - 3 * s, gy - 2.5 * s);
    ctx.closePath();
  }, t, { band: 1.6 * s, hi: 0.6 * s, stroke: 0.6 });
  flat(ctx, ellipseP(ctx, x - 2.2 * s, gy - 5.5 * s, 1.5 * s, 1.7 * s), '#2a1e24');
  flat(ctx, ellipseP(ctx, x + 2.2 * s, gy - 5.5 * s, 1.5 * s, 1.7 * s), '#2a1e24');
  flat(ctx, polyP(ctx, [[x, gy - 4 * s], [x - 0.8 * s, gy - 2.6 * s], [x + 0.8 * s, gy - 2.6 * s]]), '#2a1e24');
}

/** Scattered bones + skull (flat ground litter). */
export const BonesDrawer = defineDecor({
  key: 'decor_bones',
  w: 44,
  h: 26,
  ground: 21,
  flat: true,
  draw(ctx, { cx, gy }) {
    contactShadow(ctx, cx, gy, 18, 4.5, 0.3);
    bone(ctx, cx - 16, gy - 1, cx - 2, gy - 5, 2.4);
    bone(ctx, cx + 2, gy + 1, cx + 16, gy - 2, 2.2);
    skull(ctx, cx + 3, gy - 3, 0.95);
  },
});
