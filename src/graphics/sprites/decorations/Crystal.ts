// src/graphics/sprites/decorations/Crystal.ts
import { defineDecor, contactShadow, shard, glow, rgbaHex } from './DecorKit';
import { drawRock } from './Rock';

function crystal(key: string, col: number, glowCol: number, rockCol: number) {
  return defineDecor({
    key,
    w: 56,
    h: 72,
    ground: 66,
    tall: true,
    draw(ctx, { cx, gy, r }) {
      contactShadow(ctx, cx + 3, gy, 22, 7, 0.45);
      // Light spill on the ground.
      ctx.save();
      ctx.translate(cx, gy);
      ctx.scale(1, 0.35);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 28);
      g.addColorStop(0, rgbaHex(glowCol, 0.45));
      g.addColorStop(1, rgbaHex(glowCol, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      glow(ctx, { x: cx, y: gy - 30 }, 30, glowCol, 0.35);
      drawRock(ctx, cx - 4, gy + 1, 30, 9, rockCol, r, 0);
      shard(ctx, cx - 12, gy - 3, 26, 9, -5, col);
      shard(ctx, cx + 11, gy - 2, 30, 10, 5, col);
      shard(ctx, cx, gy - 4, 52, 13, 1, col);
      shard(ctx, cx + 4, gy, 14, 6, 3, col);
      glow(ctx, { x: cx + 1, y: gy - 46 }, 10, 0xffffff, 0.35);
    },
  });
}

export const CrystalDrawer = crystal('decor_crystal', 0xc04ae0, 0xff4ac8, 0x3e3446);
export const CrystalBlueDrawer = crystal('decor_crystal_blue', 0x3fb8e8, 0x6ff0ff, 0x4a5a70);
