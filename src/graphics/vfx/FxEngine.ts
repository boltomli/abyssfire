import Phaser from 'phaser';
import { FX_TEX_RES } from './FxTextures';

/** Additive glows: above entities and the lighting overlay (3000), below impact bursts (4400) / floating text (4500). */
export const FX_DEPTH_AIR = 3100;
/** Normal-blend debris / smoke sorts with entities (entity depth = y + 50..100). */
export const FX_WORLD_OFFSET = 60;

const DepthMode = { Fixed: 0, World: 1, Ground: 2 } as const;
type DepthMode = typeof DepthMode[keyof typeof DepthMode];

/**
 * One pooled sprite particle. Fields are public and plain so effect code can
 * configure a particle without allocating; the fluent helpers return `this`.
 */
export class FxParticle {
  img: Phaser.GameObjects.Image | null = null;
  age = 0; life = 1;
  x = 0; y = 0; vx = 0; vy = 0; ax = 0; ay = 0; drag = 0;
  rot = 0; spin = 0; faceVel = false; stretch = 0;
  sx0 = 1; sx1 = 1; sy0 = 1; sy1 = 1; sPow = 1;
  a0 = 1; a1 = 0; fadeIn = 0; aPow = 1; flick = 0;
  tint = 0xffffff; tint2 = -1;
  // orbit (offsets x/y around ox/oy on an iso-flattened circle)
  orbit = false; ox = 0; oy = 0; orR = 0; orVR = 0; orA = 0; orW = 0; orFlat = 0.5;
  depthMode: DepthMode = DepthMode.Fixed; depth = FX_DEPTH_AIR; depthOff = 0;
  res = 1; shown = false; fresh = true;

  vel(vx: number, vy: number): this { this.vx = vx; this.vy = vy; return this; }
  /** Velocity from angle (rad) + speed; iso-flattens the vertical component by `flat`. */
  polar(angle: number, speed: number, flat = 1): this { this.vx = Math.cos(angle) * speed; this.vy = Math.sin(angle) * speed * flat; return this; }
  accel(ax: number, ay: number): this { this.ax = ax; this.ay = ay; return this; }
  damp(drag: number): this { this.drag = drag; return this; }
  scale(s0: number, s1 = s0, pow = 1): this { this.sx0 = this.sy0 = s0; this.sx1 = this.sy1 = s1; this.sPow = pow; return this; }
  scaleXY(sx0: number, sy0: number, sx1 = sx0, sy1 = sy0, pow = 1): this {
    this.sx0 = sx0; this.sy0 = sy0; this.sx1 = sx1; this.sy1 = sy1; this.sPow = pow; return this;
  }
  fade(a0: number, a1 = 0, fadeIn = 0, pow = 1): this { this.a0 = a0; this.a1 = a1; this.fadeIn = fadeIn; this.aPow = pow; return this; }
  flicker(amount = 0.45): this { this.flick = amount; return this; }
  spinning(rot: number, spin = 0): this { this.rot = rot; this.spin = spin; return this; }
  face(offset = 0, stretch = 0): this { this.faceVel = true; this.rot = offset; this.stretch = stretch; return this; }
  color(tint: number, tint2 = -1): this {
    this.tint = tint; this.tint2 = tint2;
    this.img?.setTint(tint);
    return this;
  }
  add(): this { this.img?.setBlendMode(Phaser.BlendModes.ADD); return this; }
  normal(): this {
    this.img?.setBlendMode(Phaser.BlendModes.NORMAL);
    if (this.depthMode === DepthMode.Fixed && this.depth === FX_DEPTH_AIR) { this.depthMode = DepthMode.World; this.depthOff = FX_WORLD_OFFSET; }
    return this;
  }
  origin(ox: number, oy: number): this { this.img?.setOrigin(ox, oy); return this; }
  /** Delay before the particle appears (ms). */
  wait(ms: number): this { this.age = -ms; return this; }
  /** Flat ground decal under entities (radius in world px decides the sort offset). */
  ground(radius = 20): this { this.depthMode = DepthMode.Ground; this.depthOff = radius; return this; }
  /** Sort with entities by current y. */
  world(offset = FX_WORLD_OFFSET): this { this.depthMode = DepthMode.World; this.depthOff = offset; return this; }
  at(depth: number): this { this.depthMode = DepthMode.Fixed; this.depth = depth; return this; }
  circle(ox: number, oy: number, r: number, angle: number, angVel: number, radialVel = 0, flat = 0.5): this {
    this.orbit = true; this.ox = ox; this.oy = oy; this.orR = r; this.orA = angle; this.orW = angVel; this.orVR = radialVel; this.orFlat = flat;
    this.x = 0; this.y = 0;
    return this;
  }
}

interface FxTask {
  t: number;
  fresh: boolean;
  dur: number;
  update?: (u: number, dtMs: number) => void;
  done?: () => void;
}

const NULL_PARTICLE = new FxParticle();
const MAX_PARTICLES = 900;
const engines = new WeakMap<Phaser.Scene, FxEngine>();

/**
 * Per-scene pooled particle/decal engine. Images are recycled (never
 * destroyed mid-scene) and particles are plain structs updated in one loop,
 * so steady-state effects allocate nothing per frame.
 *
 * Particles advance with the tween time scale (they slow down during
 * `VFXManager.slowMotion`); tasks (projectile flight, delays) advance in real
 * time so they stay in sync with `scene.time` damage timers.
 */
export class FxEngine {
  readonly scene: Phaser.Scene;
  private live: FxParticle[] = [];
  private free: FxParticle[] = [];
  private tasks: FxTask[] = [];
  private total = 0;
  private lastShake = -1e9;
  private now = 0;

  static for(scene: Phaser.Scene): FxEngine {
    let e = engines.get(scene);
    if (!e) { e = new FxEngine(scene); engines.set(scene, e); }
    return e;
  }

  private constructor(scene: Phaser.Scene) {
    this.scene = scene;
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.update, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    scene.events.once(Phaser.Scenes.Events.DESTROY, this.destroy, this);
  }

  get activeCount(): number { return this.live.length; }

  /** Spawn a particle. `life` in ms. Returns a no-op particle when the pool is exhausted. */
  spawn(tex: string, x: number, y: number, life: number, frame?: string | number): FxParticle {
    let p = this.free.pop();
    if (!p) {
      if (this.total >= MAX_PARTICLES) return NULL_PARTICLE;
      p = new FxParticle();
      p.img = this.scene.add.image(0, 0, tex).setVisible(false);
      this.total++;
    }
    const img = p.img!;
    img.setTexture(tex, frame).setOrigin(0.5, 0.5).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffffff)
      .setAlpha(0).setRotation(0).setVisible(false).setActive(true);
    p.age = 0; p.life = Math.max(1, life);
    p.x = x; p.y = y; p.vx = 0; p.vy = 0; p.ax = 0; p.ay = 0; p.drag = 0;
    p.rot = 0; p.spin = 0; p.faceVel = false; p.stretch = 0;
    p.sx0 = p.sx1 = p.sy0 = p.sy1 = 1; p.sPow = 1;
    p.a0 = 1; p.a1 = 0; p.fadeIn = 0; p.aPow = 1; p.flick = 0;
    p.tint = 0xffffff; p.tint2 = -1;
    p.orbit = false; p.ox = 0; p.oy = 0; p.orR = 0; p.orVR = 0; p.orA = 0; p.orW = 0; p.orFlat = 0.5;
    p.depthMode = DepthMode.Fixed; p.depth = FX_DEPTH_AIR; p.depthOff = 0;
    p.res = 1 / (FX_TEX_RES.get(tex) ?? 1);
    p.shown = false; p.fresh = true;
    this.live.push(p);
    return p;
  }

  /** Kill a particle early (e.g. a projectile head on impact). */
  kill(p: FxParticle): void {
    if (p === NULL_PARTICLE) return;
    p.life = Math.min(p.life, Math.max(0, p.age));
  }

  /** Run `update(u∈[0,1], dt)` for `dur` ms (real time), then `done`. */
  task(dur: number, update?: (u: number, dtMs: number) => void, done?: () => void, delay = 0): void {
    this.tasks.push({ t: -delay, fresh: true, dur: Math.max(1, dur), update, done });
  }

  /** Call `fn` after `ms` (real time, same clock as scene.time). */
  after(ms: number, fn: () => void): void {
    if (ms <= 0) { fn(); return; }
    this.tasks.push({ t: -ms, fresh: true, dur: 0, done: fn });
  }

  /** Throttled camera shake for big hits only. */
  shake(ms: number, intensity: number): void {
    if (this.now - this.lastShake < 120) return;
    this.lastShake = this.now;
    this.scene.cameras.main.shake(ms, intensity);
  }

  private update(_time: number, delta: number): void {
    const real = Math.min(delta, 100);
    this.now += real;
    const dt = real * (this.scene.tweens?.timeScale ?? 1);

    // Tasks. Items created this frame skip their first tick so they stay in
    // lock-step with scene.time timers created alongside them.
    const tasks = this.tasks;
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      if (t.fresh) { t.fresh = false; if (t.t < 0 || t.dur > 0) { if (t.t >= 0) t.update?.(0, 0); continue; } }
      else t.t += real;
      if (t.t < 0) continue;
      if (t.dur <= 0 || t.t >= t.dur) {
        tasks[i] = tasks[tasks.length - 1];
        tasks.pop();
        i--;
        t.update?.(1, real);
        t.done?.();
        continue;
      }
      t.update?.(t.t / t.dur, real);
    }

    const k = dt / 1000;
    const live = this.live;
    for (let i = live.length - 1; i >= 0; i--) {
      const p = live[i];
      if (p.fresh) p.fresh = false; else p.age += dt;
      if (p.age < 0) continue;
      const img = p.img!;
      if (p.age >= p.life) {
        img.setVisible(false).setActive(false);
        live[i] = live[live.length - 1];
        live.pop();
        this.free.push(p);
        continue;
      }
      const t = p.age / p.life;
      if (p.drag > 0) { const f = Math.exp(-p.drag * k); p.vx *= f; p.vy *= f; }
      p.vx += p.ax * k; p.vy += p.ay * k;
      p.x += p.vx * k; p.y += p.vy * k;
      let px = p.x, py = p.y;
      if (p.orbit) {
        p.orA += p.orW * k; p.orR += p.orVR * k;
        px += p.ox + Math.cos(p.orA) * p.orR;
        py += p.oy + Math.sin(p.orA) * p.orR * p.orFlat;
      }
      const se = p.sPow === 1 ? t : 1 - Math.pow(1 - t, p.sPow);
      let sx = (p.sx0 + (p.sx1 - p.sx0) * se) * p.res;
      const sy = (p.sy0 + (p.sy1 - p.sy0) * se) * p.res;
      let rot: number;
      if (p.faceVel) {
        rot = Math.atan2(p.vy, p.vx) + p.rot;
        if (p.stretch > 0) sx *= 1 + Math.sqrt(p.vx * p.vx + p.vy * p.vy) * p.stretch * 0.01;
      } else {
        p.rot += p.spin * k;
        rot = p.rot;
      }
      let a: number;
      if (t < p.fadeIn) a = p.a0 * (t / p.fadeIn);
      else {
        const u = p.fadeIn < 1 ? (t - p.fadeIn) / (1 - p.fadeIn) : 1;
        a = p.a0 + (p.a1 - p.a0) * (p.aPow === 1 ? u : Math.pow(u, p.aPow));
      }
      if (p.flick > 0) a *= 1 - p.flick * Math.random();
      if (p.tint2 >= 0) img.setTint(lerpColor(p.tint, p.tint2, t));
      img.setPosition(px, py).setScale(sx, sy).setRotation(rot).setAlpha(a);
      // setDepth queues a display-list re-sort, so only touch it when the value changes
      let d = p.depth;
      if (p.depthMode === DepthMode.World) d = Math.round(py + p.depthOff);
      else if (p.depthMode === DepthMode.Ground) d = Math.max(100, Math.round(py - p.depthOff * 0.5 + 30));
      if (img.depth !== d) img.setDepth(d);
      if (!p.shown) { img.setVisible(true); p.shown = true; }
    }
  }

  destroy(): void {
    this.scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.update, this);
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.scene.events.off(Phaser.Scenes.Events.DESTROY, this.destroy, this);
    for (const p of this.live) p.img?.destroy();
    for (const p of this.free) p.img?.destroy();
    this.live.length = 0;
    this.free.length = 0;
    this.tasks.length = 0;
    this.total = 0;
    if (engines.get(this.scene) === this) engines.delete(this.scene);
  }
}

export function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const r = ar + ((((b >> 16) & 255) - ar) * t) | 0;
  const g = ag + ((((b >> 8) & 255) - ag) * t) | 0;
  const bl = ab + (((b & 255) - ab) * t) | 0;
  return (r << 16) | (g << 8) | bl;
}
