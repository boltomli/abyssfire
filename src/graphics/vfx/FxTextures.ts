import Phaser from 'phaser';

/**
 * Painted VFX textures (drawn once at boot on a 2D canvas).
 *
 * `fx_*` textures are drawn at FX_RES× and displayed at 1/FX_RES by FxEngine,
 * so soft gradients and crisp spark tips survive camera zoom (1.8).
 * Most are white/greyscale so a tint picks the element colour; a few are
 * pre-coloured cel-shaded props (arrow, rock, coin, chain, flame palettes).
 *
 * The legacy `particle_*` keys keep their original pixel sizes because other
 * systems (torches, weather, menu embers, NPC sparkles) scale them directly.
 */
export const FX_RES = 2;

type Ctx = CanvasRenderingContext2D;

/** Texture key → resolution multiplier (display scale = 1 / res). */
export const FX_TEX_RES = new Map<string, number>();

function hex(c: number, a = 1): string {
  return `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;
}

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function make(scene: Phaser.Scene, key: string, w: number, h: number, res: number, draw: (ctx: Ctx, w: number, h: number) => void): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w * res);
  canvas.height = Math.ceil(h * res);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  ctx.scale(res, res);
  draw(ctx, w, h);
  scene.textures.addCanvas(key, canvas);
  FX_TEX_RES.set(key, res);
}

// ── Shape painters (drawn in logical px; callers pick the size) ─────────

function softGlow(ctx: Ctx, w: number, h: number, stops: [number, number][]): void {
  const r = Math.min(w, h) / 2;
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, r);
  for (const [o, a] of stops) g.addColorStop(o, `rgba(255,255,255,${a})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** Four-point star: concave arms + small halo. */
function star4(ctx: Ctx, w: number, h: number, pinch = 0.16, halo = 0.35): void {
  const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2;
  softGlow(ctx, w, h, [[0, halo], [0.35, halo * 0.45], [1, 0]]);
  const arm = (len: number, width: number, alpha: number) => {
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    ctx.moveTo(cx, cy - len);
    ctx.quadraticCurveTo(cx + width, cy - width, cx + len, cy);
    ctx.quadraticCurveTo(cx + width, cy + width, cx, cy + len);
    ctx.quadraticCurveTo(cx - width, cy + width, cx - len, cy);
    ctx.quadraticCurveTo(cx - width, cy - width, cx, cy - len);
    ctx.fill();
  };
  arm(r * 0.98, r * pinch * 1.6, 0.55);
  arm(r * 0.8, r * pinch, 1);
}

/** Tapered streak: bright head on the right, tail fades left. */
function streak(ctx: Ctx, w: number, h: number): void {
  const cy = h / 2;
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.9, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0.9)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, cy);
  ctx.quadraticCurveTo(w * 0.7, cy - h * 0.5, w, cy);
  ctx.quadraticCurveTo(w * 0.7, cy + h * 0.5, 0, cy);
  ctx.fill();
  // hot core line
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = Math.max(1, h * 0.14);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w * 0.35, cy);
  ctx.lineTo(w * 0.97, cy);
  ctx.stroke();
}

/** Cartoon smoke puff: lumpy blob, light top-left, shade band lower-right, soft rim. */
function smokePuff(ctx: Ctx, w: number, h: number, seed: number): void {
  const r = rng(seed);
  const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.3;
  const lobes: [number, number, number][] = [[cx, cy, R]];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + r() * 0.8;
    lobes.push([cx + Math.cos(a) * R * 0.55, cy + Math.sin(a) * R * 0.5, R * (0.55 + r() * 0.25)]);
  }
  const path = () => {
    ctx.beginPath();
    for (const [x, y, rr] of lobes) { ctx.moveTo(x + rr, y); ctx.arc(x, y, rr, 0, Math.PI * 2); }
  };
  // soft outer rim
  ctx.save();
  ctx.shadowColor = 'rgba(255,255,255,0.8)';
  ctx.shadowBlur = R * 0.35;
  ctx.fillStyle = 'rgba(175,175,185,0.85)';
  path();
  ctx.fill();
  ctx.restore();
  ctx.save();
  path();
  ctx.clip();
  // shade band (lower right)
  ctx.fillStyle = 'rgba(120,120,138,0.9)';
  ctx.beginPath();
  ctx.arc(cx + R * 0.55, cy + R * 0.6, R * 1.05, 0, Math.PI * 2);
  ctx.fill();
  // light band (upper left)
  ctx.fillStyle = 'rgba(236,236,242,0.95)';
  ctx.beginPath();
  ctx.arc(cx - R * 0.4, cy - R * 0.45, R * 0.72, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Flame tongue with a wavy tip; `pal` = [rim, mid, core] (0xRRGGBB). */
function flame(ctx: Ctx, w: number, h: number, pal: [number, number, number]): void {
  const cx = w / 2;
  const layer = (sx: number, sy: number, color: number, alpha: number, blur: number) => {
    const bw = w * 0.42 * sx, top = h * (1 - 0.92 * sy), base = h * 0.82;
    ctx.save();
    if (blur > 0) { ctx.shadowColor = hex(color, alpha); ctx.shadowBlur = blur; }
    ctx.fillStyle = hex(color, alpha);
    ctx.beginPath();
    ctx.moveTo(cx + bw * 0.1, top);
    ctx.bezierCurveTo(cx + bw * 0.35, top + (base - top) * 0.3, cx + bw * 1.1, top + (base - top) * 0.5, cx + bw, base - bw * 0.55);
    ctx.arc(cx, base - bw * 0.55, bw, 0, Math.PI, false);
    ctx.bezierCurveTo(cx - bw * 1.05, top + (base - top) * 0.45, cx - bw * 0.2, top + (base - top) * 0.35, cx - bw * 0.05, top + (base - top) * 0.18);
    ctx.quadraticCurveTo(cx - bw * 0.05, top + (base - top) * 0.06, cx + bw * 0.1, top);
    ctx.fill();
    ctx.restore();
  };
  layer(1, 1, pal[0], 0.85, w * 0.18);
  layer(0.72, 0.8, pal[1], 0.95, 0);
  layer(0.42, 0.52, pal[2], 1, 0);
}

/** Faceted crystal shard: lit left face, shaded right face, bright ridge. */
function shard(ctx: Ctx, w: number, h: number, light: number, shade: number, line: number): void {
  const cx = w / 2;
  const top = h * 0.02, bot = h * 0.98, mid = h * 0.62, hw = w * 0.46;
  ctx.fillStyle = hex(light, 0.95);
  ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(cx - hw, mid); ctx.lineTo(cx, bot); ctx.closePath(); ctx.fill();
  ctx.fillStyle = hex(shade, 0.95);
  ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(cx + hw, mid); ctx.lineTo(cx, bot); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = hex(line, 1);
  ctx.lineWidth = Math.max(0.8, w * 0.07);
  ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(cx - hw, mid); ctx.lineTo(cx, bot); ctx.lineTo(cx + hw, mid); ctx.closePath(); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = Math.max(0.6, w * 0.05);
  ctx.beginPath(); ctx.moveTo(cx, top + h * 0.06); ctx.lineTo(cx, bot - h * 0.1); ctx.stroke();
}

/** Teardrop / leaf ember. */
function ember(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2;
  ctx.save();
  ctx.shadowColor = 'rgba(255,255,255,0.9)';
  ctx.shadowBlur = w * 0.3;
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  ctx.moveTo(cx, h * 0.08);
  ctx.bezierCurveTo(cx + w * 0.34, h * 0.4, cx + w * 0.3, h * 0.8, cx, h * 0.9);
  ctx.bezierCurveTo(cx - w * 0.3, h * 0.8, cx - w * 0.34, h * 0.4, cx, h * 0.08);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,1)';
  ctx.beginPath();
  ctx.ellipse(cx, h * 0.62, w * 0.14, h * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Liquid droplet with highlight (greyscale, tint for blood/poison). */
function droplet(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, r = w * 0.36, cy = h - r - h * 0.06;
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(cx, h * 0.04);
    ctx.bezierCurveTo(cx + r * 0.3, cy - r * 1.1, cx + r, cy - r * 0.6, cx + r, cy);
    ctx.arc(cx, cy, r, 0, Math.PI, false);
    ctx.bezierCurveTo(cx - r, cy - r * 0.6, cx - r * 0.3, cy - r * 1.1, cx, h * 0.04);
  };
  ctx.fillStyle = 'rgba(205,205,205,1)';
  body(); ctx.fill();
  ctx.save(); body(); ctx.clip();
  ctx.fillStyle = 'rgba(140,140,140,1)';
  ctx.beginPath(); ctx.arc(cx + r * 0.6, cy + r * 0.5, r * 1.05, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(110,110,110,1)';
  ctx.lineWidth = Math.max(0.8, w * 0.06);
  body(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,1)';
  ctx.beginPath(); ctx.ellipse(cx - r * 0.38, cy - r * 0.3, r * 0.2, r * 0.3, -0.4, 0, Math.PI * 2); ctx.fill();
}

// ── Registration ────────────────────────────────────────────────────────

export function generateFxTextures(scene: Phaser.Scene): void {
  const R = FX_RES;

  // Soft glows
  make(scene, 'fx_glow', 64, 64, R, (c, w, h) => softGlow(c, w, h, [[0, 1], [0.18, 0.8], [0.45, 0.3], [0.75, 0.08], [1, 0]]));
  make(scene, 'fx_core', 32, 32, R, (c, w, h) => softGlow(c, w, h, [[0, 1], [0.38, 0.95], [0.62, 0.35], [1, 0]]));

  // Sparks
  make(scene, 'fx_spark', 48, 48, R, (c, w, h) => star4(c, w, h));
  make(scene, 'fx_streak', 64, 12, R, streak);
  make(scene, 'fx_ember', 20, 32, R, ember);
  make(scene, 'fx_drop', 20, 28, R, droplet);

  // Smoke (two lobe layouts for variety)
  make(scene, 'fx_smoke', 64, 64, R, (c, w, h) => smokePuff(c, w, h, 7));
  make(scene, 'fx_smoke2', 64, 64, R, (c, w, h) => smokePuff(c, w, h, 23));
  make(scene, 'fx_puff', 48, 48, R, (c, w, h) => softGlow(c, w, h, [[0, 0.75], [0.5, 0.45], [0.8, 0.12], [1, 0]]));

  // Flames: tintable white + element palettes [rim, mid, core]
  const flames: Record<string, [number, number, number]> = {
    fx_flame: [0xb8b8b8, 0xe8e8e8, 0xffffff],
    fx_flame_fire: [0xe8401a, 0xff9a2a, 0xfff0b0],
    fx_flame_holy: [0xf0a020, 0xffe070, 0xfffbe8],
    fx_flame_poison: [0x2e9a2a, 0x8ee83a, 0xeaffb8],
    fx_flame_shadow: [0x5a1a9a, 0xa05cf0, 0xf0d8ff],
    fx_flame_rage: [0xb01818, 0xff4a2a, 0xffc8a0],
    fx_flame_frost: [0x2a86d8, 0x8ee6ff, 0xffffff],
  };
  for (const [key, pal] of Object.entries(flames)) make(scene, key, 32, 52, R, (c, w, h) => flame(c, w, h, pal));

  // Shards
  make(scene, 'fx_shard', 16, 40, R, (c, w, h) => shard(c, w, h, 0xffffff, 0x9a9aa8, 0xd8d8e0));
  make(scene, 'fx_shard_frost', 16, 40, R, (c, w, h) => shard(c, w, h, 0xeafcff, 0x5ab4ec, 0x2a70c0));

  // Ground rings
  make(scene, 'fx_ring', 128, 128, R, (c, w) => {
    const cx = w / 2;
    for (const [lw, a] of [[12, 0.12], [7, 0.3], [3.5, 0.75], [1.6, 1]] as const) {
      c.strokeStyle = `rgba(255,255,255,${a})`;
      c.lineWidth = lw;
      c.beginPath(); c.arc(cx, cx, cx - 8, 0, Math.PI * 2); c.stroke();
    }
  });
  make(scene, 'fx_shock', 128, 128, R, (c, w, h) => softGlow(c, w, h, [[0, 0], [0.55, 0.04], [0.8, 0.28], [0.93, 0.9], [0.97, 0.6], [1, 0]]));

  // Crescent slash: thick in the middle, tapered tips, hot outer edge
  make(scene, 'fx_slash', 128, 64, R, (c, w, h) => {
    const cx = w / 2;
    const crescent = (outerR: number, innerR: number, drop: number) => {
      c.beginPath();
      c.arc(cx, h, outerR, Math.PI, 0, false);
      c.arc(cx, h + drop, innerR, 0, Math.PI, true);
      c.closePath();
    };
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.75)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.15)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.save();
    c.shadowColor = 'rgba(255,255,255,0.7)';
    c.shadowBlur = 6;
    c.fillStyle = g;
    crescent(h - 2, h - 6, 16);
    c.fill();
    c.restore();
    c.fillStyle = 'rgba(255,255,255,1)';
    crescent(h - 2, h - 3.5, 5);
    c.fill();
  });

  // Claw rake: three curved talon marks
  make(scene, 'fx_claw', 64, 64, R, (c) => {
    for (let i = -1; i <= 1; i++) {
      const ox = 32 + i * 12;
      c.save();
      c.shadowColor = 'rgba(255,255,255,0.8)';
      c.shadowBlur = 5;
      c.fillStyle = 'rgba(255,255,255,1)';
      c.beginPath();
      c.moveTo(ox - 9, 6 + Math.abs(i) * 4);
      c.quadraticCurveTo(ox + 6, 26, ox + 8, 58 - Math.abs(i) * 4);
      c.quadraticCurveTo(ox + 1, 30, ox - 9, 6 + Math.abs(i) * 4);
      c.fill();
      c.restore();
    }
  });

  // Lightning bolts: 4 jagged variants, white core + glow (origin left-middle)
  for (let v = 0; v < 4; v++) {
    make(scene, `fx_bolt${v}`, 128, 32, R, (c, w, h) => {
      const r = rng(101 + v * 17);
      const pts: [number, number][] = [[0, h / 2]];
      const n = 7;
      for (let i = 1; i < n; i++) pts.push([(i / n) * w + (r() - 0.5) * 8, h / 2 + (r() - 0.5) * h * 0.6]);
      pts.push([w, h / 2]);
      const stroke = (lw: number, a: number, pp: [number, number][]) => {
        c.strokeStyle = `rgba(255,255,255,${a})`;
        c.lineWidth = lw;
        c.lineJoin = 'miter';
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(pp[0][0], pp[0][1]);
        for (let i = 1; i < pp.length; i++) c.lineTo(pp[i][0], pp[i][1]);
        c.stroke();
      };
      // side branch
      const bi = 2 + Math.floor(r() * 3);
      const b0 = pts[bi];
      const branch: [number, number][] = [b0, [b0[0] + 14, b0[1] + (r() > 0.5 ? 9 : -9)], [b0[0] + 26, b0[1] + (r() > 0.5 ? 12 : -12)]];
      stroke(9, 0.14, pts); stroke(5, 0.35, pts); stroke(3, 0.2, branch);
      stroke(2.2, 1, pts); stroke(1.2, 0.9, branch);
    });
  }

  // Cel arrow (pointing right)
  make(scene, 'fx_arrow', 48, 12, R, (c) => {
    c.lineCap = 'round';
    c.strokeStyle = '#4a2e18'; c.lineWidth = 3; c.beginPath(); c.moveTo(6, 6); c.lineTo(38, 6); c.stroke();
    c.strokeStyle = '#a8703c'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(6, 6); c.lineTo(38, 6); c.stroke();
    c.strokeStyle = '#d8a468'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(8, 5.4); c.lineTo(36, 5.4); c.stroke();
    // fletching
    c.fillStyle = '#e8e2d0'; c.strokeStyle = '#7a3a2a'; c.lineWidth = 0.8;
    c.beginPath(); c.moveTo(2, 1.5); c.lineTo(11, 5.5); c.lineTo(6, 5.5); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#c84a3a';
    c.beginPath(); c.moveTo(2, 10.5); c.lineTo(11, 6.5); c.lineTo(6, 6.5); c.closePath(); c.fill(); c.stroke();
    // head
    c.fillStyle = '#e8eef6'; c.strokeStyle = '#46505e'; c.lineWidth = 0.9;
    c.beginPath(); c.moveTo(47, 6); c.lineTo(37, 1.8); c.lineTo(39.5, 6); c.lineTo(37, 10.2); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#98a4b8';
    c.beginPath(); c.moveTo(47, 6); c.lineTo(39.5, 6); c.lineTo(37, 10.2); c.closePath(); c.fill();
  });

  // Magic circle (ground decal, flatten at runtime)
  make(scene, 'fx_rune', 128, 128, R, (c, w) => {
    const cx = w / 2;
    c.save();
    c.shadowColor = 'rgba(255,255,255,0.9)';
    c.shadowBlur = 4;
    c.strokeStyle = 'rgba(255,255,255,1)';
    c.lineWidth = 2.4; c.beginPath(); c.arc(cx, cx, 58, 0, Math.PI * 2); c.stroke();
    c.lineWidth = 1.2; c.beginPath(); c.arc(cx, cx, 50, 0, Math.PI * 2); c.stroke();
    c.lineWidth = 1.6; c.beginPath(); c.arc(cx, cx, 30, 0, Math.PI * 2); c.stroke();
    // hexagram
    c.lineWidth = 1.4;
    for (let k = 0; k < 2; k++) {
      c.beginPath();
      for (let i = 0; i <= 3; i++) {
        const a = -Math.PI / 2 + k * Math.PI / 3 + (i * Math.PI * 2) / 3;
        const x = cx + Math.cos(a) * 50, y = cx + Math.sin(a) * 50;
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.stroke();
    }
    // rune ticks between the outer rings
    c.fillStyle = 'rgba(255,255,255,1)';
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      c.save();
      c.translate(cx + Math.cos(a) * 54, cx + Math.sin(a) * 54);
      c.rotate(a + Math.PI / 2);
      if (i % 2 === 0) c.fillRect(-2.2, -1.2, 4.4, 2.4); else { c.beginPath(); c.arc(0, 0, 1.4, 0, Math.PI * 2); c.fill(); }
      c.restore();
    }
    c.restore();
  });

  // Scorch decal: dark char blotch with radial cracks
  make(scene, 'fx_scorch', 96, 96, R, (c, w) => {
    const cx = w / 2, r = rng(55);
    const g = c.createRadialGradient(cx, cx, 0, cx, cx, cx);
    g.addColorStop(0, 'rgba(24,14,10,0.9)');
    g.addColorStop(0.45, 'rgba(34,20,14,0.7)');
    g.addColorStop(0.8, 'rgba(40,26,18,0.25)');
    g.addColorStop(1, 'rgba(40,26,18,0)');
    c.fillStyle = g;
    c.beginPath();
    for (let i = 0; i <= 18; i++) {
      const a = (i / 18) * Math.PI * 2, rr = cx * (0.78 + r() * 0.22);
      if (i === 0) c.moveTo(cx + Math.cos(a) * rr, cx + Math.sin(a) * rr); else c.lineTo(cx + Math.cos(a) * rr, cx + Math.sin(a) * rr);
    }
    c.fill();
    c.strokeStyle = 'rgba(12,6,4,0.85)';
    c.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + r() * 0.5;
      c.lineWidth = 2.2;
      c.beginPath(); c.moveTo(cx + Math.cos(a) * 8, cx + Math.sin(a) * 8);
      const m = 20 + r() * 8;
      c.lineTo(cx + Math.cos(a + 0.2) * m, cx + Math.sin(a + 0.2) * m);
      c.lineWidth = 1.2;
      c.lineTo(cx + Math.cos(a - 0.1) * (m + 12 + r() * 8), cx + Math.sin(a - 0.1) * (m + 12 + r() * 8));
      c.stroke();
    }
  });

  // Ground cracks: dark fissures + white glow copy of the same geometry
  const crackLines = (c: Ctx, w: number, color: string, glowPx: number) => {
    const cx = w / 2, r = rng(77);
    c.save();
    if (glowPx > 0) { c.shadowColor = color; c.shadowBlur = glowPx; }
    c.strokeStyle = color;
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + r() * 0.4;
      let x = cx + Math.cos(a) * 6, y = cx + Math.sin(a) * 6;
      let lw = 3.2;
      c.beginPath(); c.moveTo(x, y);
      const segs = 3 + Math.floor(r() * 2);
      for (let s = 0; s < segs; s++) {
        const len = 10 + r() * 10;
        const aa = a + (r() - 0.5) * 0.7;
        x += Math.cos(aa) * len; y += Math.sin(aa) * len;
        c.lineTo(x, y);
      }
      c.lineWidth = lw; c.stroke();
      lw *= 0.6;
    }
    c.restore();
  };
  make(scene, 'fx_crack', 128, 128, R, (c, w) => crackLines(c, w, 'rgba(26,16,10,0.9)', 0));
  make(scene, 'fx_crack_glow', 128, 128, R, (c, w) => crackLines(c, w, 'rgba(255,255,255,1)', 5));

  // Frost patch: pale blob + crystal spikes
  make(scene, 'fx_frost', 128, 128, R, (c, w) => {
    const cx = w / 2, r = rng(31);
    const g = c.createRadialGradient(cx, cx, 0, cx, cx, cx);
    g.addColorStop(0, 'rgba(220,248,255,0.75)');
    g.addColorStop(0.6, 'rgba(160,220,250,0.45)');
    g.addColorStop(1, 'rgba(160,220,250,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, w);
    c.strokeStyle = 'rgba(255,255,255,0.95)';
    c.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      const a = r() * Math.PI * 2, d0 = 6 + r() * 30, len = 10 + r() * 16;
      const x = cx + Math.cos(a) * d0, y = cx + Math.sin(a) * d0;
      c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); c.stroke();
      c.lineWidth = 1;
      const mx = x + Math.cos(a) * len * 0.55, my = y + Math.sin(a) * len * 0.55;
      c.beginPath(); c.moveTo(mx, my); c.lineTo(mx + Math.cos(a + 0.7) * 5, my + Math.sin(a + 0.7) * 5);
      c.moveTo(mx, my); c.lineTo(mx + Math.cos(a - 0.7) * 5, my + Math.sin(a - 0.7) * 5); c.stroke();
    }
  });

  // Liquid puddle (tint for poison / blood)
  make(scene, 'fx_puddle', 96, 96, R, (c, w) => {
    const cx = w / 2, r = rng(9);
    const pts: [number, number][] = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2, rr = cx * (0.62 + r() * 0.3);
      pts.push([cx + Math.cos(a) * rr, cx + Math.sin(a) * rr]);
    }
    const blob = () => {
      c.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const p0 = pts[i], p1 = pts[(i + 1) % pts.length];
        const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
        if (i === 0) c.moveTo(mx, my); else c.quadraticCurveTo(p0[0], p0[1], mx, my);
      }
      const p0 = pts[0], p1 = pts[1];
      c.quadraticCurveTo(p0[0], p0[1], (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2);
      c.closePath();
    };
    c.fillStyle = 'rgba(190,190,190,0.75)'; blob(); c.fill();
    c.save(); blob(); c.clip();
    c.fillStyle = 'rgba(120,120,120,0.8)';
    c.beginPath(); c.arc(cx + 14, cx + 16, cx * 0.75, 0, Math.PI * 2); c.fill();
    c.restore();
    c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 2; blob(); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.9)';
    c.beginPath(); c.ellipse(cx - 12, cx - 12, 8, 4, -0.5, 0, Math.PI * 2); c.fill();
  });

  // Hex plate (shield segments)
  make(scene, 'fx_hex', 44, 48, R, (c, w, h) => {
    const cx = w / 2, cy = h / 2, rr = 20;
    const hexPath = (s: number) => {
      c.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 6 + (i / 6) * Math.PI * 2;
        const x = cx + Math.cos(a) * rr * s, y = cy + Math.sin(a) * rr * s;
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.closePath();
    };
    c.fillStyle = 'rgba(255,255,255,0.3)'; hexPath(1); c.fill();
    c.save(); hexPath(1); c.clip();
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.beginPath(); c.arc(cx - 8, cy - 10, 14, 0, Math.PI * 2); c.fill();
    c.restore();
    c.save(); c.shadowColor = 'rgba(255,255,255,1)'; c.shadowBlur = 4;
    c.strokeStyle = 'rgba(255,255,255,1)'; c.lineWidth = 2.4; hexPath(0.94); c.stroke(); c.restore();
    c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 1; hexPath(0.66); c.stroke();
  });

  // Energy bubble (fresnel rim + highlight arc)
  make(scene, 'fx_bubble', 96, 96, R, (c, w) => {
    const cx = w / 2;
    softGlow(c, w, w, [[0, 0.08], [0.7, 0.18], [0.9, 0.7], [0.96, 1], [1, 0]]);
    c.strokeStyle = 'rgba(255,255,255,0.95)'; c.lineWidth = 3; c.lineCap = 'round';
    c.beginPath(); c.arc(cx, cx, cx * 0.72, Math.PI * 1.05, Math.PI * 1.4); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.9)';
    c.beginPath(); c.arc(cx - cx * 0.28, cx - cx * 0.56, 2.6, 0, Math.PI * 2); c.fill();
  });

  // Snowflake
  make(scene, 'fx_flake', 32, 32, R, (c, w) => {
    const cx = w / 2;
    c.save(); c.shadowColor = 'rgba(255,255,255,0.9)'; c.shadowBlur = 3;
    c.strokeStyle = 'rgba(255,255,255,1)'; c.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const ex = cx + Math.cos(a) * 13, ey = cx + Math.sin(a) * 13;
      c.lineWidth = 2.2; c.beginPath(); c.moveTo(cx, cx); c.lineTo(ex, ey); c.stroke();
      const mx = cx + Math.cos(a) * 8, my = cx + Math.sin(a) * 8;
      c.lineWidth = 1.4; c.beginPath();
      c.moveTo(mx, my); c.lineTo(mx + Math.cos(a + 0.8) * 4.5, my + Math.sin(a + 0.8) * 4.5);
      c.moveTo(mx, my); c.lineTo(mx + Math.cos(a - 0.8) * 4.5, my + Math.sin(a - 0.8) * 4.5);
      c.stroke();
    }
    c.restore();
  });

  // Vertical light column (origin at the bottom)
  make(scene, 'fx_beam', 32, 128, R, (c, w, h) => {
    const gx = c.createLinearGradient(0, 0, w, 0);
    gx.addColorStop(0, 'rgba(255,255,255,0)');
    gx.addColorStop(0.3, 'rgba(255,255,255,0.35)');
    gx.addColorStop(0.5, 'rgba(255,255,255,1)');
    gx.addColorStop(0.7, 'rgba(255,255,255,0.35)');
    gx.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gx; c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = 'destination-in';
    const gy = c.createLinearGradient(0, 0, 0, h);
    gy.addColorStop(0, 'rgba(0,0,0,0)');
    gy.addColorStop(0.45, 'rgba(0,0,0,0.55)');
    gy.addColorStop(0.9, 'rgba(0,0,0,1)');
    gy.addColorStop(1, 'rgba(0,0,0,0.6)');
    c.fillStyle = gy; c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = 'source-over';
  });

  // Gold coin (cel)
  make(scene, 'fx_coin', 14, 14, R, (c) => {
    c.fillStyle = '#e8a82a'; c.beginPath(); c.ellipse(7, 7, 6, 6, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffd95a'; c.beginPath(); c.ellipse(6.2, 6.2, 4.6, 4.6, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff4b8'; c.beginPath(); c.ellipse(5, 5, 1.8, 1.4, -0.6, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#8a5410'; c.lineWidth = 1; c.beginPath(); c.ellipse(7, 7, 6, 6, 0, 0, Math.PI * 2); c.stroke();
  });

  // Plus (heal)
  make(scene, 'fx_plus', 24, 24, R, (c) => {
    c.save(); c.shadowColor = 'rgba(255,255,255,0.9)'; c.shadowBlur = 4;
    c.fillStyle = 'rgba(255,255,255,1)';
    const rr = (x: number, y: number, w: number, h: number) => { c.beginPath(); c.roundRect(x, y, w, h, 1.6); c.fill(); };
    rr(9, 3, 6, 18); rr(3, 9, 18, 6);
    c.restore();
  });

  // Death-mark skull sigil
  make(scene, 'fx_skull', 48, 48, R, (c) => {
    c.save(); c.shadowColor = 'rgba(255,255,255,0.9)'; c.shadowBlur = 5;
    c.fillStyle = 'rgba(255,255,255,1)';
    c.beginPath(); c.arc(24, 20, 13, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.roundRect(16, 26, 16, 12, 3); c.fill();
    c.restore();
    c.globalCompositeOperation = 'destination-out';
    c.beginPath(); c.ellipse(18.5, 21, 4.2, 5, 0.25, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(29.5, 21, 4.2, 5, -0.25, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(24, 26); c.lineTo(22, 30); c.lineTo(26, 30); c.closePath(); c.fill();
    c.fillRect(20.5, 33, 1.6, 5); c.fillRect(25.9, 33, 1.6, 5);
    c.globalCompositeOperation = 'source-over';
  });

  // Chain link (steel, cel)
  make(scene, 'fx_chain', 20, 12, R, (c) => {
    c.strokeStyle = '#3a4250'; c.lineWidth = 3.6; c.beginPath(); c.ellipse(10, 6, 7.5, 4, 0, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = '#a8b4c4'; c.lineWidth = 2.2; c.beginPath(); c.ellipse(10, 6, 7.5, 4, 0, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = '#eef4fa'; c.lineWidth = 1; c.beginPath(); c.ellipse(10, 6, 7.5, 4, 0, Math.PI * 1.05, Math.PI * 1.6); c.stroke();
  });

  // Debris rocks (cel shaded)
  for (let v = 0; v < 2; v++) {
    make(scene, `fx_rock${v}`, 16, 14, R, (c) => {
      const r = rng(300 + v);
      const pts: [number, number][] = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + r() * 0.4;
        pts.push([8 + Math.cos(a) * (5 + r() * 2.4), 7 + Math.sin(a) * (4.2 + r() * 1.8)]);
      }
      const path = () => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); };
      c.fillStyle = '#8a7358'; path(); c.fill();
      c.save(); path(); c.clip();
      c.fillStyle = '#5c4a3a'; c.beginPath(); c.arc(12, 11, 6.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#bca27c'; c.beginPath(); c.arc(5, 4, 3.6, 0, Math.PI * 2); c.fill();
      c.restore();
      c.strokeStyle = '#3a2e24'; c.lineWidth = 1; c.lineJoin = 'round'; path(); c.stroke();
    });
  }

  // Comet head (tintable): round bright head at right, tapered tail
  make(scene, 'fx_comet', 64, 24, R, (c, w, h) => {
    const cy = h / 2, hx = w - h / 2;
    const g = c.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0.95)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0, cy);
    c.quadraticCurveTo(hx * 0.6, cy - h * 0.42, hx, cy - h * 0.42);
    c.arc(hx, cy, h * 0.42, -Math.PI / 2, Math.PI / 2);
    c.quadraticCurveTo(hx * 0.6, cy + h * 0.42, 0, cy);
    c.fill();
    const r = c.createRadialGradient(hx, cy, 0, hx, cy, h * 0.45);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.6, 'rgba(255,255,255,0.9)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = r;
    c.beginPath(); c.arc(hx, cy, h * 0.45, 0, Math.PI * 2); c.fill();
  });

  generateLegacyParticles(scene);
}

/** The original `particle_*` keys, repainted in the soft style at their old sizes. */
function generateLegacyParticles(scene: Phaser.Scene): void {
  // Resolution 1: external emitters size these by their pixel dimensions.
  const R = 1;
  make(scene, 'particle_circle', 16, 16, R, (c, w, h) => softGlow(c, w, h, [[0, 1], [0.3, 0.85], [0.65, 0.3], [1, 0]]));
  make(scene, 'particle_spark', 12, 12, R, (c, w, h) => star4(c, w, h, 0.2, 0.3));
  make(scene, 'particle_star', 20, 20, R, (c, w, h) => star4(c, w, h, 0.18, 0.4));
  make(scene, 'particle_flame', 16, 24, R, (c, w, h) => flame(c, w, h, [0xc8c8c8, 0xececec, 0xffffff]));
  make(scene, 'particle_ice', 16, 16, R, (c, w, h) => {
    c.translate(w / 2, h / 2); c.rotate(Math.PI / 4); c.translate(-4, -8);
    shard(c, 8, 16, 0xffffff, 0x9fb4c8, 0xd8e8f4);
  });
  make(scene, 'particle_arrow', 8, 24, R, (c) => {
    c.translate(4, 12); c.rotate(-Math.PI / 2); c.scale(0.5, 0.66); c.translate(-24, -6);
    const img = scene.textures.get('fx_arrow').getSourceImage() as HTMLCanvasElement;
    c.drawImage(img, 0, 0, 48, 12);
  });
  make(scene, 'particle_slash', 32, 8, R, streak);
  make(scene, 'particle_lightning', 4, 32, R, (c) => {
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 3.5;
    const zz = () => { c.beginPath(); c.moveTo(2, 0); c.lineTo(0.6, 8); c.lineTo(3.4, 12); c.lineTo(0.6, 20); c.lineTo(3.4, 24); c.lineTo(2, 32); c.stroke(); };
    zz(); c.strokeStyle = 'rgba(255,255,255,1)'; c.lineWidth = 1.4; zz();
  });
  make(scene, 'particle_smoke', 24, 24, R, (c, w, h) => softGlow(c, w, h, [[0, 0.55], [0.45, 0.4], [0.8, 0.12], [1, 0]]));
  make(scene, 'particle_poison', 12, 12, R, droplet);
}
