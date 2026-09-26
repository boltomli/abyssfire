// src/graphics/sprites/decorations/Flower.ts
import { defineDecor, contactShadow, tuft, shade, tone, ellipseP, flat } from './DecorKit';

/** Emerald Plains — a small patch of wildflowers (flat ground cover). */
export const FlowerDrawer = defineDecor({
  key: 'decor_flower',
  w: 40,
  h: 28,
  ground: 24,
  flat: true,
  draw(ctx, { cx, gy, r }) {
    contactShadow(ctx, cx, gy, 15, 4, 0.22);
    tuft(ctx, cx - 5, gy, 10, 5, '#3f7a33', '#7fb84a', r);
    tuft(ctx, cx + 8, gy + 1, 8, 4, '#3f7a33', '#7fb84a', r);
    const blooms: [number, number, number][] = [
      [-9, -11, 0xf2d24a], [-2, -14, 0xffffff], [6, -10, 0xe86a8a], [12, -7, 0xf2d24a], [-13, -6, 0xb48cff], [2, -6, 0xffffff],
    ];
    for (const [bx, by, col] of blooms) {
      const x = cx + bx, y = gy + by;
      const t = tone(col, { light: 0.3 });
      ctx.strokeStyle = '#3f7a33';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (r() - 0.5) * 2, gy);
      ctx.stroke();
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        shade(ctx, ellipseP(ctx, x + Math.cos(a) * 1.7, y + Math.sin(a) * 1.3, 1.5, 1.2, a), t, { band: 0.5, hi: 0, stroke: 0.35 });
      }
      flat(ctx, ellipseP(ctx, x, y, 1, 0.9), '#f4a93a');
    }
  },
});
