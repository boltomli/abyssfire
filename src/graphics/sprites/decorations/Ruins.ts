// src/graphics/sprites/decorations/Ruins.ts
import { defineDecor, contactShadow, tuft } from './DecorKit';
import { block, courses, ivy, column } from './Stonework';
import { drawRock } from './Rock';

/** Broken elven wall with a standing arch pier — landmark scale. */
export const RuinsDrawer = defineDecor({
  key: 'decor_ruins',
  w: 124,
  h: 118,
  ground: 110,
  tall: true,
  draw(ctx, { cx, gy, r }) {
    const stone = 0x9a9486;
    contactShadow(ctx, cx + 6, gy, 56, 14, 0.42);
    // Back wall stub.
    block(ctx, cx - 48, gy - 4, 38, 42, 10, stone, r);
    courses(ctx, cx - 48, gy - 4, 38, 42, 9, stone, r);
    // Tall pier with arch spring.
    block(ctx, cx - 8, gy, 22, 88, 10, stone, r);
    courses(ctx, cx - 8, gy, 22, 88, 11, stone, r);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx + 14, gy - 88);
    ctx.quadraticCurveTo(cx + 34, gy - 92, cx + 42, gy - 74);
    ctx.lineTo(cx + 36, gy - 70);
    ctx.quadraticCurveTo(cx + 28, gy - 80, cx + 14, gy - 76);
    ctx.closePath();
    ctx.fillStyle = '#a8a292';
    ctx.fill();
    ctx.strokeStyle = '#4a4540';
    ctx.lineWidth = 0.7;
    ctx.stroke();
    ctx.restore();
    // Low front wall + fallen blocks.
    column(ctx, cx + 38, gy + 2, 40, 11, stone, true, r);
    block(ctx, cx - 30, gy + 4, 18, 10, 7, stone, r);
    block(ctx, cx + 16, gy + 6, 12, 8, 6, stone, r);
    drawRock(ctx, cx - 50, gy + 6, 12, 6, stone, r, 0);
    ivy(ctx, cx - 4, gy - 84, 12, 0x4f8a3a, r);
    ivy(ctx, cx - 40, gy - 44, 7, 0x4f8a3a, r);
    tuft(ctx, cx - 12, gy + 5, 10, 6, '#3f7a33', '#8cc24f', r);
    tuft(ctx, cx + 30, gy + 6, 8, 5, '#3f7a33', '#8cc24f', r);
  },
});
