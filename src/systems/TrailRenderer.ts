import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

/**
 * Render-texture based trail effects: weapon slash trails, ground scorch marks, dash ghosts.
 * Uses two RenderTextures: one for weapon trails (entity depth), one for ground marks.
 */
export class TrailRenderer {
  private scene: Phaser.Scene;
  private trailRT: Phaser.GameObjects.RenderTexture;
  private groundRT: Phaser.GameObjects.RenderTexture;
  private trailImage: Phaser.GameObjects.Image;
  private groundImage: Phaser.GameObjects.Image;
  private fadeCounter = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Weapon trail layer — between entities and UI
    this.trailRT = scene.make.renderTexture({ x: 0, y: 0, width: GAME_WIDTH, height: GAME_HEIGHT }, false);
    this.trailImage = scene.add.image(0, 0, '__DEFAULT').setOrigin(0, 0);
    this.trailImage.setTexture(this.trailRT.texture.key);
    this.trailImage.setScrollFactor(0);
    this.trailImage.setDepth(1499);
    this.trailImage.setBlendMode(Phaser.BlendModes.ADD);

    // Ground scorch layer — below entities
    this.groundRT = scene.make.renderTexture({ x: 0, y: 0, width: GAME_WIDTH, height: GAME_HEIGHT }, false);
    this.groundImage = scene.add.image(0, 0, '__DEFAULT').setOrigin(0, 0);
    this.groundImage.setTexture(this.groundRT.texture.key);
    this.groundImage.setScrollFactor(0);
    this.groundImage.setDepth(1);
    this.groundImage.setAlpha(0.7);
  }

  // ── Weapon Slash Trail ──────────────────────────────────

  stampSlash(worldX: number, worldY: number, angle: number, color: number = 0xffffff, length: number = 30): void {
    const cam = this.scene.cameras.main;
    const screenX = (worldX - cam.scrollX) * cam.zoom;
    const screenY = (worldY - cam.scrollY) * cam.zoom;

    // Draw a glowing line segment
    const g = this.scene.add.graphics();
    g.lineStyle(3, color, 0.8);
    g.beginPath();
    const dx = Math.cos(angle) * length;
    const dy = Math.sin(angle) * length;
    g.moveTo(screenX - dx, screenY - dy);
    g.lineTo(screenX + dx, screenY + dy);
    g.strokePath();

    // Glow line (thicker, transparent)
    g.lineStyle(8, color, 0.3);
    g.beginPath();
    g.moveTo(screenX - dx, screenY - dy);
    g.lineTo(screenX + dx, screenY + dy);
    g.strokePath();

    this.trailRT.draw(g);
    g.destroy();
  }

  // ── Ground Scorch Mark ──────────────────────────────────

  stampGround(worldX: number, worldY: number, type: 'fire' | 'ice' | 'lightning' = 'fire', radius: number = 20): void {
    const cam = this.scene.cameras.main;
    const screenX = (worldX - cam.scrollX) * cam.zoom;
    const screenY = (worldY - cam.scrollY) * cam.zoom;

    const colors: Record<string, number> = {
      fire: 0x331100,
      ice: 0x112233,
      lightning: 0x111133,
    };

    const g = this.scene.add.graphics();
    const r = radius * cam.zoom;
    // Scorch circle with gradient-like effect (concentric circles)
    g.fillStyle(colors[type] || 0x222222, 0.5);
    g.fillCircle(screenX, screenY, r);
    g.fillStyle(colors[type] || 0x222222, 0.3);
    g.fillCircle(screenX, screenY, r * 0.6);

    this.groundRT.draw(g);
    g.destroy();
  }

  // ── Dash Ghost Trail ────────────────────────────────────

  stampGhost(worldX: number, worldY: number, textureKey: string, alpha: number = 0.4): void {
    const cam = this.scene.cameras.main;
    const screenX = (worldX - cam.scrollX) * cam.zoom;
    const screenY = (worldY - cam.scrollY) * cam.zoom;

    if (this.scene.textures.exists(textureKey)) {
      const img = this.scene.add.image(screenX, screenY, textureKey);
      img.setAlpha(alpha);
      img.setTint(0x4444ff);
      this.trailRT.draw(img);
      img.destroy();
    }
  }

  // ── Per-Frame Fade ──────────────────────────────────────

  update(): void {
    this.fadeCounter++;
    // Weapon trails fade fast (every 2 frames)
    if (this.fadeCounter % 2 === 0) {
      this.trailRT.fill(0x000000, 0.15);
    }
    // Ground marks fade very slowly (every 10 frames)
    if (this.fadeCounter % 10 === 0) {
      this.groundRT.fill(0x000000, 0.01);
    }
  }

  // ── Cleanup ─────────────────────────────────────────────

  destroy(): void {
    this.trailRT.destroy();
    this.groundRT.destroy();
    this.trailImage.destroy();
    this.groundImage.destroy();
  }
}
