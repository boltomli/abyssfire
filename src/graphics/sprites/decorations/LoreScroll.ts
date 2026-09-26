// src/graphics/sprites/decorations/LoreScroll.ts
import { defineDecor, contactShadow, shade, tone, line, glow, ellipseP } from './DecorKit';

export const LoreScrollDrawer = defineDecor({
  key: 'decor_lore_scroll',
  w: 28,
  h: 28,
  ground: 26,
  draw(ctx, { cx, gy }) {
    contactShadow(ctx, cx + 1, gy, 10, 3, 0.4);
    glow(ctx, { x: cx, y: gy - 10 }, 12, 0xffe08a, 0.35);
    const paper = tone(0xf0dcaa, { light: 0.4 });
    const rod = tone(0x8a4a2a);
    shade(ctx, () => ctx.rect(cx - 8, gy - 19, 16, 13), paper, { band: 2, hi: 0.8 });
    for (let i = 0; i < 3; i++) line(ctx, [[cx - 5, gy - 16 + i * 3.5], [cx + (i === 2 ? 1 : 5), gy - 16 + i * 3.5]], '#8a6a4a', 0.7);
    for (const y of [gy - 20, gy - 5]) {
      shade(ctx, ellipseP(ctx, cx, y, 10, 2.4), paper, { band: 1, hi: 0.5 });
      shade(ctx, ellipseP(ctx, cx - 10.5, y, 1.8, 2.2), rod, { band: 0.8, hi: 0 });
      shade(ctx, ellipseP(ctx, cx + 10.5, y, 1.8, 2.2), rod, { band: 0.8, hi: 0 });
    }
    line(ctx, [[cx - 1, gy - 12], [cx + 1, gy - 8], [cx - 1, gy - 4]], '#c83a2a', 1.4);
  },
});
