// src/graphics/sprites/decorations/FrozenCorpse.ts
import { defineDecor, contactShadow, shade, tone, shard, polyP, line, glow } from './DecorKit';
import { skull } from './Bones';

/** An unlucky climber sealed in a jagged block of blue ice. */
export const FrozenCorpseDrawer = defineDecor({
  key: 'decor_frozen_corpse',
  w: 84,
  h: 76,
  ground: 68,
  tall: true,
  draw(ctx, { cx, gy }) {
    contactShadow(ctx, cx + 4, gy, 34, 9, 0.4);
    // Figure inside (drawn first, then translucent ice over it).
    const coat = tone(0x6a4a3a);
    shade(ctx, polyP(ctx, [[cx - 8, gy - 4], [cx - 10, gy - 34], [cx + 6, gy - 36], [cx + 9, gy - 4]]), coat, { band: 3, hi: 0 });
    skull(ctx, cx - 1, gy - 36, 1.2, 0xd8d0c0);
    line(ctx, [[cx + 6, gy - 30], [cx + 16, gy - 44]], coat.base, 3);
    // Ice block.
    const ice = tone(0x9fd8f0, { light: 0.5, shadow: 0.3 });
    ctx.save();
    ctx.globalAlpha = 0.62;
    shade(ctx, polyP(ctx, [[cx - 22, gy + 2], [cx - 26, gy - 30], [cx - 14, gy - 52], [cx + 4, gy - 58], [cx + 22, gy - 44], [cx + 26, gy - 12], [cx + 18, gy + 3]]), ice, { band: 7, hi: 2, stroke: 0 });
    ctx.restore();
    ctx.beginPath();
    polyP(ctx, [[cx - 22, gy + 2], [cx - 26, gy - 30], [cx - 14, gy - 52], [cx + 4, gy - 58], [cx + 22, gy - 44], [cx + 26, gy - 12], [cx + 18, gy + 3]])();
    ctx.strokeStyle = '#4a86a8';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    line(ctx, [[cx - 18, gy - 30], [cx - 10, gy - 48]], 'rgba(255,255,255,0.8)', 1.4);
    line(ctx, [[cx - 20, gy - 12], [cx - 17, gy - 24]], 'rgba(255,255,255,0.6)', 1);
    shard(ctx, cx + 24, gy + 3, 22, 8, 4, 0x8fd0f0);
    shard(ctx, cx - 28, gy + 4, 16, 7, -3, 0x8fd0f0);
    glow(ctx, { x: cx - 4, y: gy - 30 }, 22, 0xbff0ff, 0.2);
  },
});
