/**
 * Per-zone color palettes for visual consistency.
 *
 * Each zone defines a dominant hue (HSL), accent hues, and allowed hue range (≤30°).
 * All sprite generators (player, monster, NPC, decoration) reference these palettes
 * so that glow, rim-light, and outline colors harmonize with the zone's environment.
 *
 * The palette is indexed by MapTheme ('plains' | 'forest' | 'mountain' | 'desert' | 'abyss').
 */

import type { MapTheme } from '../data/types';

export interface ZonePaletteEntry {
  /** Dominant hue in degrees (0–360) */
  readonly dominantHue: number;
  /** Accent hue(s) */
  readonly accentHues: readonly number[];
  /** Maximum hue deviation from dominant (≤30°) */
  readonly hueRange: number;
  /** Saturation base (0–1) for glow/outline */
  readonly saturation: number;
  /** Lightness base (0–1) for glow/outline */
  readonly lightness: number;

  // Pre-computed CSS color strings for softOutline and rimLight
  /** softOutline glow color for entity sprites (rgba) */
  readonly entityOutlineColor: string;
  /** rimLight tint color for entity sprites (rgba) */
  readonly entityRimColor: string;
  /** softOutline glow color for NPC sprites (rgba) — warmer, friendlier */
  readonly npcOutlineColor: string;
  /** rimLight tint color for NPC sprites (rgba) */
  readonly npcRimColor: string;
  /** softOutline glow color for player sprites (rgba) — neutral/bright */
  readonly playerOutlineColor: string;
  /** rimLight tint color for player sprites (rgba) */
  readonly playerRimColor: string;
}

/**
 * Convert HSL (h: 0-360, s: 0-1, l: 0-1) to an rgba string with given alpha.
 */
function hslToRgba(h: number, s: number, l: number, a: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const ri = Math.round((r + m) * 255);
  const gi = Math.round((g + m) * 255);
  const bi = Math.round((b + m) * 255);
  return `rgba(${ri},${gi},${bi},${a})`;
}

function buildPalette(
  dominantHue: number,
  accentHues: number[],
  hueRange: number,
  saturation: number,
  lightness: number,
): ZonePaletteEntry {
  return {
    dominantHue,
    accentHues,
    hueRange,
    saturation,
    lightness,
    // Entity outline: zone-dominant hue at moderate saturation, low alpha
    entityOutlineColor: hslToRgba(dominantHue, saturation * 0.7, lightness * 1.2, 0.22),
    // Entity rim: zone-dominant hue, slightly lighter
    entityRimColor: hslToRgba(dominantHue, saturation * 0.6, Math.min(1, lightness * 1.5), 0.11),
    // NPC outline: warmer accent of zone
    npcOutlineColor: hslToRgba(
      accentHues.length > 0 ? accentHues[0] : dominantHue,
      saturation * 0.5,
      Math.min(1, lightness * 1.4),
      0.16,
    ),
    // NPC rim: same accent, lighter
    npcRimColor: hslToRgba(
      accentHues.length > 0 ? accentHues[0] : dominantHue,
      saturation * 0.4,
      Math.min(1, lightness * 1.6),
      0.10,
    ),
    // Player outline: neutral white-ish with slight zone tint
    playerOutlineColor: hslToRgba(dominantHue, saturation * 0.15, 0.82, 0.20),
    // Player rim: neutral cool highlight
    playerRimColor: hslToRgba(dominantHue, saturation * 0.1, 0.78, 0.10),
  };
}

/**
 * Zone palettes keyed by MapTheme.
 *
 * Hue reference (HSL wheel):
 *   0 = Red, 30 = Orange, 60 = Yellow, 120 = Green,
 *   180 = Cyan, 210 = Sky-blue, 240 = Blue, 270 = Purple, 300 = Magenta, 330 = Rose
 */
export const ZONE_PALETTES: Record<MapTheme, ZonePaletteEntry> = {
  // ── Emerald Plains: lush green (hue ~120) ──
  plains: buildPalette(120, [90, 150], 30, 0.55, 0.40),

  // ── Twilight Forest: deep blue-green / violet (hue ~260) ──
  forest: buildPalette(260, [230, 280], 25, 0.50, 0.35),

  // ── Anvil Mountains: cool grey-blue (hue ~215) ──
  mountain: buildPalette(215, [200, 230], 25, 0.30, 0.45),

  // ── Scorching Desert: warm orange-amber (hue ~30) ──
  desert: buildPalette(30, [15, 45], 25, 0.60, 0.45),

  // ── Abyss Rift: deep red-crimson (hue ~350) ──
  abyss: buildPalette(350, [330, 10], 25, 0.55, 0.30),
};

// ── Runtime zone tracking ──

let currentZonePalette: ZonePaletteEntry = ZONE_PALETTES.plains;
let currentZoneTheme: MapTheme = 'plains';

/** Set the active zone palette. Call when changing zones. */
export function setCurrentZonePalette(theme: MapTheme): void {
  currentZonePalette = ZONE_PALETTES[theme] ?? ZONE_PALETTES.plains;
  currentZoneTheme = ZONE_PALETTES[theme] ? theme : 'plains';
}

/** Theme of the active zone (drives terrain, lighting mood and colour grade). */
export function getCurrentZoneTheme(): MapTheme {
  return currentZoneTheme;
}

/**
 * Per-zone atmosphere: ambient multiply tint, screen vignette, drifting haze
 * and colour-grade parameters. Kept gentle so characters always read.
 */
export interface ZoneMood {
  /** Ambient multiply colour and strength (0 = none). */
  ambient: number;
  ambientAlpha: number;
  /** Edge vignette colour and strength at the corners. */
  vignette: number;
  vignetteAlpha: number;
  /** Additive drifting haze colour and alpha. */
  haze: number;
  hazeAlpha: number;
  /** Colour grade: saturation, contrast, shadow lift and highlight gain (RGB offsets). */
  saturation: number;
  contrast: number;
  lift: readonly [number, number, number];
  gain: readonly [number, number, number];
}

export const ZONE_MOODS: Record<MapTheme, ZoneMood> = {
  // Warm afternoon sun, golden highlights.
  plains: {
    ambient: 0xfff0d2, ambientAlpha: 0.22, vignette: 0x2e2410, vignetteAlpha: 0.32,
    haze: 0xffe6a0, hazeAlpha: 0.05,
    saturation: 1.06, contrast: 1.04, lift: [0.012, 0.008, -0.004], gain: [0.03, 0.02, -0.01],
  },
  // Cool violet dusk with teal shadows.
  forest: {
    ambient: 0x9aa6e0, ambientAlpha: 0.34, vignette: 0x120a2a, vignetteAlpha: 0.5,
    haze: 0x7a60c8, hazeAlpha: 0.07,
    saturation: 1.05, contrast: 1.05, lift: [-0.006, 0.014, 0.03], gain: [0.0, 0.02, 0.035],
  },
  // Crisp cold air, blue shadows, warm forge-lit highlights.
  mountain: {
    ambient: 0xd4def2, ambientAlpha: 0.26, vignette: 0x141c2c, vignetteAlpha: 0.4,
    haze: 0xc8dcf0, hazeAlpha: 0.06,
    saturation: 0.96, contrast: 1.06, lift: [-0.008, 0.004, 0.022], gain: [0.02, 0.012, 0.0],
  },
  // Bleaching heat: warm lift, slightly lower contrast.
  desert: {
    ambient: 0xffe2b0, ambientAlpha: 0.24, vignette: 0x3a200c, vignetteAlpha: 0.34,
    haze: 0xffd890, hazeAlpha: 0.06,
    saturation: 1.04, contrast: 1.02, lift: [0.02, 0.01, -0.006], gain: [0.03, 0.016, -0.014],
  },
  // Smouldering crimson dark.
  abyss: {
    ambient: 0xb07896, ambientAlpha: 0.4, vignette: 0x1a0010, vignetteAlpha: 0.58,
    haze: 0xff3050, hazeAlpha: 0.06,
    saturation: 1.1, contrast: 1.07, lift: [0.024, -0.004, 0.012], gain: [0.03, 0.0, 0.0],
  },
};

export function getCurrentZoneMood(): ZoneMood {
  return ZONE_MOODS[currentZoneTheme] ?? ZONE_MOODS.plains;
}

/** Get the active zone palette for sprite generation. */
export function getCurrentZonePalette(): ZonePaletteEntry {
  return currentZonePalette;
}

// ── Outline weight standardization ──

/**
 * Compute standardized outline blur for an entity sprite.
 * Weight is proportional to sprite size: roughly 8% of the average of width & height,
 * clamped to [3, 7]. Accepts scaled dimensions (after TEXTURE_SCALE).
 *
 * @param w - Scaled frame width of the sprite
 * @param h - Scaled frame height of the sprite
 * @returns Blur value (pixels)
 */
export function standardOutlineBlur(w: number, h: number): number {
  const avg = (w + h) / 2;
  // avg is typically 120-230 (scaled). 8% of that = 9.6-18.4, then /3 for blur → 3.2-6.1
  return Math.max(3, Math.min(7, Math.round(avg * 0.028)));
}
