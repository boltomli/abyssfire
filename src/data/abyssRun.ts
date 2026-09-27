/**
 * Abyss Labyrinth (Zone 6) run content: boons, floor curses and floor themes.
 *
 * All player-facing text is i18n: `dungeon.boon.<id>.name/.desc`,
 * `dungeon.curse.<id>.name/.desc`, `dungeon.theme.<id>`.
 */
import type { EquipStats } from '../systems/CombatSystem';
import type { MapTheme } from './types';

// ── Boons (深渊恩赐): pick one of three after each floor; they last the run ──

export type BoonRarity = 'common' | 'rare' | 'epic';

export interface BoonDef {
  id: string;
  rarity: BoonRarity;
  /** Added to the hero's equipment stats while the run lasts (stacks per pick). */
  stats: Partial<EquipStats>;
  /** How many times it can be taken in one run (default 3). */
  maxStacks?: number;
  /** Glyph drawn on the boon card (a short symbol; the UI paints it). */
  glyph: 'blade' | 'heart' | 'fang' | 'wing' | 'eye' | 'shield' | 'hourglass' | 'coin' | 'star' | 'flame' | 'skull' | 'thorn';
}

export const BOONS: readonly BoonDef[] = [
  { id: 'wrath', rarity: 'common', stats: { damagePercent: 15 }, glyph: 'blade' },
  { id: 'vigor', rarity: 'common', stats: { maxHpPercent: 15 }, glyph: 'heart' },
  { id: 'bloodthirst', rarity: 'common', stats: { lifeSteal: 3 }, glyph: 'fang' },
  { id: 'swiftness', rarity: 'common', stats: { moveSpeed: 15 }, glyph: 'wing' },
  { id: 'precision', rarity: 'common', stats: { critRate: 6 }, glyph: 'eye' },
  { id: 'bulwark', rarity: 'common', stats: { defensePercent: 20, allResist: 10 }, glyph: 'shield' },
  { id: 'fortune', rarity: 'common', stats: { magicFind: 40 }, glyph: 'coin' },
  { id: 'haste', rarity: 'rare', stats: { attackSpeed: 12, cooldownReduction: 8 }, glyph: 'hourglass' },
  { id: 'ruin', rarity: 'rare', stats: { critDamage: 40 }, glyph: 'star' },
  { id: 'feast', rarity: 'rare', stats: { killHealPercent: 4 }, glyph: 'skull' },
  { id: 'wildfire', rarity: 'rare', stats: { elementalDamagePercent: 20 }, glyph: 'flame' },
  { id: 'briar', rarity: 'rare', stats: { thornsHeal: 3, damageReduction: 6 }, glyph: 'thorn' },
  { id: 'sunder', rarity: 'epic', stats: { ignoreDefense: 25, damagePercent: 10 }, maxStacks: 2, glyph: 'blade' },
  { id: 'echo', rarity: 'epic', stats: { critDoubleStrike: 15 }, maxStacks: 2, glyph: 'star' },
  { id: 'undying', rarity: 'epic', stats: { deathSave: 1, maxHpPercent: 10 }, maxStacks: 1, glyph: 'heart' },
  { id: 'overflow', rarity: 'epic', stats: { freeCast: 12, manaRegen: 4 }, maxStacks: 2, glyph: 'hourglass' },
];

export const BOON_RARITY_WEIGHT: Record<BoonRarity, number> = { common: 60, rare: 30, epic: 10 };

// ── Floor curses (深渊诅咒): one per floor from floor 2; richer loot in return ──

export interface CurseDef {
  id: string;
  /** Monster stat multipliers on this floor. */
  hpMul?: number;
  damageMul?: number;
  speedMul?: number;
  /** Chance for ordinary monsters to spawn as affixed elites. */
  eliteChance?: number;
  /** Extra spawn groups on the floor. */
  extraGroups?: number;
  /** Fog of war vision radius multiplier. */
  visionMul?: number;
  /** Monsters regain this fraction of max HP per second when out of combat or not hit for 3 s. */
  regenPerSec?: number;
  /** Monsters burst on death for this fraction of their max HP as area damage (radius 2 tiles). */
  deathBurst?: number;
  /** Added loot quality bonus / magic find while cursed. */
  lootBonus: number;
  magicFind: number;
}

export const CURSES: readonly CurseDef[] = [
  { id: 'frenzy', speedMul: 1.35, damageMul: 1.1, lootBonus: 6, magicFind: 25 },
  { id: 'bastion', hpMul: 1.5, lootBonus: 6, magicFind: 25 },
  { id: 'legion', extraGroups: 3, lootBonus: 8, magicFind: 30 },
  { id: 'champions', eliteChance: 0.25, lootBonus: 10, magicFind: 40 },
  { id: 'gloom', visionMul: 0.55, lootBonus: 6, magicFind: 25 },
  { id: 'undying', regenPerSec: 0.04, lootBonus: 6, magicFind: 25 },
  { id: 'volatile', deathBurst: 0.12, lootBonus: 8, magicFind: 30 },
  { id: 'brutal', damageMul: 1.35, lootBonus: 10, magicFind: 35 },
];

// ── Floor themes: each floor is a memory of a fallen land, twisted by the abyss ──

export interface FloorThemeDef {
  id: string;
  /** Terrain / prop theme used to paint the floor. */
  mapTheme: MapTheme;
  /** Overworld monsters this floor draws from (scaled to the run's level). */
  monsters: string[];
  /** Base monster the floor's gatekeeper is made from. */
  gatekeeper: string;
}

export const FLOOR_THEMES: readonly FloorThemeDef[] = [
  { id: 'crypt', mapTheme: 'forest', monsters: ['skeleton', 'zombie', 'werewolf'], gatekeeper: 'werewolf_alpha' },
  { id: 'forge', mapTheme: 'mountain', monsters: ['gargoyle', 'stone_golem'], gatekeeper: 'mountain_troll' },
  { id: 'tomb', mapTheme: 'desert', monsters: ['fire_elemental', 'desert_scorpion', 'sandworm'], gatekeeper: 'sandworm' },
  { id: 'rift', mapTheme: 'abyss', monsters: ['imp', 'lesser_demon', 'succubus', 'dungeon_shade', 'dungeon_fiend'], gatekeeper: 'dungeon_fiend' },
];

// ── Tiers (深渊层级): an endless ladder; clearing tier N unlocks N + 1 ──

/** Monster level on tier 1; each tier adds TIER_LEVEL_STEP. */
export const TIER_BASE_LEVEL = 42;
export const TIER_LEVEL_STEP = 2;
