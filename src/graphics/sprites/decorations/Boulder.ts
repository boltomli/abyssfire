// src/graphics/sprites/decorations/Boulder.ts
import { defineDecor, contactShadow, glow, line, tuft, rgbaHex } from './DecorKit';
import { drawRock } from './Rock';

function boulder(key: string, col: number, opts: { snow?: boolean; lava?: boolean; moss?: [string, string] } = {}) {
  return defineDecor({
    key,
    w: 76,
    h: 62,
    ground: 56,
    tall: true,
    draw(ctx, { cx, gy, r }) {
      contactShadow(ctx, cx + 5, gy, 34, 10, 0.45);
      drawRock(ctx, cx - 4, gy, 50, 44, col, r, 2);
      drawRock(ctx, cx + 20, gy + 2, 24, 18, col, r, 1);
      if (opts.snow) {
        ctx.beginPath();
        ctx.moveTo(cx - 24, gy - 30);
        ctx.quadraticCurveTo(cx - 14, gy - 48, cx + 4, gy - 44);
        ctx.quadraticCurveTo(cx + 14, gy - 40, cx + 16, gy - 32);
        ctx.quadraticCurveTo(cx + 6, gy - 36, cx - 4, gy - 32);
        ctx.quadraticCurveTo(cx - 14, gy - 34, cx - 24, gy - 30);
        ctx.fillStyle = '#eef4fb';
        ctx.fill();
        ctx.strokeStyle = '#8fa2bd';
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }
      if (opts.lava) {
        glow(ctx, { x: cx - 2, y: gy - 16 }, 16, 0xff3a2a, 0.45);
        line(ctx, [[cx - 12, gy - 32], [cx - 6, gy - 22], [cx - 9, gy - 12], [cx - 2, gy - 3]], rgbaHex(0xff5a3a, 1), 1.6);
        line(ctx, [[cx - 12, gy - 32], [cx - 6, gy - 22], [cx - 9, gy - 12], [cx - 2, gy - 3]], '#ffd0a0', 0.6);
      }
      if (opts.moss) tuft(ctx, cx - 22, gy + 2, 9, 5, opts.moss[0], opts.moss[1], r);
    },
  });
}

export const BoulderDrawer = boulder('decor_boulder', 0x8e919c, { moss: ['#4f8a3a', '#8cc24f'] });
export const BoulderSnowDrawer = boulder('decor_boulder_snow', 0x6f7f96, { snow: true });
export const BoulderSandDrawer = boulder('decor_boulder_sand', 0xc79a62);
export const BoulderBasaltDrawer = boulder('decor_boulder_basalt', 0x3e3446, { lava: true });
