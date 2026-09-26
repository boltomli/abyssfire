// src/graphics/sprites/decorations/CharredTree.ts
import { defineDecor, contactShadow, trunk, shade, tone, limbP, glow, line } from './DecorKit';

/** Abyss Rift — charred, twisted tree with glowing ember cracks. */
export const CharredTreeDrawer = defineDecor({
  key: 'decor_charred_tree',
  w: 104,
  h: 156,
  ground: 150,
  tall: true,
  draw(ctx, { cx, gy, r }) {
    contactShadow(ctx, cx + 8, gy, 32, 10, 0.5);
    const bark = 0x3a2a3e;
    trunk(ctx, cx, gy, gy - 76, 20, 8, bark, r, -6);
    const t = tone(bark, { shadow: 0.45, light: 0.25 });
    const limbs: [number, number, number, number, number, number, number][] = [
      [cx - 5, gy - 60, cx - 22, gy - 70, cx - 36, gy - 98, 4],
      [cx - 6, gy - 74, cx + 12, gy - 88, cx + 30, gy - 112, 3.6],
      [cx - 6, gy - 74, cx - 8, gy - 110, cx - 2, gy - 140, 3.2],
      [cx - 28, gy - 86, cx - 40, gy - 92, cx - 46, gy - 88, 1.8],
      [cx + 20, gy - 98, cx + 34, gy - 100, cx + 40, gy - 92, 1.6],
      [cx - 4, gy - 118, cx + 8, gy - 124, cx + 14, gy - 132, 1.5],
    ];
    for (const [ax, ay, mx, my, bx, by, w] of limbs) {
      shade(ctx, limbP(ctx, [ax, ay], [mx, my], [bx, by], w, w * 0.3), t, { band: w * 0.8, hi: 0, stroke: 0.7 });
    }
    // Ember fissures (focal accent).
    const crack: [number, number][] = [[cx - 2, gy - 4], [cx + 2, gy - 18], [cx - 3, gy - 30], [cx - 1, gy - 44], [cx - 5, gy - 58]];
    glow(ctx, { x: cx - 1, y: gy - 28 }, 20, 0xff3a4a, 0.4);
    line(ctx, crack, '#ff3a4a', 2);
    line(ctx, crack, '#ffc080', 0.7);
    line(ctx, [[cx + 5, gy - 8], [cx + 7, gy - 16]], '#ff5a3a', 1.2);
    glow(ctx, { x: cx - 36, y: gy - 98 }, 6, 0xff5a3a, 0.6);
    glow(ctx, { x: cx + 30, y: gy - 112 }, 6, 0xff5a3a, 0.6);
  },
});
