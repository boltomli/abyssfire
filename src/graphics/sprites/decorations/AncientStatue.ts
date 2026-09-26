// src/graphics/sprites/decorations/AncientStatue.ts
import { defineDecor, contactShadow, shade, tone, ellipseP, limbP, line, glow, polyP } from './DecorKit';
import { block, ivy } from './Stonework';

/** Weathered robed guardian on a plinth, holding a sword — ~1.9× player. */
export const AncientStatueDrawer = defineDecor({
  key: 'decor_ancient_statue',
  w: 80,
  h: 140,
  ground: 134,
  tall: true,
  draw(ctx, { cx, gy, r }) {
    const stone = 0x8e98a0;
    const t = tone(stone, { shadow: 0.45, light: 0.4 });
    contactShadow(ctx, cx + 6, gy, 32, 9, 0.45);
    block(ctx, cx - 22, gy, 40, 18, 10, 0x7e8490, r);
    const base = gy - 18;
    // Robe.
    shade(ctx, polyP(ctx, [[cx - 14, base], [cx - 10, base - 58], [cx + 10, base - 58], [cx + 15, base]]), t, { band: 7, hi: 1.4 });
    for (const f of [-5, 1, 7]) line(ctx, [[cx + f * 0.8, base - 50], [cx + f, base - 2]], t.shade, 0.7);
    // Shoulders + head.
    shade(ctx, ellipseP(ctx, cx, base - 60, 13, 7), t, { band: 3, hi: 1 });
    shade(ctx, ellipseP(ctx, cx, base - 73, 6.5, 7.5), t, { band: 3, hi: 1 });
    // Hood.
    shade(ctx, () => {
      ctx.moveTo(cx - 8, base - 66);
      ctx.quadraticCurveTo(cx - 9, base - 84, cx, base - 84);
      ctx.quadraticCurveTo(cx + 9, base - 84, cx + 8, base - 66);
      ctx.quadraticCurveTo(cx, base - 72, cx - 8, base - 66);
      ctx.closePath();
    }, t, { band: 3, hi: 1 });
    // Sword held point-down in front.
    const blade = tone(0xa8b0b8, { light: 0.45 });
    shade(ctx, polyP(ctx, [[cx - 2, base - 44], [cx + 2, base - 44], [cx + 1.5, base - 6], [cx, base - 2], [cx - 1.5, base - 6]]), blade, { band: 1.2, hi: 0.6 });
    shade(ctx, polyP(ctx, [[cx - 8, base - 46], [cx + 8, base - 46], [cx + 8, base - 43], [cx - 8, base - 43]]), t, { band: 1, hi: 0.5 });
    shade(ctx, limbP(ctx, [cx - 9, base - 58], [cx - 8, base - 52], [cx - 2, base - 49], 3.5, 3), t, { band: 2, hi: 0 });
    shade(ctx, limbP(ctx, [cx + 9, base - 58], [cx + 8, base - 52], [cx + 2, base - 49], 3.5, 3), t, { band: 2, hi: 0 });
    shade(ctx, polyP(ctx, [[cx - 1.5, base - 58], [cx + 1.5, base - 58], [cx + 1.5, base - 46], [cx - 1.5, base - 46]]), t, { band: 0.8, hi: 0 });
    // Faintly glowing eyes (focal).
    glow(ctx, { x: cx, y: base - 73 }, 7, 0x7fe0ff, 0.5);
    ctx.fillStyle = '#c8f6ff';
    ctx.fillRect(cx - 3, base - 74, 1.6, 1);
    ctx.fillRect(cx + 1.4, base - 74, 1.6, 1);
    // Cracks + moss.
    line(ctx, [[cx + 6, base - 40], [cx + 3, base - 32], [cx + 7, base - 24]], t.line, 0.6);
    ivy(ctx, cx + 11, base - 58, 8, 0x4f8a3a, r);
  },
});
