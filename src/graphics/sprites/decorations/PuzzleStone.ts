// src/graphics/sprites/decorations/PuzzleStone.ts
// Placed centred at y-30 in ZoneScene: ground line at h/2 + 30.
import { defineDecor, contactShadow, glow, line, flat, ellipseP } from './DecorKit';
import { block } from './Stonework';

export const PuzzleStoneDrawer = defineDecor({
  key: 'decor_puzzle_stone',
  w: 56,
  h: 72,
  ground: 66,
  draw(ctx, { cx, gy, r }) {
    contactShadow(ctx, cx + 3, gy, 22, 6, 0.42);
    block(ctx, cx - 16, gy, 30, 8, 7, 0x6a6878, r, false);
    block(ctx, cx - 10, gy - 8, 18, 34, 7, 0x7e7c8e, r);
    glow(ctx, { x: cx - 1, y: gy - 26 }, 16, 0xb07aff, 0.5);
    const rune: [number, number][] = [[cx - 5, gy - 34], [cx + 3, gy - 30], [cx - 4, gy - 24], [cx + 3, gy - 18]];
    line(ctx, rune, '#8a4aff', 2);
    line(ctx, rune, '#f0dcff', 0.7);
    flat(ctx, ellipseP(ctx, cx - 1, gy - 48, 3, 3), '#d8b8ff', '#6a3ab8', 0.5);
    glow(ctx, { x: cx - 1, y: gy - 48 }, 8, 0xd8b8ff, 0.6);
  },
});
