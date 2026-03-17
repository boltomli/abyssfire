import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

export interface LightSource {
  /** World position x */
  x: number;
  /** World position y */
  y: number;
  /** Light radius in pixels */
  radius: number;
  /** Light color as 0xRRGGBB */
  color: number;
  /** Intensity 0-1 */
  intensity: number;
  /** Whether this light flickers */
  flicker?: boolean;
  /** Unique ID for removal */
  id?: string;
}

interface ZoneAmbient {
  color: number;
  alpha: number;
  /** Optional secondary tint color for atmosphere */
  fogColor?: number;
  fogAlpha?: number;
}

const ZONE_AMBIENTS: Record<string, ZoneAmbient> = {
  emerald_plains:    { color: 0x040610, alpha: 0.10, fogColor: 0x112211, fogAlpha: 0.03 },
  twilight_forest:   { color: 0x020408, alpha: 0.22, fogColor: 0x0a1010, fogAlpha: 0.05 },
  anvil_mountains:   { color: 0x080608, alpha: 0.18, fogColor: 0x100808, fogAlpha: 0.04 },
  scorching_desert:  { color: 0x0c0804, alpha: 0.08, fogColor: 0x120e04, fogAlpha: 0.02 },
  abyss_rift:        { color: 0x040004, alpha: 0.32, fogColor: 0x100010, fogAlpha: 0.06 },
};

export class LightingSystem {
  private scene: Phaser.Scene;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private overlay: Phaser.GameObjects.Image;
  private lights: LightSource[] = [];
  private ambientColor: number = 0x040610;
  private ambientAlpha: number = 0.35;
  private fogColor: number = 0x111111;
  private fogAlpha: number = 0.03;
  private time: number = 0;

  // Pre-computed flicker seeds per light (for organic feel)
  private flickerSeeds: Map<string, number> = new Map();

  // Render at half resolution for soft look + performance
  private readonly renderW: number;
  private readonly renderH: number;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.renderW = Math.ceil(GAME_WIDTH / 2);
    this.renderH = Math.ceil(GAME_HEIGHT / 2);

    this.canvas = document.createElement('canvas');
    this.canvas.width = this.renderW;
    this.canvas.height = this.renderH;
    this.ctx = this.canvas.getContext('2d')!;

    // Create overlay texture and image
    const texKey = 'lighting_overlay';
    if (scene.textures.exists(texKey)) scene.textures.remove(texKey);
    scene.textures.addCanvas(texKey, this.canvas);
    this.overlay = scene.add.image(0, 0, texKey);
    this.overlay.setOrigin(0, 0);
    this.overlay.setScrollFactor(0);
    this.overlay.setScale(2);
    this.overlay.setDepth(999);
    this.overlay.setBlendMode(Phaser.BlendModes.MULTIPLY);
  }

  setZone(zoneId: string): void {
    const ambient = ZONE_AMBIENTS[zoneId];
    if (ambient) {
      this.ambientColor = ambient.color;
      this.ambientAlpha = ambient.alpha;
      this.fogColor = ambient.fogColor ?? 0x111111;
      this.fogAlpha = ambient.fogAlpha ?? 0.03;
    }
  }

  addLight(light: LightSource): void {
    this.lights.push(light);
    if (light.id && light.flicker) {
      this.flickerSeeds.set(light.id, Math.random() * 1000);
    }
  }

  removeLight(id: string): void {
    this.lights = this.lights.filter(l => l.id !== id);
    this.flickerSeeds.delete(id);
  }

  clearLights(): void {
    this.lights = [];
    this.flickerSeeds.clear();
  }

  update(delta: number): void {
    this.time += delta;
    const ctx = this.ctx;
    const w = this.renderW;
    const h = this.renderH;
    const cam = this.scene.cameras.main;

    // Fill with ambient darkness
    const ar = (this.ambientColor >> 16) & 0xff;
    const ag = (this.ambientColor >> 8) & 0xff;
    const ab = this.ambientColor & 0xff;

    // Subtle ambient pulse (breathing effect)
    const breathe = Math.sin(this.time * 0.0015) * 0.015;
    const effectiveAlpha = Math.max(0, Math.min(1, this.ambientAlpha + breathe));

    // Base ambient: lerp from white toward ambient color based on alpha
    const baseR = Math.round(255 - (255 - ar) * effectiveAlpha);
    const baseG = Math.round(255 - (255 - ag) * effectiveAlpha);
    const baseB = Math.round(255 - (255 - ab) * effectiveAlpha);

    ctx.fillStyle = `rgb(${baseR},${baseG},${baseB})`;
    ctx.fillRect(0, 0, w, h);

    // Subtle fog overlay for atmosphere
    if (this.fogAlpha > 0) {
      const fr = (this.fogColor >> 16) & 0xff;
      const fg = (this.fogColor >> 8) & 0xff;
      const fb = this.fogColor & 0xff;
      const fogPhase = this.time * 0.0008;
      const fogX = Math.sin(fogPhase) * w * 0.15;
      const fogY = Math.cos(fogPhase * 0.7) * h * 0.1;
      const fogGrad = ctx.createRadialGradient(
        w / 2 + fogX, h / 2 + fogY, 0,
        w / 2 + fogX, h / 2 + fogY, w * 0.6,
      );
      fogGrad.addColorStop(0, `rgba(${fr},${fg},${fb},0)`);
      fogGrad.addColorStop(0.5, `rgba(${fr},${fg},${fb},${this.fogAlpha})`);
      fogGrad.addColorStop(1, `rgba(${fr},${fg},${fb},0)`);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = fogGrad;
      ctx.fillRect(0, 0, w, h);
    }

    // Punch light holes using 'lighter' composite (additive)
    ctx.globalCompositeOperation = 'lighter';

    for (const light of this.lights) {
      // Convert world position to screen position at half resolution
      const screenX = (light.x - cam.scrollX) * cam.zoom / 2;
      const screenY = (light.y - cam.scrollY) * cam.zoom / 2;
      const radius = light.radius * cam.zoom / 2;

      // Skip if off-screen
      if (screenX + radius < 0 || screenX - radius > w ||
          screenY + radius < 0 || screenY - radius > h) continue;

      // Organic flicker with occasional bright pops
      let intensity = light.intensity;
      if (light.flicker) {
        const seed = this.flickerSeeds.get(light.id ?? '') ?? 0;
        const t = this.time;
        // Multi-frequency oscillation for organic feel
        const f1 = Math.sin(t * 0.007 + seed) * 0.05;
        const f2 = Math.sin(t * 0.013 + seed * 2.3) * 0.03;
        const f3 = Math.sin(t * 0.031 + seed * 0.7) * 0.02;
        // Occasional bright pop
        const pop = Math.sin(t * 0.0037 + seed * 1.7);
        const popIntensity = pop > 0.92 ? (pop - 0.92) * 1.5 : 0;
        intensity = Math.max(0, Math.min(1, intensity + f1 + f2 + f3 + popIntensity));
      }

      const lr = (light.color >> 16) & 0xff;
      const lg = (light.color >> 8) & 0xff;
      const lb = light.color & 0xff;

      // The additive amount needed to bring ambient back toward full brightness
      const addR = Math.round((255 - baseR) * intensity * lr / 255);
      const addG = Math.round((255 - baseG) * intensity * lg / 255);
      const addB = Math.round((255 - baseB) * intensity * lb / 255);

      // Smoother 5-stop gradient for better light falloff
      const grad = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, radius);
      grad.addColorStop(0, `rgb(${addR},${addG},${addB})`);
      grad.addColorStop(0.15, `rgb(${addR * 0.9 | 0},${addG * 0.9 | 0},${addB * 0.9 | 0})`);
      grad.addColorStop(0.4, `rgb(${addR * 0.6 | 0},${addG * 0.6 | 0},${addB * 0.6 | 0})`);
      grad.addColorStop(0.7, `rgb(${addR * 0.25 | 0},${addG * 0.25 | 0},${addB * 0.25 | 0})`);
      grad.addColorStop(1, 'rgb(0,0,0)');

      ctx.fillStyle = grad;
      ctx.fillRect(screenX - radius, screenY - radius, radius * 2, radius * 2);
    }

    ctx.globalCompositeOperation = 'source-over';

    // Update the texture — force Phaser to re-read the canvas
    const tex = this.scene.textures.get('lighting_overlay');
    if (tex) {
      const src = tex.source[0];
      if (src) src.update();
    }
  }

  destroy(): void {
    this.overlay?.destroy();
    this.lights = [];
    this.flickerSeeds.clear();
  }
}
