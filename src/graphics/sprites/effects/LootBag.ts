// src/graphics/sprites/effects/LootBag.ts
// Drawn in light, low-saturation tones: ZoneScene tints the bag by item
// quality (setTint multiplies), so the base must stay bright to carry colour.
import { defineDecor, contactShadow, shade, tone, blobP, line, flat, ellipseP, glow } from '../decorations/DecorKit';

export const LootBagDrawer = defineDecor({
  key: 'loot_bag',
  w: 28,
  h: 28,
  ground: 23,
  draw(ctx, { cx, gy }) {
    contactShadow(ctx, cx + 1, gy, 10, 3, 0.45);
    const cloth = tone(0xe8dcc4, { light: 0.45, shadow: 0.38 });
    shade(ctx, blobP(ctx, [[cx - 9, gy - 1], [cx - 11, gy - 9], [cx - 5, gy - 15], [cx - 2, gy - 14], [cx + 2, gy - 14], [cx + 6, gy - 15], [cx + 11, gy - 8], [cx + 9, gy - 1], [cx, gy + 1]]), cloth, { band: 3.5, hi: 1.2, stroke: 0.8 });
    // Gathered neck + tie.
    shade(ctx, blobP(ctx, [[cx - 4, gy - 14], [cx - 5, gy - 20], [cx - 1, gy - 18], [cx + 1, gy - 21], [cx + 5, gy - 19], [cx + 4, gy - 14]]), cloth, { band: 1.5, hi: 0.6, stroke: 0.7 });
    line(ctx, [[cx - 4.5, gy - 14.5], [cx + 4.5, gy - 14.5]], '#8a6a44', 1.6);
    line(ctx, [[cx + 3, gy - 14.5], [cx + 6, gy - 11]], '#8a6a44', 1);
    // Folds.
    line(ctx, [[cx - 4, gy - 11], [cx - 6, gy - 5]], cloth.shade, 0.7);
    line(ctx, [[cx + 2, gy - 12], [cx + 3, gy - 6]], cloth.shade, 0.7);
    // Coin peeking out + sparkle.
    flat(ctx, ellipseP(ctx, cx - 1, gy - 19, 2, 1.2), '#fff0b0', '#8a6a20', 0.4);
    glow(ctx, { x: cx - 5, y: gy - 12 }, 4, 0xffffff, 0.6);
  },
});
