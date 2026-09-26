// src/graphics/sprites/decorations/CollapsedPillar.ts
import { defineDecor, contactShadow, shade, tone, line, tuft } from './DecorKit';
import { block, column } from './Stonework';

/** A snapped column stump with its toppled drums lying beside it. */
export const CollapsedPillarDrawer = defineDecor({
  key: 'decor_collapsed_pillar',
  w: 112,
  h: 80,
  ground: 72,
  tall: true,
  draw(ctx, { cx, gy, r }) {
    const stone = 0xa09a8a;
    contactShadow(ctx, cx + 4, gy, 50, 12, 0.4);
    column(ctx, cx - 30, gy, 58, 16, stone, true, r);
    // Fallen drums (lying cylinders).
    const t = tone(stone, { shadow: 0.45, light: 0.38 });
    for (const [x, y, len] of [[cx - 4, gy + 2, 22], [cx + 22, gy + 5, 20]] as const) {
      shade(ctx, () => {
        ctx.moveTo(x, y - 14);
        ctx.lineTo(x + len, y - 14);
        ctx.ellipse(x + len, y - 7, 4, 7, 0, -Math.PI / 2, Math.PI / 2);
        ctx.lineTo(x, y);
        ctx.closePath();
      }, t, { band: 4, hi: 1, stroke: 0.7 });
      shade(ctx, () => ctx.ellipse(x, y - 7, 4, 7, 0, 0, Math.PI * 2), t, { band: 1.5, hi: 1.2, stroke: 0.7 });
      line(ctx, [[x + 3, y - 10], [x + len - 2, y - 10]], t.shade, 0.6);
      line(ctx, [[x + 3, y - 4], [x + len - 2, y - 4]], t.shade, 0.6);
    }
    block(ctx, cx + 36, gy + 1, 12, 7, 5, stone, r);
    tuft(ctx, cx - 18, gy + 4, 9, 5, '#6a7a4a', '#a8b870', r);
  },
});
