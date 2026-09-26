// src/graphics/sprites/decorations/BrokenAltar.ts
import { defineDecor, contactShadow, glow, line, flat, ellipseP } from './DecorKit';
import { block, courses } from './Stonework';
import { drawRock } from './Rock';

/** Cracked sacrificial altar with a smouldering rune. */
export const BrokenAltarDrawer = defineDecor({
  key: 'decor_broken_altar',
  w: 92,
  h: 72,
  ground: 64,
  tall: true,
  draw(ctx, { cx, gy, r }) {
    const stone = 0x6e6674;
    contactShadow(ctx, cx + 4, gy, 40, 11, 0.45);
    block(ctx, cx - 30, gy + 2, 56, 10, 10, 0x5e5864, r, false);
    block(ctx, cx - 22, gy - 8, 40, 22, 9, stone, r);
    courses(ctx, cx - 22, gy - 8, 40, 22, 11, stone, r);
    // Split slab on top.
    block(ctx, cx - 26, gy - 30, 22, 6, 9, 0x847c8a, r);
    block(ctx, cx - 1, gy - 29, 22, 6, 9, 0x847c8a, r);
    drawRock(ctx, cx + 30, gy + 4, 12, 7, stone, r, 0);
    drawRock(ctx, cx - 34, gy + 6, 9, 5, stone, r, 0);
    // Rune glow (focal).
    glow(ctx, { x: cx - 2, y: gy - 20 }, 16, 0xff5a3a, 0.45);
    line(ctx, [[cx - 8, gy - 24], [cx - 2, gy - 14], [cx + 4, gy - 24]], '#ff6a3a', 1.4);
    line(ctx, [[cx - 8, gy - 24], [cx - 2, gy - 14], [cx + 4, gy - 24]], '#ffd0a0', 0.5);
    flat(ctx, ellipseP(ctx, cx - 2, gy - 27, 1.4, 1.4), '#ffb070');
    // Blood/wax drips.
    line(ctx, [[cx + 12, gy - 30], [cx + 12, gy - 24]], '#8a2a2a', 1.2);
  },
});
