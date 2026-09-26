// src/graphics/sprites/decorations/RitualCircle.ts
import { defineDecor, glow, line, flat, ellipseP, shade, tone, rgbaHex } from './DecorKit';

/** Glowing summoning circle etched into the ground, with candles and standing stones. */
export const RitualCircleDrawer = defineDecor({
  key: 'decor_ritual_circle',
  w: 112,
  h: 70,
  ground: 50,
  flat: true,
  draw(ctx, { cx, gy }) {
    const cy = gy - 6;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, 0.5);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 48);
    g.addColorStop(0, rgbaHex(0xb04aff, 0.35));
    g.addColorStop(1, rgbaHex(0xb04aff, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 48, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = 'rgba(40,10,50,0.6)';
    for (const rr of [40, 30]) { ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.stroke(); }
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = '#d88aff';
    for (const rr of [40, 30]) { ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.stroke(); }
    ctx.beginPath();
    for (let i = 0; i <= 5; i++) {
      const a = -Math.PI / 2 + i * (Math.PI * 4) / 5;
      const x = Math.cos(a) * 30, y = Math.sin(a) * 30;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // Runes on the ring.
    ctx.fillStyle = '#f0c8ff';
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      ctx.fillRect(Math.cos(a) * 35 - 1, Math.sin(a) * 35 - 1.5, 2, 3);
    }
    ctx.restore();
    // Candles at five points (upright, not squashed).
    const wax = tone(0xe8dcc0);
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i / 5) * Math.PI * 2;
      const x = cx + Math.cos(a) * 42;
      const y = cy + Math.sin(a) * 21;
      shade(ctx, () => ctx.rect(x - 1.6, y - 7, 3.2, 7), wax, { band: 1, hi: 0, stroke: 0.5 });
      glow(ctx, { x, y: y - 9 }, 6, 0xffa040, 0.6);
      flat(ctx, ellipseP(ctx, x, y - 9, 1, 1.8), '#ffe08a');
    }
    glow(ctx, { x: cx, y: cy }, 18, 0xb04aff, 0.3);
    line(ctx, [[cx - 3, cy - 2], [cx + 3, cy + 2]], '#f0c8ff', 0.8);
  },
});
