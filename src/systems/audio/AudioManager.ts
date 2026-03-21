/**
 * AudioManager — coordinator and public API for the audio subsystem.
 *
 * Owns the AudioContext, master gain nodes, and all sub-engines.
 * Replaces the old `audioSystem` singleton.
 *
 * Responsibilities:
 *   - Lazy AudioContext init on first user interaction (getCtx())
 *   - Master musicGain + sfxGain nodes routed to ctx.destination
 *   - Instantiates SFXEngine, MusicEngine, AudioLoader
 *   - Wires all EventBus listeners
 *   - Persists/loads settings via localStorage key 'abyssfire_audio'
 */

import { EventBus, GameEvents } from '../../utils/EventBus';
import { AudioLoader } from './AudioLoader';
import { MusicEngine } from './MusicEngine';
import { SFXEngine } from './SFXEngine';
import type { AudioSettings, SFXType } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'abyssfire_audio';

const DEFAULT_SETTINGS: AudioSettings = {
  bgmVolume: 0.15,
  sfxVolume: 0.3,
  bgmMuted: false,
  sfxMuted: false,
};

// ---------------------------------------------------------------------------
// AudioManager
// ---------------------------------------------------------------------------

export class AudioManager {
  private static readonly MUSIC_STATES = ['explore', 'combat', 'victory'] as const;

  // Lazy-initialised — null until first getCtx() call.
  private ctx: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private loader: AudioLoader;
  private musicEngine: MusicEngine;
  private sfxEngine: SFXEngine;

  private settings: AudioSettings;
  private zoneMusicRequestId = 0;

  constructor() {
    this.loader = new AudioLoader();
    this.musicEngine = new MusicEngine(this.loader);
    this.sfxEngine = new SFXEngine(this.loader);

    this.settings = this.loadSettings();
    this.setupEventListeners();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** Resume AudioContext — call on user gesture to unblock browser autoplay policy. */
  ensureContext(): void {
    this.getCtx();
  }

  /** Play a sound effect through the sfxGain node (no-op if muted). */
  playSFX(type: SFXType): void {
    if (this.settings.sfxMuted) return;
    const ctx = this.getCtx();
    if (!this.sfxGain) return;
    this.sfxEngine.play(ctx, this.sfxGain, type);
  }

  /** Set BGM volume (0–1). Updates gain node and persists. */
  setMusicVolume(v: number): void {
    this.settings.bgmVolume = Math.max(0, Math.min(1, v));
    if (this.musicGain && !this.settings.bgmMuted) {
      this.musicGain.gain.value = this.settings.bgmVolume;
    }
    this.saveSettings();
  }

  /** Set SFX volume (0–1). Updates gain node and persists. */
  setSFXVolume(v: number): void {
    this.settings.sfxVolume = Math.max(0, Math.min(1, v));
    if (this.sfxGain && !this.settings.sfxMuted) {
      this.sfxGain.gain.value = this.settings.sfxVolume;
    }
    this.saveSettings();
  }

  /** Toggle BGM mute. Persists. */
  toggleMusicMute(): void {
    this.settings.bgmMuted = !this.settings.bgmMuted;
    if (this.musicGain) {
      this.musicGain.gain.value = this.settings.bgmMuted ? 0 : this.settings.bgmVolume;
    }
    this.saveSettings();
  }

  /** Toggle SFX mute. Persists. */
  toggleSFXMute(): void {
    this.settings.sfxMuted = !this.settings.sfxMuted;
    if (this.sfxGain) {
      this.sfxGain.gain.value = this.settings.sfxMuted ? 0 : this.settings.sfxVolume;
    }
    this.saveSettings();
  }

  /** Return a shallow copy of current settings. */
  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  /** Return the AudioLoader instance (for BootScene to decode audio into). */
  getLoader(): AudioLoader {
    return this.loader;
  }

  // ---------------------------------------------------------------------------
  // AudioContext — lazy init
  // ---------------------------------------------------------------------------

  /**
   * Returns the AudioContext, creating it on first call.
   * Also creates the master gain nodes and resumes a suspended context.
   */
  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();

      // Music master gain.
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.settings.bgmMuted ? 0 : this.settings.bgmVolume;
      this.musicGain.connect(this.ctx.destination);

      // SFX master gain.
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.settings.sfxMuted ? 0 : this.settings.sfxVolume;
      this.sfxGain.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      // Fire-and-forget resume — subsequent calls will retry if still suspended.
      this.ctx.resume().catch(() => { /* ignore */ });
    }

    return this.ctx;
  }

  // ---------------------------------------------------------------------------
  // EventBus wiring
  // ---------------------------------------------------------------------------

  private setupEventListeners(): void {
    // --- Combat ---
    EventBus.on(GameEvents.COMBAT_DAMAGE, (payload: { isDodged?: boolean; isCrit?: boolean }) => {
      if (payload?.isDodged) {
        this.playSFX('miss');
      } else if (payload?.isCrit) {
        this.playSFX('crit');
      } else {
        this.playSFX('hit');
      }
    });

    // --- Player progression ---
    EventBus.on(GameEvents.PLAYER_LEVEL_UP, () => {
      this.playSFX('levelup');
    });

    EventBus.on(GameEvents.PLAYER_DIED, () => {
      this.playSFX('player_death');
    });

    // --- Monsters ---
    EventBus.on(GameEvents.MONSTER_DIED, () => {
      this.playSFX('monster_death');
    });

    // --- Loot ---
    EventBus.on(GameEvents.ITEM_PICKED, (payload: { item?: { quality?: string } }) => {
      switch (payload?.item?.quality) {
        case 'magic':
          this.playSFX('loot_magic');
          break;
        case 'rare':
          this.playSFX('loot_rare');
          break;
        case 'legendary':
        case 'set':
          this.playSFX('loot_legendary');
          break;
        default:
          this.playSFX('loot_common');
          break;
      }
    });

    // --- Skills ---
    EventBus.on(GameEvents.SKILL_USED, (payload: { damageType?: string }) => {
      switch (payload?.damageType) {
        case 'fire':
          this.playSFX('skill_fire');
          break;
        case 'ice':
          this.playSFX('skill_ice');
          break;
        case 'lightning':
          this.playSFX('skill_lightning');
          break;
        case 'arcane':
        case 'poison':
          this.playSFX('skill_buff');
          break;
        default:
          this.playSFX('skill_melee');
          break;
      }
    });

    // --- Zone / Music ---
    EventBus.on(GameEvents.ZONE_ENTERED, (payload: { mapId?: string }) => {
      if (!payload?.mapId) return;
      const ctx = this.getCtx();
      if (!this.musicGain) return;
      this.musicEngine.setZone(ctx, this.musicGain, payload.mapId);
      void this.loadZoneMusicBuffers(payload.mapId, ctx);
    });

    EventBus.on(GameEvents.COMBAT_STATE_CHANGED, (payload: { inCombat?: boolean }) => {
      const ctx = this.getCtx();
      if (!this.musicGain) return;
      if (payload?.inCombat) {
        this.musicEngine.setState(ctx, this.musicGain, 'combat');
      } else {
        this.musicEngine.setState(ctx, this.musicGain, 'explore');
      }
    });

    // --- Quests ---
    EventBus.on(GameEvents.QUEST_COMPLETED, () => {
      this.playSFX('quest_complete');
    });

    EventBus.on(GameEvents.QUEST_ACCEPTED, () => {
      this.playSFX('npc_interact');
    });

    EventBus.on(GameEvents.QUEST_TURNED_IN, () => {
      this.playSFX('quest_complete');
    });

    // --- NPC / UI panels ---
    EventBus.on(GameEvents.NPC_INTERACT, () => {
      this.playSFX('npc_interact');
    });

    EventBus.on(GameEvents.SHOP_OPEN, () => {
      this.playSFX('panel_open');
    });

    EventBus.on(GameEvents.INVENTORY_OPEN, () => {
      this.playSFX('panel_open');
    });

    EventBus.on(GameEvents.INVENTORY_CLOSE, () => {
      this.playSFX('panel_close');
    });

    EventBus.on(GameEvents.UI_TOGGLE_PANEL, () => {
      this.playSFX('click');
    });
  }

  // ---------------------------------------------------------------------------
  // Settings persistence
  // ---------------------------------------------------------------------------

  private loadSettings(): AudioSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AudioSettings>;
        return {
          bgmVolume: typeof parsed.bgmVolume === 'number' ? parsed.bgmVolume : DEFAULT_SETTINGS.bgmVolume,
          sfxVolume: typeof parsed.sfxVolume === 'number' ? parsed.sfxVolume : DEFAULT_SETTINGS.sfxVolume,
          bgmMuted:  typeof parsed.bgmMuted  === 'boolean' ? parsed.bgmMuted  : DEFAULT_SETTINGS.bgmMuted,
          sfxMuted:  typeof parsed.sfxMuted  === 'boolean' ? parsed.sfxMuted  : DEFAULT_SETTINGS.sfxMuted,
        };
      }
    } catch (_) {
      // Ignore parse errors — fall through to defaults.
    }
    return { ...DEFAULT_SETTINGS };
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch (_) {
      // Quota exceeded or private browsing — silently ignore.
    }
  }

  private async loadZoneMusicBuffers(zoneId: string, ctx: AudioContext): Promise<void> {
    const requestId = ++this.zoneMusicRequestId;
    const keepKeys = new Set(
      AudioManager.MUSIC_STATES.map((state) => `bgm_${zoneId}_${state}`)
    );

    // Keep only the current zone's music in memory.
    this.loader.releaseMatching((key) => key.startsWith('bgm_') && !keepKeys.has(key));

    await Promise.all(
      AudioManager.MUSIC_STATES.map(async (state) => {
        const key = `bgm_${zoneId}_${state}`;
        const url = `${import.meta.env.BASE_URL}assets/audio/bgm/${zoneId}_${state}.mp3`;
        await this.loader.loadAudioFromUrl(ctx, key, url);
      }),
    );

    if (requestId !== this.zoneMusicRequestId) return;
    if (!this.ctx || !this.musicGain) return;

    this.musicEngine.refresh(this.ctx, this.musicGain);
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const audioManager = new AudioManager();
