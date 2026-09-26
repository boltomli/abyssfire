// src/graphics/sprites/effects/ExitPortal.ts
// Displayed centred at (tile, y-8), so the ground line sits at h/2 + 8.
import { defineDecor, shade, tone, glow, rgbaHex, flat, ellipseP } from '../decorations/DecorKit';
import { drawRock } from '../decorations/Rock';

export const ExitPortalDrawer = defineDecor({
  key: 'exit_portal',
  w: 80,
  h: 88,
  ground: 52,
  draw(ctx, { cx, gy, r }) {
    const core = 0x3fe0a0;
    const deep = 0x1a6a8a;
    // Ground rune ring.
    ctx.save();
    ctx.translate(cx, gy);
    ctx.scale(1, 0.45);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 34);
    g.addColorStop(0, rgbaHex(core, 0.55));
    g.addColorStop(0.7, rgbaHex(deep, 0.25));
    g.addColorStop(1, rgbaHex(deep, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = rgbaHex(0xb0ffe0, 0.8);
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.fillStyle = '#d8fff0';
      ctx.fillRect(Math.cos(a) * 30 - 1, Math.sin(a) * 30 - 1.5, 2, 3);
    }
    ctx.restore();
    // Standing vortex: nested swirl arcs in an upright oval.
    const oy = gy - 26;
    glow(ctx, { x: cx, y: oy }, 34, core, 0.5);
    ctx.save();
    ctx.translate(cx, oy);
    ctx.scale(0.62, 1);
    const vg = ctx.createRadialGradient(0, 0, 0, 0, 0, 24);
    vg.addColorStop(0, '#f0fff8');
    vg.addColorStop(0.3, rgbaHex(core, 0.95));
    vg.addColorStop(0.8, rgbaHex(deep, 0.9));
    vg.addColorStop(1, rgbaHex(0x10304a, 0.95));
    ctx.fillStyle = vg;
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const a0 = i * (Math.PI / 2);
      ctx.beginPath();
      for (let k = 0; k <= 24; k++) {
        const t = k / 24;
        const rr = 22 * (1 - t * 0.85);
        const a = a0 + t * Math.PI * 1.6;
        const x = Math.cos(a) * rr;
        const y = Math.sin(a) * rr;
        if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = i % 2 ? 'rgba(220,255,240,0.85)' : rgbaHex(0x80f0ff, 0.8);
      ctx.lineWidth = 2.2 - i * 0.3;
      ctx.stroke();
    }
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = rgbaHex(0x0a2a3a, 0.9);
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    // Flanking standing stones with glowing runes.
    for (const s of [-1, 1]) {
      const x = cx + s * 22;
      const t = tone(0x6a7a8a, { light: 0.35 });
      shade(ctx, () => {
        ctx.moveTo(x - 5, gy + 2);
        ctx.lineTo(x - 4.5, gy - 30);
        ctx.lineTo(x + s * 1, gy - 36);
        ctx.lineTo(x + 4.5, gy - 29);
        ctx.lineTo(x + 5, gy + 2);
        ctx.closePath();
      }, t, { band: 3, hi: 1 });
      glow(ctx, { x, y: gy - 18 }, 7, core, 0.6);
      flat(ctx, ellipseP(ctx, x, gy - 18, 1.4, 3), '#c8fff0');
    }
    drawRock(ctx, cx + 30, gy + 6, 8, 5, 0x6a7a8a, r, 0);
    // Motes.
    for (let i = 0; i < 6; i++) {
      const a = r() * Math.PI * 2;
      const d = 16 + r() * 12;
      flat(ctx, ellipseP(ctx, cx + Math.cos(a) * d, oy + Math.sin(a) * d * 1.2, 0.9, 0.9), '#e8fff8');
    }
  },
});
