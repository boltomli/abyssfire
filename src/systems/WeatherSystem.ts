import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import type { RenderQualityProfile } from '../rendering/RenderQuality';
import type { MapTheme } from '../data/types';
import { getCurrentZoneTheme } from '../graphics/ZonePalette';

interface WeatherConfig {
  type: 'rain' | 'snow' | 'ember_storm' | 'ash' | 'sand' | 'none';
  /** Per-zone environmental ambience particles */
  ambience?: 'fireflies' | 'dust_motes' | 'sparks' | 'bubbles' | 'wisps' | 'pollen';
  /** Tint for dust-like ambience */
  tint?: number;
}

const ZONE_WEATHER: Record<string, WeatherConfig> = {
  emerald_plains:   { type: 'none', ambience: 'pollen', tint: 0xffe8a0 },
  twilight_forest:  { type: 'none', ambience: 'wisps' },
  anvil_mountains:  { type: 'snow', ambience: 'dust_motes', tint: 0xdce8f4 },
  scorching_desert: { type: 'sand', ambience: 'dust_motes', tint: 0xf0d8a8 },
  abyss_rift:       { type: 'ember_storm', ambience: 'sparks' },
};

/** Theme fallback for sub-dungeons / dungeon floors. */
const THEME_WEATHER: Record<MapTheme, string> = {
  plains: 'emerald_plains',
  forest: 'twilight_forest',
  mountain: 'anvil_mountains',
  desert: 'scorching_desert',
  abyss: 'abyss_rift',
};

export class WeatherSystem {
  private scene: Phaser.Scene;
  private readonly quality: RenderQualityProfile;
  private weatherEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private ambienceEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;

  constructor(scene: Phaser.Scene, quality: RenderQualityProfile) {
    this.scene = scene;
    this.quality = quality;
  }

  private frequency(base: number): number {
    return Math.round(base * this.quality.particleFrequencyMultiplier);
  }

  setZone(zoneId: string): void {
    this.cleanup();
    const config = ZONE_WEATHER[zoneId] ?? ZONE_WEATHER[THEME_WEATHER[getCurrentZoneTheme()]];
    if (!config) return;

    if (config.type !== 'none') {
      this.createWeather(config.type);
    }
    if (config.ambience) {
      this.createAmbience(config.ambience, config.tint);
    }
  }

  private createWeather(type: string): void {
    switch (type) {
      case 'rain': this.createRain(); break;
      case 'snow': this.createSnow(); break;
      case 'ember_storm': this.createEmberStorm(); break;
      case 'ash': this.createAsh(); break;
      case 'sand': this.createSand(); break;
    }
  }

  private createSand(): void {
    this.ensureTexture('sand_streak', (g) => {
      g.fillStyle(0xf2dcae, 0.8);
      g.fillRect(0, 1, 10, 1);
      g.fillStyle(0xffffff, 0.4);
      g.fillRect(3, 0, 5, 1);
    }, 10, 3);

    this.weatherEmitter = this.scene.add.particles(0, 0, 'sand_streak', {
      x: -30,
      y: { min: -20, max: GAME_HEIGHT },
      lifespan: { min: 2200, max: 3600 },
      speedX: { min: 380, max: 560 },
      speedY: { min: 10, max: 40 },
      scale: { min: 0.8, max: 1.6 },
      alpha: { start: 0.35, end: 0 },
      frequency: this.frequency(90),
      quantity: 1,
    });
    this.weatherEmitter.setScrollFactor(0);
    this.weatherEmitter.setDepth(997);
  }

  private createRain(): void {
    this.ensureTexture('rain_drop', (g) => {
      g.fillStyle(0xaabbdd, 0.6);
      g.fillRect(0, 0, 2, 8);
      g.fillStyle(0xccddff, 0.3);
      g.fillRect(0, 0, 1, 8);
    }, 2, 8);

    this.weatherEmitter = this.scene.add.particles(0, 0, 'rain_drop', {
      x: { min: -200, max: GAME_WIDTH + 200 },
      y: -20,
      lifespan: { min: 400, max: 700 },
      speedY: { min: 400, max: 600 },
      speedX: { min: -30, max: -80 },
      angle: { min: 170, max: 180 },
      scale: { min: 0.8, max: 1.2 },
      alpha: { start: 0.5, end: 0.1 },
      frequency: this.frequency(8),
      quantity: 3,
      blendMode: Phaser.BlendModes.ADD,
    });
    this.weatherEmitter.setScrollFactor(0);
    this.weatherEmitter.setDepth(997);
  }

  private createSnow(): void {
    this.ensureTexture('snowflake', (g) => {
      g.fillStyle(0xffffff, 0.8);
      g.fillCircle(3, 3, 3);
      g.fillStyle(0xffffff, 0.4);
      g.fillCircle(3, 3, 2);
    }, 6, 6);

    this.weatherEmitter = this.scene.add.particles(0, 0, 'snowflake', {
      x: { min: -100, max: GAME_WIDTH + 100 },
      y: -10,
      lifespan: { min: 4000, max: 8000 },
      speedY: { min: 20, max: 50 },
      speedX: { min: -15, max: 15 },
      scale: { start: 0.3, end: 0.6 },
      alpha: { start: 0.7, end: 0 },
      frequency: this.frequency(200),
      quantity: 1,
      rotate: { min: 0, max: 360 },
    });
    this.weatherEmitter.setScrollFactor(0);
    this.weatherEmitter.setDepth(997);
  }

  private createEmberStorm(): void {
    this.weatherEmitter = this.scene.add.particles(0, 0, 'particle_flame', {
      x: { min: -100, max: GAME_WIDTH + 100 },
      y: GAME_HEIGHT + 20,
      lifespan: { min: 3000, max: 6000 },
      speedY: { min: -30, max: -80 },
      speedX: { min: -20, max: 20 },
      scale: { start: 0.4, end: 0.1 },
      alpha: { start: 0.7, end: 0 },
      tint: [0xff4400, 0xff6600, 0xff8800, 0xffaa00],
      frequency: this.frequency(150),
      quantity: 1,
      blendMode: Phaser.BlendModes.ADD,
      rotate: { min: 0, max: 360 },
    });
    this.weatherEmitter.setScrollFactor(0);
    this.weatherEmitter.setDepth(997);
  }

  private createAsh(): void {
    this.ensureTexture('ash_particle', (g) => {
      g.fillStyle(0x888888, 0.4);
      g.fillCircle(2, 2, 2);
      g.fillStyle(0xaaaaaa, 0.2);
      g.fillCircle(2, 2, 1.5);
    }, 4, 4);

    this.weatherEmitter = this.scene.add.particles(0, 0, 'ash_particle', {
      x: { min: -100, max: GAME_WIDTH + 100 },
      y: { min: -20, max: GAME_HEIGHT },
      lifespan: { min: 5000, max: 10000 },
      speedY: { min: 5, max: 15 },
      speedX: { min: -10, max: 10 },
      scale: { start: 0.5, end: 1.0 },
      alpha: { start: 0.3, end: 0 },
      frequency: this.frequency(400),
      quantity: 1,
    });
    this.weatherEmitter.setScrollFactor(0);
    this.weatherEmitter.setDepth(997);
  }

  // ── Environmental Ambience ──────────────────────────────

  private createAmbience(type: string, tint?: number): void {
    switch (type) {
      case 'fireflies': this.createFireflies(); break;
      case 'dust_motes': this.createDustMotes(tint); break;
      case 'pollen': this.createDustMotes(tint ?? 0xffe8a0, true); break;
      case 'sparks': this.createSparks(); break;
      case 'wisps': this.createWisps(); break;
    }
  }

  /** Bioluminescent motes (twilight forest): slow drifting cyan / violet glows. */
  private createWisps(): void {
    this.ensureTexture('wisp', (g) => {
      g.fillStyle(0xffffff, 0.25);
      g.fillCircle(4, 4, 4);
      g.fillStyle(0xffffff, 0.55);
      g.fillCircle(4, 4, 2.4);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(4, 4, 1.2);
    }, 8, 8);

    this.ambienceEmitter = this.scene.add.particles(0, 0, 'wisp', {
      x: { min: -GAME_WIDTH, max: GAME_WIDTH * 2 },
      y: { min: -GAME_HEIGHT, max: GAME_HEIGHT * 2 },
      lifespan: { min: 4000, max: 7000 },
      speed: { min: 3, max: 12 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.55, end: 0.25 },
      alpha: { start: 0.8, end: 0 },
      tint: [0x7ff5e6, 0xc9a2ff, 0x9ad0ff],
      frequency: this.frequency(260),
      quantity: 1,
      blendMode: Phaser.BlendModes.ADD,
    });
    this.ambienceEmitter.setScrollFactor(0.5);
    this.ambienceEmitter.setDepth(996);
  }

  private createFireflies(): void {
    this.ensureTexture('firefly', (g) => {
      g.fillStyle(0xccff66, 0.9);
      g.fillCircle(3, 3, 3);
      g.fillStyle(0xeeff88, 0.5);
      g.fillCircle(3, 3, 2);
      g.fillStyle(0xffffff, 0.3);
      g.fillCircle(3, 3, 1);
    }, 6, 6);

    this.ambienceEmitter = this.scene.add.particles(0, 0, 'firefly', {
      x: { min: -GAME_WIDTH, max: GAME_WIDTH * 2 },
      y: { min: -GAME_HEIGHT, max: GAME_HEIGHT * 2 },
      lifespan: { min: 3000, max: 6000 },
      speed: { min: 3, max: 10 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.5, end: 0.3 },
      alpha: { start: 0.7, end: 0 },
      frequency: this.frequency(500),
      quantity: 1,
      blendMode: Phaser.BlendModes.ADD,
    });
    this.ambienceEmitter.setScrollFactor(0.5);
    this.ambienceEmitter.setDepth(996);
  }

  private createDustMotes(tint = 0xccbb99, bright = false): void {
    this.ambienceEmitter = this.scene.add.particles(0, 0, 'particle_circle', {
      x: { min: -GAME_WIDTH, max: GAME_WIDTH * 2 },
      y: { min: -GAME_HEIGHT, max: GAME_HEIGHT * 2 },
      lifespan: { min: 8000, max: 14000 },
      speed: { min: 1, max: 5 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.5, end: 0.8 },
      alpha: { start: bright ? 0.35 : 0.14, end: 0 },
      tint,
      frequency: this.frequency(bright ? 420 : 600),
      quantity: 1,
      blendMode: bright ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL,
    });
    this.ambienceEmitter.setScrollFactor(0.3);
    this.ambienceEmitter.setDepth(996);
  }

  private createSparks(): void {
    this.ambienceEmitter = this.scene.add.particles(0, 0, 'particle_spark', {
      x: { min: -GAME_WIDTH, max: GAME_WIDTH * 2 },
      y: { min: -GAME_HEIGHT, max: GAME_HEIGHT * 2 },
      lifespan: { min: 1500, max: 3000 },
      speed: { min: 5, max: 20 },
      angle: { min: 240, max: 300 },
      scale: { start: 0.4, end: 0.1 },
      alpha: { start: 0.6, end: 0 },
      tint: [0xff6600, 0xff8800, 0xffaa00],
      frequency: this.frequency(800),
      quantity: 1,
      blendMode: Phaser.BlendModes.ADD,
      gravityY: -20,
    });
    this.ambienceEmitter.setScrollFactor(0.4);
    this.ambienceEmitter.setDepth(996);
  }

  // ── Texture Generation Helper ───────────────────────────

  private ensureTexture(key: string, draw: (g: Phaser.GameObjects.Graphics) => void, w: number, h: number): void {
    if (this.scene.textures.exists(key)) return;
    const g = this.scene.add.graphics();
    g.clear();
    draw(g);
    g.generateTexture(key, w, h);
    g.destroy();
  }

  // ── Cleanup ─────────────────────────────────────────────

  cleanup(): void {
    if (this.weatherEmitter) {
      this.weatherEmitter.destroy();
      this.weatherEmitter = null;
    }
    if (this.ambienceEmitter) {
      this.ambienceEmitter.destroy();
      this.ambienceEmitter = null;
    }
  }

  destroy(): void {
    this.cleanup();
  }
}
