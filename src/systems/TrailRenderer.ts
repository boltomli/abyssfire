import Phaser from 'phaser';
import { FxEngine } from '../graphics/vfx/FxEngine';
import { FxKit } from '../graphics/vfx/FxKit';

/**
 * Weapon slash trails, ground scorch marks and dash ghosts.
 *
 * Everything is a pooled world-space sprite from FxEngine, so marks stay
 * pinned to the ground while the camera moves and cost nothing when idle
 * (the old version redrew two full-screen RenderTextures every frame).
 */
export class TrailRenderer {
  private fx: FxKit;

  constructor(scene: Phaser.Scene) {
    this.fx = new FxKit(FxEngine.for(scene));
  }

  // ── Weapon Slash Trail ──────────────────────────────────

  stampSlash(worldX: number, worldY: number, angle: number, color: number = 0xffffff, length: number = 30): void {
    const e = this.fx.e;
    const k = length / 30;
    // thin lens-shaped smear along the swing + faint wide afterglow
    e.spawn('fx_streak', worldX + Math.cos(angle) * 6 * k, worldY + Math.sin(angle) * 3 * k, 170)
      .color(color).spinning(angle).scaleXY(1.1 * k, 1.1, 1.3 * k, 0.3, 2).fade(0.85, 0, 0, 1.4);
    e.spawn('fx_streak', worldX, worldY, 220)
      .color(color).spinning(angle).scaleXY(1.2 * k, 2.4, 1.4 * k, 1.2, 2).fade(0.25, 0);
  }

  // ── Ground Scorch Mark ──────────────────────────────────

  stampGround(worldX: number, worldY: number, type: 'fire' | 'ice' | 'lightning' = 'fire', radius: number = 20): void {
    if (type === 'ice') {
      this.fx.decal(worldX, worldY, 'fx_frost', 0xffffff, radius * 0.9, 1600, { alpha: 0.6 });
    } else if (type === 'lightning') {
      this.fx.decal(worldX, worldY, 'fx_scorch', 0x9a9ab8, radius * 0.7, 1400, { alpha: 0.5 });
      this.fx.decal(worldX, worldY, 'fx_crack_glow', 0x8c8cff, radius * 0.8, 360, { add: true, alpha: 0.9, pow: 1.5 });
    } else {
      this.fx.decal(worldX, worldY, 'fx_scorch', 0xffffff, radius * 0.8, 1800, { alpha: 0.6 });
      this.fx.decal(worldX, worldY, 'fx_glow', 0xff6a1a, radius * 0.6, 500, { add: true, alpha: 0.5 });
    }
  }

  // ── Dash Ghost Trail ────────────────────────────────────

  stampGhost(
    worldX: number,
    worldY: number,
    textureKey: string,
    options: {
      frame?: string | number;
      alpha?: number;
      tint?: number;
      scaleX?: number;
      scaleY?: number;
      flipX?: boolean;
      angle?: number;
    } = {},
  ): void {
    const e = this.fx.e;
    if (!e.scene.textures.exists(textureKey)) return;
    const sx = (options.scaleX ?? 1) * (options.flipX ? -1 : 1);
    const sy = options.scaleY ?? options.scaleX ?? 1;
    e.spawn(textureKey, worldX, worldY, 260, options.frame ?? 0)
      .color(options.tint ?? 0x4444ff).world(120)
      .scaleXY(sx, sy, sx * 1.04, sy * 1.02).spinning(Phaser.Math.DegToRad(options.angle ?? 0))
      .fade(options.alpha ?? 0.4, 0, 0, 1.3).add();
  }

  // ── Per-Frame Fade ──────────────────────────────────────

  /** Kept for API compatibility; FxEngine animates the marks itself. */
  update(): void { /* no-op */ }

  // ── Cleanup ─────────────────────────────────────────────

  /** Pooled sprites belong to the scene's FxEngine and are released on shutdown. */
  destroy(): void { /* no-op */ }
}
