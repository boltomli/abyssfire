// src/graphics/sprites/decorations/GoldPile.ts
import { defineDecor, contactShadow, shade, tone, ellipseP, glow } from './DecorKit';

export const GoldPileDrawer = defineDecor({
  key: 'decor_gold_pile',
  w: 32,
  h: 24,
  ground: 23,
  draw(ctx, { cx, gy, r }) {
    contactShadow(ctx, cx + 1, gy, 13, 3.5, 0.4);
    const gold = tone(0xf0b83a, { light: 0.5, shadow: 0.35 });
    shade(ctx, () => {
      ctx.moveTo(cx - 12, gy);
      ctx.quadraticCurveTo(cx - 6, gy - 11, cx, gy - 11);
      ctx.quadraticCurveTo(cx + 7, gy - 11, cx + 12, gy);
      ctx.closePath();
    }, gold, { band: 3, hi: 1 });
    for (let i = 0; i < 9; i++) {
      const x = cx + (r() - 0.5) * 18;
      const y = gy - 2 - r() * 7 * (1 - Math.abs(x - cx) / 12);
      shade(ctx, ellipseP(ctx, x, y, 2.4, 1.3), gold, { band: 0.6, hi: 0.4, stroke: 0.45 });
    }
    shade(ctx, ellipseP(ctx, cx + 11, gy - 1, 2.4, 1.3), gold, { band: 0.6, hi: 0.4, stroke: 0.45 });
    glow(ctx, { x: cx - 3, y: gy - 9 }, 5, 0xfff4b0, 0.7);
  },
});
