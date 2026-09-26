// src/graphics/sprites/decorations/WarBanner.ts
import { defineDecor, contactShadow, shade, tone, polyP, line, ellipseP, limbP } from './DecorKit';
import { skull } from './Bones';

/** Goblin war totem: crooked pole, tattered red banner, skull and bones. */
export const WarBannerDrawer = defineDecor({
  key: 'decor_war_banner',
  w: 64,
  h: 116,
  ground: 110,
  tall: true,
  draw(ctx, { cx, gy, r }) {
    contactShadow(ctx, cx + 4, gy, 20, 6, 0.42);
    const wood = tone(0x7a5238, { light: 0.3 });
    shade(ctx, limbP(ctx, [cx, gy + 1], [cx - 1, gy - 50], [cx + 2, gy - 102], 3.2, 2.2), wood, { band: 2, hi: 0.6 });
    shade(ctx, limbP(ctx, [cx - 16, gy - 92], [cx, gy - 94], [cx + 18, gy - 90], 1.8, 1.6), wood, { band: 1.2, hi: 0 });
    // Tattered banner.
    const cloth = tone(0xb8322e, { light: 0.35 });
    const pts: [number, number][] = [[cx - 15, gy - 91], [cx + 17, gy - 89], [cx + 15, gy - 50], [cx + 9, gy - 56], [cx + 4, gy - 46], [cx - 2, gy - 55], [cx - 8, gy - 47], [cx - 13, gy - 57]];
    shade(ctx, polyP(ctx, pts), cloth, { band: 4, hi: 1 });
    // Crude emblem.
    const paint = '#f0d8a0';
    line(ctx, [[cx - 6, gy - 80], [cx + 1, gy - 68], [cx + 8, gy - 80]], paint, 1.6);
    line(ctx, [[cx + 1, gy - 68], [cx + 1, gy - 60]], paint, 1.6);
    skull(ctx, cx + 2, gy - 98, 1.1);
    // Lashings + hanging bones.
    for (const y of [gy - 36, gy - 40]) line(ctx, [[cx - 3, y], [cx + 3, y + 1]], '#c8a870', 0.9);
    line(ctx, [[cx - 14, gy - 91], [cx - 16, gy - 80]], '#c8a870', 0.6);
    shade(ctx, ellipseP(ctx, cx - 16, gy - 78, 1.6, 2.4), tone(0xe6dcc0), { band: 0.8, hi: 0, stroke: 0.5 });
    // Stones at the base.
    for (const [x, rr] of [[-6, 4], [5, 3.5], [0, 3]] as const) {
      shade(ctx, ellipseP(ctx, cx + x, gy - 1, rr, rr * 0.7), tone(0x8a8e98), { band: 1.2, hi: 0.5, stroke: 0.5 });
    }
    void r;
  },
});
