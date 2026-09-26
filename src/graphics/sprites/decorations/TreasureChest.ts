// src/graphics/sprites/decorations/TreasureChest.ts
// Placed centred at y-12 in ZoneScene, so the ground line sits at h/2 + 12.
import { defineDecor, contactShadow, shade, tone, polyP, line, glow, flat, ellipseP } from './DecorKit';

export const TreasureChestDrawer = defineDecor({
  key: 'decor_treasure_chest',
  w: 40,
  h: 32,
  ground: 28,
  draw(ctx, { cx, gy }) {
    contactShadow(ctx, cx + 2, gy, 17, 4.5, 0.45);
    const wood = tone(0x9a5a2e, { light: 0.35 });
    const iron = tone(0xd8a83a, { light: 0.45 });
    const x0 = cx - 14, x1 = cx + 10, d = 5;
    // Side face.
    flat(ctx, polyP(ctx, [[x1, gy], [x1, gy - 13], [x1 + d, gy - 16], [x1 + d, gy - 3]]), wood.shade, wood.line, 0.6);
    // Front.
    shade(ctx, polyP(ctx, [[x0, gy], [x0, gy - 13], [x1, gy - 13], [x1, gy]]), wood, { band: 2.5, hi: 0.8 });
    line(ctx, [[x0 + 1, gy - 7], [x1 - 1, gy - 7]], wood.shade, 0.6);
    // Domed lid.
    shade(ctx, () => {
      ctx.moveTo(x0, gy - 13);
      ctx.bezierCurveTo(x0, gy - 22, x1, gy - 22, x1, gy - 13);
      ctx.closePath();
    }, wood, { band: 2.5, hi: 1 });
    flat(ctx, () => {
      ctx.moveTo(x1, gy - 13);
      ctx.bezierCurveTo(x1, gy - 22, x1 + d, gy - 24, x1 + d, gy - 16);
      ctx.closePath();
    }, wood.shade, wood.line, 0.6);
    // Gold bands + lock (focal accent).
    for (const bx of [x0 + 3, x1 - 5]) {
      shade(ctx, () => {
        ctx.moveTo(bx, gy);
        ctx.lineTo(bx, gy - 13);
        ctx.bezierCurveTo(bx, gy - 20, bx + 2, gy - 20.5, bx + 2, gy - 20.5);
        ctx.lineTo(bx + 2, gy);
        ctx.closePath();
      }, iron, { band: 0.8, hi: 0.4, stroke: 0.5 });
    }
    line(ctx, [[x0, gy - 13], [x1, gy - 13]], iron.base, 1.6);
    shade(ctx, polyP(ctx, [[cx - 4.5, gy - 15], [cx + 0.5, gy - 15], [cx + 0.5, gy - 9], [cx - 2, gy - 7.5], [cx - 4.5, gy - 9]]), iron, { band: 1, hi: 0.5, stroke: 0.5 });
    flat(ctx, ellipseP(ctx, cx - 2, gy - 11.5, 0.8, 1.1), '#3a2410');
    glow(ctx, { x: cx - 8, y: gy - 18 }, 4, 0xfff0a0, 0.6);
  },
});
