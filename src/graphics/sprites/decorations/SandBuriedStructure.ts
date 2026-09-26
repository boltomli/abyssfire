// src/graphics/sprites/decorations/SandBuriedStructure.ts
import { defineDecor, contactShadow, shade, tone, polyP, line, glow, flat, ellipseP } from './DecorKit';
import { block, courses } from './Stonework';

/** The top of a sun-bleached sandstone temple poking out of a dune. */
export const SandBuriedStructureDrawer = defineDecor({
  key: 'decor_sand_buried_structure',
  w: 124,
  h: 96,
  ground: 86,
  tall: true,
  draw(ctx, { cx, gy, r }) {
    const stone = 0xd8b27a;
    contactShadow(ctx, cx + 6, gy, 56, 12, 0.35);
    // Obelisk tip.
    const t = tone(stone, { shadow: 0.4, light: 0.35 });
    shade(ctx, polyP(ctx, [[cx + 22, gy - 10], [cx + 25, gy - 68], [cx + 30, gy - 76], [cx + 35, gy - 68], [cx + 38, gy - 10]]), t, { band: 5, hi: 1.2 });
    for (let i = 0; i < 4; i++) line(ctx, [[cx + 27, gy - 58 + i * 11], [cx + 33, gy - 58 + i * 11]], t.shade, 0.8);
    // Doorway lintel block.
    block(ctx, cx - 40, gy - 6, 50, 34, 10, stone, r);
    courses(ctx, cx - 40, gy - 6, 50, 34, 11, stone, r);
    shade(ctx, polyP(ctx, [[cx - 24, gy - 6], [cx - 24, gy - 26], [cx - 6, gy - 26], [cx - 6, gy - 6]]), tone(0x3a2a30), { band: 4, hi: 0, stroke: 0.6 });
    // Turquoise inlay (zone accent).
    flat(ctx, polyP(ctx, [[cx - 18, gy - 34], [cx - 15, gy - 37], [cx - 12, gy - 34], [cx - 15, gy - 31]]), '#3fd0c8', '#1a6a70', 0.5);
    glow(ctx, { x: cx - 15, y: gy - 34 }, 6, 0x3fd0c8, 0.5);
    // Dune burying the base.
    const sand = tone(0xe8c48a, { shadow: 0.25, light: 0.3 });
    shade(ctx, () => {
      ctx.moveTo(cx - 58, gy + 4);
      ctx.quadraticCurveTo(cx - 40, gy - 14, cx - 16, gy - 8);
      ctx.quadraticCurveTo(cx + 10, gy - 2, cx + 30, gy - 14);
      ctx.quadraticCurveTo(cx + 48, gy - 18, cx + 60, gy + 4);
      ctx.quadraticCurveTo(cx, gy + 10, cx - 58, gy + 4);
      ctx.closePath();
    }, sand, { band: 4, hi: 1.2, stroke: 0.6 });
    for (const [x, y] of [[-36, -4], [-4, 0], [30, -6]] as const) {
      ctx.beginPath();
      ctx.moveTo(cx + x - 8, gy + y);
      ctx.quadraticCurveTo(cx + x, gy + y - 2, cx + x + 8, gy + y);
      ctx.strokeStyle = sand.shade;
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }
    flat(ctx, ellipseP(ctx, cx + 48, gy + 2, 3, 1.4), '#c8a070');
  },
});
