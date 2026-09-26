import { FxEngine, FX_DEPTH_AIR, type FxParticle } from './FxEngine';
import { FX_TEX_RES } from './FxTextures';

/** Element palette: hot core → body → rim → dark accent. */
export interface FxPalette { core: number; mid: number; rim: number; dark: number; flame: string }

export const PAL = {
  fire:      { core: 0xfff3c4, mid: 0xffa532, rim: 0xff5418, dark: 0x8a1c08, flame: 'fx_flame_fire' },
  frost:     { core: 0xffffff, mid: 0xa6f0ff, rim: 0x46b4f0, dark: 0x1e5aa8, flame: 'fx_flame_frost' },
  lightning: { core: 0xffffff, mid: 0xcfe0ff, rim: 0x8c8cff, dark: 0x4a3aa8, flame: 'fx_flame_frost' },
  poison:    { core: 0xf0ffc0, mid: 0x9aec40, rim: 0x3fae2e, dark: 0x1c5a1e, flame: 'fx_flame_poison' },
  shadow:    { core: 0xf0dcff, mid: 0xb478ff, rim: 0x7030c0, dark: 0x24103e, flame: 'fx_flame_shadow' },
  holy:      { core: 0xfffbe4, mid: 0xffe27a, rim: 0xf4ac28, dark: 0x8a5a10, flame: 'fx_flame_holy' },
  steel:     { core: 0xffffff, mid: 0xeef3fb, rim: 0xaabbd4, dark: 0x56647c, flame: 'fx_flame' },
  blood:     { core: 0xffb0a0, mid: 0xe8342c, rim: 0xa01420, dark: 0x4a0810, flame: 'fx_flame_rage' },
  rage:      { core: 0xffe0b0, mid: 0xff5a2a, rim: 0xd01e1e, dark: 0x5a0a0a, flame: 'fx_flame_rage' },
  arcane:    { core: 0xffffff, mid: 0xd8b4ff, rim: 0x8a5cff, dark: 0x34207a, flame: 'fx_flame_shadow' },
  nature:    { core: 0xf6ffe0, mid: 0xa8f07a, rim: 0x40c060, dark: 0x1a5a2a, flame: 'fx_flame_poison' },
  earth:     { core: 0xfff0c8, mid: 0xe8c47a, rim: 0xb08850, dark: 0x5a4430, flame: 'fx_flame_holy' },
} as const satisfies Record<string, FxPalette>;

/** World px per tile of AoE radius on the iso ground plane (half-width). */
export const TILE_R = 45;
/** Iso ground flattening. */
export const FLAT = 0.5;

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(arr: readonly T[]): T => arr[(Math.random() * arr.length) | 0];

/**
 * Composite effect helpers on top of FxEngine. All positions are world px;
 * `gy` parameters are ground (feet) y, `y` parameters are in-air y.
 */
export class FxKit {
  readonly e: FxEngine;
  constructor(engine: FxEngine) { this.e = engine; }

  // ── Light ────────────────────────────────────────────────

  /** Soft additive glow that pops then fades. `size` = diameter in world px. */
  glow(x: number, y: number, tint: number, size: number, life: number, grow = 1.3, alpha = 0.9, delay = 0): FxParticle {
    const s = size / 64;
    return this.e.spawn('fx_glow', x, y, life).color(tint).scale(s * 0.6, s * grow, 2).fade(alpha, 0, 0.08, 1.6).wait(delay);
  }

  /** White-hot core + coloured bloom: the "impact" frame. */
  flash(x: number, y: number, tint: number, size: number, life = 180, delay = 0): void {
    this.glow(x, y, tint, size * 1.6, life * 1.5, 1.25, 0.6, delay);
    this.e.spawn('fx_core', x, y, life).scale((size / 32) * 0.35, (size / 32) * 0.85, 2).fade(0.9, 0, 0, 1.2).wait(delay);
  }

  /** Four-point glint. */
  glint(x: number, y: number, tint: number, size: number, life = 220, delay = 0, rot = 0): FxParticle {
    const s = size / 48;
    return this.e.spawn('fx_spark', x, y, life).color(tint).scale(s * 0.3, s, 3).spinning(rot, 1.2).fade(1, 0, 0.15, 1.5).wait(delay);
  }

  // ── Particles ────────────────────────────────────────────

  /** Radial streak sparks (optionally directional). */
  sparks(x: number, y: number, n: number, tint: number, o: {
    speed?: [number, number]; life?: [number, number]; angle?: number; spread?: number;
    size?: number; gravity?: number; drag?: number; flat?: number; delay?: number; tint2?: number;
  } = {}): void {
    const [s0, s1] = o.speed ?? [90, 200];
    const [l0, l1] = o.life ?? [180, 340];
    const spread = o.spread ?? Math.PI * 2;
    const base = o.angle ?? 0;
    const size = o.size ?? 1;
    for (let i = 0; i < n; i++) {
      const a = o.angle === undefined ? Math.random() * Math.PI * 2 : base + (Math.random() - 0.5) * spread;
      const p = this.e.spawn('fx_streak', x, y, rand(l0, l1))
        .polar(a, rand(s0, s1), o.flat ?? 0.8).damp(o.drag ?? 3).accel(0, o.gravity ?? 0)
        .face(0, 0.35).scaleXY(0.45 * size, 0.7 * size, 0.2 * size, 0.35 * size).fade(1, 0, 0, 1.3)
        .color(i % 3 === 0 ? 0xffffff : tint, o.tint2 ?? -1);
      if (o.delay) p.wait(o.delay);
    }
  }

  /** Round motes / stars drifting out (for sparkles, embers, dust motes). */
  motes(x: number, y: number, n: number, tex: string, tints: readonly number[], o: {
    radius?: number; speed?: [number, number]; life?: [number, number]; size?: [number, number];
    rise?: number; gravity?: number; drag?: number; spin?: number; delay?: number; flat?: number; alpha?: number; normal?: boolean;
    angle?: number; spread?: number;
  } = {}): void {
    const [s0, s1] = o.speed ?? [20, 70];
    const [l0, l1] = o.life ?? [400, 700];
    const [z0, z1] = o.size ?? [0.3, 0.6];
    const rad = o.radius ?? 0;
    for (let i = 0; i < n; i++) {
      const a = o.angle === undefined ? Math.random() * Math.PI * 2 : o.angle + (Math.random() - 0.5) * (o.spread ?? 1);
      const r = rad * Math.sqrt(Math.random());
      const ra = Math.random() * Math.PI * 2;
      const sz = rand(z0, z1);
      const p = this.e.spawn(tex, x + Math.cos(ra) * r, y + Math.sin(ra) * r * FLAT, rand(l0, l1))
        .polar(a, rand(s0, s1), o.flat ?? 0.7).accel(0, (o.gravity ?? 0) - (o.rise ?? 0)).damp(o.drag ?? 1.5)
        .scale(sz, sz * 0.2, 1).spinning(Math.random() * 6.28, (o.spin ?? 0) * (Math.random() - 0.5) * 2)
        .fade(o.alpha ?? 1, 0, 0.1, 1.4).color(pick(tints));
      if (o.normal) p.normal();
      if (o.delay) p.wait(o.delay + Math.random() * 60);
    }
  }

  /** Flame tongues licking upward from a ground area. */
  flames(x: number, gy: number, n: number, tex: string, o: {
    rx?: number; life?: [number, number]; size?: [number, number]; rise?: [number, number]; delay?: number; stagger?: number; tint?: number; depthOff?: number;
  } = {}): void {
    const rx = o.rx ?? 10;
    const [l0, l1] = o.life ?? [300, 520];
    const [z0, z1] = o.size ?? [0.5, 0.9];
    const [r0, r1] = o.rise ?? [30, 70];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = rx * Math.sqrt(Math.random());
      const sz = rand(z0, z1);
      const fy = gy + Math.sin(a) * r * FLAT;
      // depth anchored at the flame's ground point so rising tongues don't slip behind the caster
      const p = this.e.spawn(tex, x + Math.cos(a) * r, fy, rand(l0, l1))
        .normal().at(fy + (o.depthOff ?? 104)).origin(0.5, 0.85).vel(rand(-8, 8), -rand(r0, r1)).damp(1)
        .scaleXY(sz * 0.7, sz * 0.5, sz * 0.35, sz * 1.15, 2).spinning(rand(-0.15, 0.15), rand(-0.6, 0.6))
        .fade(1, 0, 0.15, 1.2);
      if (o.tint !== undefined) p.color(o.tint);
      p.wait((o.delay ?? 0) + (o.stagger ?? 0) * Math.random());
    }
  }

  /** Cartoon smoke puffs (normal blend, sorted with the world). */
  smoke(x: number, y: number, n: number, tint: number, o: {
    radius?: number; speed?: [number, number]; life?: [number, number]; size?: [number, number]; rise?: number; alpha?: number; delay?: number; flat?: number;
  } = {}): void {
    const [s0, s1] = o.speed ?? [15, 45];
    const [l0, l1] = o.life ?? [500, 800];
    const [z0, z1] = o.size ?? [0.35, 0.6];
    const rad = o.radius ?? 8;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = rad * Math.sqrt(Math.random());
      const sz = rand(z0, z1);
      const p = this.e.spawn(i % 2 ? 'fx_smoke' : 'fx_smoke2', x + Math.cos(a) * r, y + Math.sin(a) * r * FLAT, rand(l0, l1))
        .normal().polar(a, rand(s0, s1), o.flat ?? 0.6).damp(2.2).accel(0, -(o.rise ?? 20))
        .scale(sz * 0.6, sz * 1.25, 2).spinning(Math.random() * 6.28, rand(-0.8, 0.8))
        .fade(o.alpha ?? 0.8, 0, 0.12, 1.3).color(tint);
      if (o.delay) p.wait(o.delay + Math.random() * 50);
    }
  }

  /** Rock/debris chunks thrown in arcs that land on the ground. */
  debris(x: number, gy: number, n: number, o: { speed?: [number, number]; life?: number; tint?: number; size?: number } = {}): void {
    const [s0, s1] = o.speed ?? [60, 130];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = rand(s0, s1);
      const sz = rand(0.7, 1.2) * (o.size ?? 1);
      this.e.spawn(i % 2 ? 'fx_rock0' : 'fx_rock1', x, gy - 4, o.life ?? rand(420, 560))
        .normal().world(40).vel(Math.cos(a) * sp, Math.sin(a) * sp * FLAT - rand(110, 170)).accel(0, 520)
        .scale(sz, sz * 0.8).spinning(Math.random() * 6.28, rand(-9, 9)).fade(1, 0, 0, 5).color(o.tint ?? 0xffffff);
    }
  }

  // ── Ground plane ─────────────────────────────────────────

  /** Expanding iso ring on the ground (solid body + additive glow). r = half-width in world px. */
  ring(x: number, gy: number, tint: number, r0: number, r1: number, life: number, o: { alpha?: number; delay?: number; thick?: number; pow?: number; air?: boolean } = {}): FxParticle {
    const k = 1 / 58; // texture ring radius at scale 1
    const th = o.thick ?? 1;
    const a = o.alpha ?? 1;
    const body = this.e.spawn('fx_ring', x, gy, life).normal().color(tint)
      .scaleXY(r0 * k, r0 * k * FLAT * th, r1 * k, r1 * k * FLAT * th, o.pow ?? 3).fade(a * 0.55, 0, 0.05, 1.5);
    const p = this.e.spawn('fx_ring', x, gy, life).color(tint)
      .scaleXY(r0 * k, r0 * k * FLAT * th, r1 * k, r1 * k * FLAT * th, o.pow ?? 3).fade(a, 0, 0.05, 1.5);
    if (!o.air) { p.ground(r1); body.ground(r1 + 2); }
    if (o.delay) { p.wait(o.delay); body.wait(o.delay); }
    return p;
  }

  /** Filled shockwave disc (bright rim) on the ground. */
  shock(x: number, gy: number, tint: number, r0: number, r1: number, life: number, alpha = 0.9, delay = 0): FxParticle {
    const k = 1 / 64;
    this.e.spawn('fx_shock', x, gy, life).normal().color(tint).ground(r1 + 2)
      .scaleXY(r0 * k, r0 * k * FLAT, r1 * k, r1 * k * FLAT, 3).fade(alpha * 0.45, 0, 0.04, 1.2).wait(delay);
    return this.e.spawn('fx_shock', x, gy, life).color(tint).ground(r1)
      .scaleXY(r0 * k, r0 * k * FLAT, r1 * k, r1 * k * FLAT, 3).fade(alpha, 0, 0.04, 1.2).wait(delay);
  }

  /** Flat ground decal (scorch, frost, puddle, rune…). r = half-width in world px. */
  decal(x: number, gy: number, tex: string, tint: number, r: number, life: number, o: {
    alpha?: number; fadeIn?: number; add?: boolean; spin?: number; rot?: number; grow?: number; delay?: number; pow?: number;
  } = {}): FxParticle {
    const src = this.e.scene.textures.get(tex).getSourceImage() as { width: number };
    const tw = src.width / (FX_TEX_RES.get(tex) ?? 1);
    const s = r / (tw / 2);
    const grow = o.grow ?? 1;
    const p = this.e.spawn(tex, x, gy, life).color(tint).ground(r)
      .scaleXY(s * (grow < 1 ? 1 : 0.85), s * FLAT * (grow < 1 ? 1 : 0.85), s * grow, s * FLAT * grow, 3)
      .fade(o.alpha ?? 1, 0, o.fadeIn ?? 0.06, o.pow ?? 3).spinning(o.rot ?? 0, o.spin ?? 0);
    if (!o.add) p.img?.setBlendMode(0);
    else if (tex !== 'fx_glow') {
      const u = this.e.spawn(tex, x, gy, life).normal().color(tint).ground(r + 2)
        .scaleXY(p.sx0, p.sy0, p.sx1, p.sy1, 3).fade((o.alpha ?? 1) * 0.5, 0, o.fadeIn ?? 0.06, o.pow ?? 3).spinning(o.rot ?? 0, o.spin ?? 0);
      if (o.delay) u.wait(o.delay);
    }
    if (o.delay) p.wait(o.delay);
    return p;
  }

  // ── Shapes ───────────────────────────────────────────────

  /**
   * Crescent weapon swipe centred on (x, y). `angle` = direction the blade
   * travels toward (rad). The crescent sweeps `sweep` rad over its life.
   */
  slash(x: number, y: number, angle: number, tint: number, o: {
    radius?: number; life?: number; thick?: number; sweep?: number; flip?: boolean; delay?: number; core?: boolean; flat?: number;
  } = {}): void {
    const r = o.radius ?? 28;
    const life = o.life ?? 200;
    const sweep = (o.sweep ?? 1.1) * (o.flip ? -1 : 1);
    const k = r / 62;
    const th = o.thick ?? 1;
    const flat = o.flat ?? 1;
    const rot0 = angle + Math.PI / 2 - sweep * 0.5;
    const rot1v = sweep / (life / 1000);
    // solid coloured body, additive glow, white-hot edge
    this.e.spawn('fx_slash', x, y, life).normal().at(FX_DEPTH_AIR - 1).color(tint).origin(0.5, 1)
      .scaleXY(k * 0.8, k * 0.55 * th * flat, k * 1.08, k * 0.35 * th * flat, 2).spinning(rot0, rot1v)
      .fade(0.9, 0, 0.05, 1.8).wait(o.delay ?? 0);
    this.e.spawn('fx_slash', x, y, life).color(tint).origin(0.5, 1)
      .scaleXY(k * 0.84, k * 0.7 * th * flat, k * 1.12, k * 0.45 * th * flat, 2).spinning(rot0, rot1v)
      .fade(0.6, 0, 0.05, 1.8).wait(o.delay ?? 0);
    if (o.core !== false) {
      this.e.spawn('fx_slash', x, y, life * 0.75).origin(0.5, 1)
        .scaleXY(k * 0.78, k * 0.28 * th * flat, k * 1.04, k * 0.16 * th * flat, 2).spinning(rot0, rot1v)
        .fade(1, 0, 0, 1.5).wait(o.delay ?? 0);
    }
  }

  /**
   * Weapon swipe on the iso ground plane: an arc of the ellipse around
   * (cx, cy) from angle a0 to a1 (direction of travel), built from
   * tangent-aligned segments that appear in sequence. Segments in front of
   * the centre sort in front of the character, the far side behind.
   */
  swipe(cx: number, cy: number, a0: number, a1: number, R: number, tint: number, o: {
    life?: number; sweepMs?: number; thick?: number; delay?: number; flat?: number; core?: boolean; front?: number; step?: number;
  } = {}): void {
    const span = a1 - a0;
    const n = Math.max(4, Math.ceil(Math.abs(span) / (o.step ?? 0.2)));
    const flat = o.flat ?? FLAT;
    const life = o.life ?? 170;
    const sweep = o.sweepMs ?? 80;
    const th = o.thick ?? 1;
    const dir = span >= 0 ? 1 : -1;
    const front = o.front ?? 116;
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n;
      const t = a0 + span * u;
      const px = cx + Math.cos(t) * R, py = cy + Math.sin(t) * R * flat;
      const dx = -Math.sin(t) * dir, dy = Math.cos(t) * flat * dir;
      const rot = Math.atan2(dy, dx);
      const seg = (R * Math.abs(span) / n) * Math.sqrt(dx * dx + dy * dy);
      const w = (0.3 + 0.7 * Math.sin(Math.PI * Math.min(1, u * 1.1))) * th;
      const sx = (seg * 2.3) / 64;
      const d = (o.delay ?? 0) + u * sweep;
      const off = Math.sin(t) > -0.15 ? front : 10;
      this.e.spawn('fx_streak', px, py, life).normal().world(off).color(tint).spinning(rot)
        .scaleXY(sx, 1.7 * w, sx * 1.1, 0.9 * w).fade(0.95, 0, 0, 1.8).wait(d);
      this.e.spawn('fx_streak', px, py, life * 0.9).world(off + 1).add().color(tint).spinning(rot)
        .scaleXY(sx * 1.05, 2.6 * w, sx * 1.15, 1.2 * w).fade(0.45, 0, 0, 1.4).wait(d);
      if (o.core !== false) {
        this.e.spawn('fx_streak', px, py, life * 0.75).world(off + 2).add().spinning(rot)
          .scaleXY(sx, 0.7 * w, sx, 0.35 * w).fade(1, 0, 0, 1.6).wait(d);
      }
    }
  }

  /**
   * Lightning bolt between two points (stretched jagged texture, flickering).
   * `ink` (optional) draws a dark normal-blend under-stroke so the bolt reads on bright ground.
   */
  bolt(x1: number, y1: number, x2: number, y2: number, tint: number, life = 220, width = 1, delay = 0, ink = -1): void {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 2) return;
    // split long bolts at a jittered midpoint so they don't read as one stamp
    if (len > 90) {
      const nx = -dy / len, ny = dx / len, j = (Math.random() - 0.5) * len * 0.18;
      const mx = x1 + dx * 0.5 + nx * j, my = y1 + dy * 0.5 + ny * j;
      this.bolt(x1, y1, mx, my, tint, life, width, delay, ink);
      this.bolt(mx, my, x2, y2, tint, life, width, delay, ink);
      return;
    }
    const ang = Math.atan2(dy, dx);
    const sx = len / 128;
    const flip = Math.random() > 0.5 ? 1 : -1;
    const tex = `fx_bolt${(Math.random() * 4) | 0}`;
    if (ink >= 0) {
      this.e.spawn(tex, x1, y1, life).normal().at(FX_DEPTH_AIR - 1).origin(0, 0.5).color(ink)
        .scaleXY(sx, width * 0.8 * flip, sx, width * 0.5 * flip).spinning(ang).fade(0.8, 0, 0, 1.2).wait(delay);
    }
    this.e.spawn(tex, x1, y1, life).origin(0, 0.5).color(tint)
      .scaleXY(sx, width * 0.75 * flip, sx, width * 0.45 * flip).spinning(ang).fade(1, 0, 0, 1.2).flicker(0.5).wait(delay);
    this.e.spawn(tex, x1, y1, life * 0.8).origin(0, 0.5)
      .scaleXY(sx, width * 0.4 * flip, sx, width * 0.25 * flip).spinning(ang).fade(1, 0, 0, 1.2).flicker(0.3).wait(delay);
  }

  /** Vertical light column rising from the ground. */
  beam(x: number, gy: number, tint: number, h: number, w: number, life: number, o: { alpha?: number; delay?: number; fadeIn?: number } = {}): FxParticle {
    return this.e.spawn('fx_beam', x, gy, life).origin(0.5, 1).color(tint)
      .scaleXY(w / 32 * 0.5, h / 128 * 0.4, w / 32, h / 128, 3).fade(o.alpha ?? 0.9, 0, o.fadeIn ?? 0.1, 1.2).wait(o.delay ?? 0);
  }

  /** Motes spiralling in to a point (anticipation / charge-up). */
  gather(x: number, y: number, n: number, tex: string, tint: number, r: number, life: number, size = 0.35, delay = 0): void {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const rr = r * rand(0.8, 1.1);
      const l = life * rand(0.8, 1);
      this.e.spawn(tex, 0, 0, l).color(tint).circle(x, y, rr, a, rand(2.5, 4), -rr / (l / 1000), 0.6)
        .scale(size * 0.7, size * 1.2).fade(0.2, 1, 0, 1).wait(delay);
    }
  }
}
