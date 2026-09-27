import Phaser from 'phaser';
import { RENDER_SCALE } from '../config';
import { EventBus, GameEvents } from '../utils/EventBus';
import { HIT_PROFILES, type HitWeight } from './HitFeedback';
import { FxEngine } from '../graphics/vfx/FxEngine';
import { FxKit, PAL } from '../graphics/vfx/FxKit';

// Above entities (depth = world y + offset) and the lighting overlay, below floating text.
const IMPACT_DEPTH = 4400;

/** Loot quality colours (match the UI quality palette in docs/art-direction.md). */
const LOOT_COLORS: Record<string, number> = {
  magic: 0x4f8cff,
  rare: 0xffd84a,
  legendary: 0xff8a2a,
  set: 0x3ecf6a,
};

/**
 * Centralized VFX manager — camera effects, per-GameObject FX, combat juice.
 * Listens to EventBus for automatic triggers; also exposes manual API.
 */
export class VFXManager {
  private scene: Phaser.Scene;
  private isWebGL: boolean;
  private fx: FxKit;

  // Throttle timestamps
  private lastShakeTime = 0;
  private lastFlashTime = 0;

  // Slow-motion (elite/boss kill beats)
  private slowMoTimer: Phaser.Time.TimerEvent | null = null;

  // Low HP vignette
  private dangerVignette: Phaser.FX.Vignette | null = null;
  private dangerActive = false;
  private readonly handleCombatDamage = (data: {
    targetId: string;
    damage: number;
    isDodged: boolean;
    isCrit: boolean;
    isPlayerTarget?: boolean;
    damageType?: string;
    targetMaxHP?: number;
  }): void => {
    if (data.isDodged) return;
    const maxHP = data.targetMaxHP || 100;
    const ratio = data.damage / maxHP;

    if (data.isPlayerTarget) {
      if (data.isCrit) {
        this.cameraShake(150, 0.008);
      } else if (data.damage > 0) {
        const intensity = Math.max(0.002, Math.min(0.006, ratio * 0.01));
        const duration = Math.max(50, Math.min(120, 50 + ratio * 100));
        this.cameraShake(duration, intensity);
      }
    }
    // Hits on monsters are driven per-hit by ZoneScene via HIT_PROFILES
    // (see impactBurst / playHitImpact) so shake scales with hit weight.
  };
  private readonly handlePlayerLevelUp = (): void => {
    this.cameraFlash(200, 0.5, 0xffd700);
    this.cameraShake(100, 0.004);
    this.cameraZoomPulse(1.5 * RENDER_SCALE, 200, 1.8 * RENDER_SCALE);
    this.scene.time.delayedCall(100, () => {
      const cam = this.scene.cameras.main;
      const wv = cam.worldView;
      const centerX = wv.centerX;
      const centerY = wv.centerY;
      this.levelUpBurst(centerX, centerY);
    });
  };
  private readonly handlePlayerDied = (): void => {
    this.cameraFade(220, 80, 10, 10);
  };
  private readonly handleItemDropped = (data: { item: { quality: string } }): void => {
    if (data.item.quality === 'legendary' || data.item.quality === 'set') {
      this.cameraFlash(220, 0.35, LOOT_COLORS[data.item.quality]);
      this.cameraShake(160, 0.005);
    }
  };

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.isWebGL = scene.renderer.type === Phaser.WEBGL;
    this.fx = new FxKit(FxEngine.for(scene));
    this.setupEventListeners();
  }

  // ── Event-driven VFX ────────────────────────────────────

  private setupEventListeners(): void {
    EventBus.on(GameEvents.COMBAT_DAMAGE, this.handleCombatDamage);
    EventBus.on(GameEvents.PLAYER_LEVEL_UP, this.handlePlayerLevelUp);
    EventBus.on(GameEvents.PLAYER_DIED, this.handlePlayerDied);
    EventBus.on(GameEvents.ITEM_DROPPED, this.handleItemDropped);
  }

  // ── Camera Effects ──────────────────────────────────────

  cameraShake(duration: number, intensity: number): void {
    const now = this.scene.time.now;
    if (now - this.lastShakeTime < 100) return;
    this.lastShakeTime = now;
    this.scene.cameras.main.shake(duration, intensity);
  }

  cameraFlash(duration: number, alpha: number, color: number = 0xffffff): void {
    const now = this.scene.time.now;
    if (now - this.lastFlashTime < 200) return;
    this.lastFlashTime = now;
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;
    this.scene.cameras.main.flash(duration, r, g, b, false, (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
      // Custom alpha curve — fade out faster
      if (progress > 0.3) {
        // Already handled by Phaser's built-in flash
      }
    });
  }

  cameraFade(duration: number, r: number, g: number, b: number, onComplete?: () => void): void {
    this.scene.cameras.main.fade(duration, r, g, b, false, (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
      if (progress >= 1 && onComplete) onComplete();
    });
  }

  cameraZoomPulse(targetZoom: number, duration: number, originalZoom: number): void {
    const cam = this.scene.cameras.main;
    cam.zoomTo(targetZoom, duration, 'Power2', false, (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
      if (progress >= 1) {
        cam.zoomTo(originalZoom, duration * 0.6, 'Power2');
      }
    });
  }

  // ── Per-GameObject FX (WebGL only) ──────────────────────

  applyBloom(gameObject: Phaser.GameObjects.GameObject, intensity: number = 1): Phaser.FX.Bloom | null {
    if (!this.isWebGL) return null;
    const go = gameObject as any;
    if (!go.postFX) return null;
    return go.postFX.addBloom(0xffffff, intensity, intensity, intensity, 1.2);
  }

  applyGlow(gameObject: Phaser.GameObjects.GameObject, color: number = 0xffffff, distance: number = 4, quality: number = 0.1): Phaser.FX.Glow | null {
    if (!this.isWebGL) return null;
    const go = gameObject as any;
    if (!go.preFX) return null;
    return go.preFX.addGlow(color, distance, 0, false, quality);
  }

  // ── Loot Glow by Quality ───────────────────────────────

  applyLootGlow(container: Phaser.GameObjects.Container, quality: string): void {
    const color = LOOT_COLORS[quality];
    if (!color) return;
    this.addLootBeam(container, quality, color);
    if (!this.isWebGL) return;

    // Apply glow to the first visible child (the loot bag image)
    const children = container.list as Phaser.GameObjects.GameObject[];
    for (const child of children) {
      const go = child as any;
      if (go.preFX) {
        go.preFX.addGlow(color, 6, 0, false, 0.1);
        // Legendary/set also get a shine sweep
        if (quality === 'legendary' || quality === 'set') {
          go.postFX?.addShine(0.3, 0.5, 5);
        }
        break;
      }
    }
  }

  /**
   * Ground glow for magic+ drops and a light pillar for rare+ (D2-style beam),
   * parented to the loot container so it moves/destroys with it.
   */
  private addLootBeam(container: Phaser.GameObjects.Container, quality: string, color: number): void {
    const scene = this.scene;
    if (!scene.textures.exists('fx_beam')) return;
    const big = quality === 'legendary' || quality === 'set';
    const pool = scene.add.image(0, 2, 'fx_glow').setTint(color).setBlendMode(Phaser.BlendModes.ADD)
      .setScale(big ? 0.55 : 0.4, big ? 0.24 : 0.18).setAlpha(0.7);
    const parts: Phaser.GameObjects.Image[] = [pool];
    if (quality !== 'magic') {
      const h = big ? 110 : 70;
      const beam = scene.add.image(0, 4, 'fx_beam').setOrigin(0.5, 1).setTint(color).setBlendMode(Phaser.BlendModes.ADD)
        .setScale(big ? 0.55 : 0.4, h / 256).setAlpha(big ? 0.75 : 0.55);
      const core = scene.add.image(0, 4, 'fx_beam').setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD)
        .setScale(big ? 0.18 : 0.13, (h * 0.8) / 256).setAlpha(big ? 0.7 : 0.5);
      parts.push(beam, core);
      // drop moment: pillar shoots up out of the ground
      beam.scaleY = 0; core.scaleY = 0;
      scene.tweens.add({ targets: [beam, core], scaleY: { getEnd: (t: Phaser.GameObjects.Image) => (t === beam ? h : h * 0.8) / 256 }, duration: 260, ease: 'Back.easeOut' });
      this.fx.flash(container.x, container.y - 6, color, big ? 30 : 20, 220);
      this.fx.ring(container.x, container.y, color, 4, big ? 36 : 24, 420);
      if (big) this.fx.motes(container.x, container.y - 10, 10, 'fx_spark', [color, 0xffffff], { radius: 6, speed: [20, 60], rise: 40, size: [0.2, 0.32], life: [500, 800] });
    }
    for (const p of parts) container.addAt(p, 0);
    const pulse = scene.tweens.add({
      targets: parts, alpha: '*=0.55', duration: big ? 700 : 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 280,
    });
    pool.once(Phaser.GameObjects.Events.DESTROY, () => pulse.remove());
  }

  // ── Hit Flash (Color Matrix) ────────────────────────────

  /** Flash a game object white for one frame */
  hitFlash(target: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image | Phaser.GameObjects.Container): void {
    if (!this.isWebGL) return;
    if (target instanceof Phaser.GameObjects.Container) {
      // Flash all sprite/image children in the container
      const children = target.list as Phaser.GameObjects.GameObject[];
      for (const child of children) {
        if (child instanceof Phaser.GameObjects.Sprite || child instanceof Phaser.GameObjects.Image) {
          this.hitFlash(child);
        }
      }
      return;
    }
    const fx = (target as any).preFX?.addColorMatrix();
    if (!fx) return;
    fx.brightness(1.8);
    this.scene.time.delayedCall(50, () => {
      (target as any).preFX?.remove(fx);
    });
  }

  // ── Status Effect Tints ─────────────────────────────────

  applyStatusTint(sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image, status: 'poison' | 'freeze' | 'burn'): Phaser.FX.ColorMatrix | null {
    if (!this.isWebGL) return null;
    const fx = (sprite as any).preFX?.addColorMatrix();
    if (!fx) return null;
    switch (status) {
      case 'poison': fx.hue(90); fx.saturate(0.5); break;
      case 'freeze': fx.hue(200); fx.saturate(0.8); fx.brightness(1.2); break;
      case 'burn': fx.hue(-20); fx.saturate(0.6); break;
    }
    return fx;
  }

  // ── Zone Transition (fade out, restart, fade in) ────────

  zoneTransition(callback: () => void): void {
    this.scene.cameras.main.fade(400, 0, 0, 0, false, (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
      if (progress >= 1) {
        callback();
      }
    });
  }

  // ── Melee Impact ─────────────────────────────────────────

  /**
   * Directional impact: hot core flash, flattened shock ring on the ground
   * plane, and spark streaks spraying *away* from the attacker.
   * @param angle radians, attacker → target.
   */
  impactBurst(x: number, y: number, angle: number, weight: HitWeight, color: number = 0xfff2c0): void {
    const profile = HIT_PROFILES[weight];
    if (profile.sparks <= 0 && profile.ringRadius <= 0) return;
    const e = this.fx.e;
    const r = profile.ringRadius;
    const big = weight === 'crit' || weight === 'kill';

    // Hot core + coloured bloom, pushed slightly along the blow
    const px = x + Math.cos(angle) * 3, py = y + Math.sin(angle) * 2;
    e.spawn('fx_core', px, py, big ? 140 : 100).at(IMPACT_DEPTH + 1).scale(r / 32 * 0.5, r / 32 * 1.3, 2).fade(1, 0, 0, 1.5);
    e.spawn('fx_glow', px, py, big ? 220 : 160).at(IMPACT_DEPTH).color(color).scale(r / 64 * 1.2, r / 64 * 2.6, 3).fade(0.45, 0, 0, 1.3);

    // Ground-plane shock ring (iso-flattened, under the target's feet)
    this.fx.ring(x, y + 18, color, r * 0.3, r * (big ? 1.7 : 1.25), big ? 320 : 240, { alpha: 0.9 });

    // Directional spark streaks spraying away from the attacker
    const spread = big ? 1.25 : 0.9;
    for (let i = 0; i < profile.sparks; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const speed = (big ? 220 : 160) + Math.random() * (big ? 200 : 120);
      e.spawn('fx_streak', x, y, 160 + Math.random() * 120).at(IMPACT_DEPTH + 1)
        .polar(a, speed, 0.75).damp(4).accel(0, 120).face(0, 0.3)
        .scaleXY(big ? 0.5 : 0.4, big ? 0.8 : 0.6, 0.15, 0.3).color(i % 2 === 0 ? 0xffffff : color).fade(1, 0, 0, 1.3);
    }

    // Crit/kill: four-point glint that pops over the target
    if (big) {
      const rot = angle + Math.PI / 4;
      for (let k = 0; k < 2; k++) {
        const len = (k ? 2.2 : 3.2) * r / 32;
        // two-sided thin streaks = crisp cross glint
        for (const flip of [0, Math.PI]) {
          e.spawn('fx_streak', x, y, 200).at(IMPACT_DEPTH + 2).origin(1, 0.5)
            .scaleXY(len * 0.2, 0.5, len, 0.2, 4).spinning(rot + k * Math.PI / 2 + flip).fade(1, 0, 0, 1.6);
        }
      }
    }

    if (profile.shakeMs > 0) this.cameraShake(profile.shakeMs, profile.shakeIntensity);
  }

  /**
   * Brief slow-motion beat for big kills. Scales tweens and sprite
   * animation playback only — combat timers keep running in real time.
   */
  slowMotion(durationMs: number = 260, scale: number = 0.3): void {
    const scene = this.scene;
    scene.tweens.timeScale = scale;
    scene.anims.globalTimeScale = scale;
    this.slowMoTimer?.remove(false);
    this.slowMoTimer = scene.time.delayedCall(durationMs, () => {
      this.slowMoTimer = null;
      scene.tweens.timeScale = 1;
      scene.anims.globalTimeScale = 1;
    });
  }

  // ── Particle Burst Effects (pooled FxEngine sprites) ─────

  /** Hit sparks at a world position (dodge / perfect-evade glint). */
  hitSparks(x: number, y: number, count: number = 12): void {
    this.fx.glint(x, y, 0xffffff, 34, 200);
    this.fx.sparks(x, y, count, 0xffe9a0, { speed: [80, 170], size: 0.8 });
  }

  /** Gold coins popping out and bouncing (loot/gold pickup, monster kill). */
  goldBurst(x: number, y: number, count: number = 6): void {
    const e = this.fx.e;
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const sp = 50 + Math.random() * 50;
      e.spawn('fx_coin', x, y, 420 + Math.random() * 160).normal().at(IMPACT_DEPTH - 2)
        .vel(Math.cos(a) * sp, Math.sin(a) * sp - 70).accel(0, 420)
        .scaleXY(0.9, 0.9, 0.2, 0.9).spinning(0, 0).fade(1, 0, 0, 5);
    }
    this.fx.motes(x, y - 4, Math.ceil(count / 2), 'fx_spark', [PAL.holy.core, PAL.holy.mid], { speed: [20, 50], size: [0.15, 0.25], life: [300, 500], rise: 30 });
  }

  /** Heal: green crosses and motes rising from a soft glow. */
  healBurst(x: number, y: number, count: number = 8): void {
    const P = PAL.nature;
    this.fx.glow(x, y, P.rim, 50, 420, 1.2, 0.55);
    this.fx.ring(x, y + 16, P.mid, 6, 28, 380, { alpha: 0.8 });
    this.fx.motes(x, y, Math.max(2, Math.round(count / 3)), 'fx_plus', [P.mid, P.core], { radius: 12, speed: [5, 15], rise: 60, drag: 2, size: [0.3, 0.45], life: [500, 750] });
    this.fx.motes(x, y + 6, count, 'fx_ember', [P.mid, P.rim, P.core], { radius: 14, speed: [10, 30], rise: 70, size: [0.22, 0.34], life: [450, 700], spin: 4 });
  }

  /** Monster death: a puff of dark smoke, motes of its colour, a fading soul wisp. */
  deathBurst(x: number, y: number, color: number = 0xff4444): void {
    this.fx.flash(x, y, color, 22, 170);
    this.fx.smoke(x, y + 4, 7, 0x5a5060, { radius: 12, speed: [25, 60], size: [0.4, 0.65], life: [480, 700], rise: 18, alpha: 0.8 });
    this.fx.motes(x, y, 8, 'fx_ember', [color, 0xffffff], { radius: 8, speed: [30, 70], rise: 60, size: [0.22, 0.34], life: [400, 650], spin: 5 });
    this.fx.ring(x, y + 16, color, 6, 30, 360, { alpha: 0.7 });
    this.fx.e.spawn('fx_glow', x, y - 4, 700).color(color).vel(0, -45).scaleXY(0.3, 0.42, 0.12, 0.3).fade(0.7, 0, 0.1).wait(80);
  }

  /** Level-up: golden pillar, rune circle, rising stars. */
  levelUpBurst(x: number, y: number): void {
    const P = PAL.holy;
    const gy = y + 16;
    this.fx.decal(x, gy, 'fx_rune', P.rim, 40, 1100, { add: true, alpha: 0.95, spin: 1, grow: 1.1, fadeIn: 0.08 });
    this.fx.beam(x, gy, P.mid, 150, 44, 900, { alpha: 0.85, fadeIn: 0.05 });
    this.fx.beam(x, gy, 0xffffff, 130, 14, 700, { alpha: 0.8 });
    this.fx.flash(x, y, P.mid, 36, 240);
    this.fx.shock(x, gy, P.rim, 8, 70, 520, 0.8);
    this.fx.ring(x, gy, P.mid, 10, 80, 640, { delay: 120 });
    this.fx.motes(x, y, 16, 'fx_spark', [P.core, P.mid, P.rim], { radius: 18, speed: [20, 60], rise: 90, size: [0.25, 0.45], life: [700, 1100], spin: 3 });
    this.fx.motes(x, y + 10, 10, 'fx_ember', [P.mid, P.rim], { radius: 22, speed: [10, 30], rise: 120, size: [0.25, 0.4], life: [700, 1000], spin: 4, delay: 150 });
  }

  // ── Low HP Danger Vignette ──────────────────────────────

  updateDangerVignette(hpRatio: number): void {
    if (!this.isWebGL) return;
    const cam = this.scene.cameras.main;

    if (hpRatio < 0.3 && hpRatio > 0) {
      if (!this.dangerActive) {
        this.dangerActive = true;
        // Add a red-tinted vignette that intensifies as HP drops
        this.dangerVignette = cam.postFX.addVignette(0.5, 0.5, 0.85, 0.35);
      }
      if (this.dangerVignette) {
        // Pulse the vignette strength based on HP
        const severity = 1 - (hpRatio / 0.3); // 0 at 30%, 1 at 0%
        const pulse = Math.sin(this.scene.time.now * 0.005) * 0.05;
        this.dangerVignette.strength = 0.2 + severity * 0.25 + pulse;
        this.dangerVignette.radius = 0.7 + severity * 0.15;
      }
    } else if (this.dangerActive) {
      this.dangerActive = false;
      if (this.dangerVignette) {
        cam.postFX.remove(this.dangerVignette);
        this.dangerVignette = null;
      }
    }
  }

  // ── Cleanup ─────────────────────────────────────────────

  destroy(): void {
    if (this.slowMoTimer) {
      this.slowMoTimer.remove(false);
      this.slowMoTimer = null;
      this.scene.tweens.timeScale = 1;
      this.scene.anims.globalTimeScale = 1;
    }
    EventBus.off(GameEvents.COMBAT_DAMAGE, this.handleCombatDamage);
    EventBus.off(GameEvents.PLAYER_LEVEL_UP, this.handlePlayerLevelUp);
    EventBus.off(GameEvents.PLAYER_DIED, this.handlePlayerDied);
    EventBus.off(GameEvents.ITEM_DROPPED, this.handleItemDropped);
  }
}
