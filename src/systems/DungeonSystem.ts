/**
 * DungeonSystem — Manages Zone 6 procedural random dungeon runs.
 *
 * Each run generates 5-10 floors with:
 * - Procedural layouts via MapGenerator with random seeds
 * - Monster difficulty scaling with depth
 * - Final floor boss + mid-bosses every N floors
 * - Ephemeral state: exits return to Abyss Rift, re-entry starts fresh
 * - Difficulty settings (Nightmare/Hell) apply
 */

import { MapGenerator } from './MapGenerator';
import type { MapData, MapTheme, MonsterDefinition } from '../data/types';
import { DungeonMonsterPool, DungeonBossDef, DungeonMidBossDef, DUNGEON_EXCLUSIVE_LEGENDARIES } from '../data/dungeonData';
import {
  BOONS, BOON_RARITY_WEIGHT, CURSES, FLOOR_THEMES, TIER_BASE_LEVEL, TIER_LEVEL_STEP,
  type BoonDef, type CurseDef, type FloorThemeDef,
} from '../data/abyssRun';
import type { EquipStats } from './CombatSystem';
import { t } from '../i18n';

/** Seeded RNG matching MapGenerator's SeededRandom */
class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed % 2147483647;
    if (this.state <= 0) this.state += 2147483646;
  }

  next(): number {
    this.state = (this.state * 16807) % 2147483647;
    return (this.state - 1) / 2147483646;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }
}

export interface DungeonFloorConfig {
  floorNumber: number;
  totalFloors: number;
  seed: number;
  /** Monster HP multiplier based on depth (1.0 at floor 1, scaling up). */
  hpMultiplier: number;
  /** Monster damage multiplier based on depth. */
  damageMultiplier: number;
  /** Monster defense multiplier based on depth. */
  defenseMultiplier: number;
  /** Whether this is the final floor (boss floor). */
  isBossFloor: boolean;
  /** Whether this floor has a mid-boss. */
  hasMidBoss: boolean;
  /** Monster IDs to spawn on this floor. */
  monsterIds: string[];
  /** Spawn count per group. */
  spawnCountRange: [number, number];
  /** Loot quality bonus scaling with floor depth (additive bonus to quality rolls). */
  lootQualityBonus: number;
  /** Magic find bonus percentage for this floor. */
  magicFindBonus: number;
  /** Abyss tier of the run (1 = first rung). */
  tier: number;
  /** FLOOR_THEMES id: which fallen land this floor remembers. */
  themeId: string;
  /** CURSES id on this floor, or null. */
  curseId: string | null;
  /** Level monsters on this floor are brought up to. */
  levelTarget: number;
  /** What holds the exit seal: a themed gatekeeper, the mid-boss, or (boss floor) the boss. */
  sealKeeper: 'gatekeeper' | 'mid_boss' | 'boss';
}

export interface DungeonRunState {
  /** Random seed for this run (determines floor count, layouts, monsters). */
  seed: number;
  /** Total number of floors in this run. */
  totalFloors: number;
  /** Current floor number (1-based). */
  currentFloor: number;
  /** Difficulty setting. */
  difficulty: 'normal' | 'nightmare' | 'hell';
  /** Whether the run is active. */
  active: boolean;
  /** Abyss tier (default 1). */
  tier?: number;
  /** Boons picked this run: id → stacks. */
  boons?: Record<string, number>;
  /** Monsters slain this run. */
  kills?: number;
  /** Date.now() when the run began. */
  startedAt?: number;
}

/** Id the floor gatekeeper spawns with (its kill opens the exit). */
export const GATEKEEPER_ID = 'dungeon_gatekeeper';

/** Hero's labyrinth record, persisted in the save. */
export interface AbyssRecord {
  /** Highest tier the hero may start (clearing tier N unlocks N + 1). */
  unlockedTier: number;
  /** Highest tier cleared (0 = none). */
  bestTier: number;
  /** Fastest clear of `bestTier`, ms. */
  bestTimeMs?: number;
}

/** Static utility class for dungeon generation logic. No Phaser dependencies. */
export class DungeonSystem {
  /** Generate a new dungeon run with random seed. */
  static createRun(difficulty: 'normal' | 'nightmare' | 'hell' = 'normal', customSeed?: number, tier?: number): DungeonRunState {
    const seed = customSeed ?? (Date.now() ^ (Math.random() * 0xFFFFFF >>> 0));
    const rng = new SeededRandom(seed);
    // Tier runs are 5-8 floors, growing a floor every three tiers.
    const totalFloors = tier ? 5 + Math.min(3, Math.floor((tier - 1) / 3)) : rng.nextInt(5, 10);

    return {
      seed,
      totalFloors,
      currentFloor: 1,
      difficulty,
      active: true,
      tier: tier ?? 1,
      boons: {},
      kills: 0,
      startedAt: Date.now(),
    };
  }

  /** Get floor configuration for a given floor number. */
  static getFloorConfig(run: DungeonRunState, floorNumber: number): DungeonFloorConfig {
    const rng = new SeededRandom(run.seed + floorNumber * 7919);
    const totalFloors = run.totalFloors;
    const isBossFloor = floorNumber === totalFloors;

    // Mid-boss every 3 floors (floor 3, 6, 9) in longer runs, but not on boss floor
    const hasMidBoss = !isBossFloor && floorNumber > 1 && floorNumber % 3 === 0;

    // Depth ratio: 0.0 (floor 1) to 1.0 (final floor)
    const depthRatio = totalFloors > 1 ? (floorNumber - 1) / (totalFloors - 1) : 0;

    // HP scales: 1.0x at floor 1, ≥1.5x by floor 5 (midpoint or later)
    // Using exponential scaling: mult = 1.0 + depthRatio * 1.2
    // At floor 5 of 10: depthRatio = 4/9 = 0.44, mult = 1.53 ✓
    // At floor 5 of 5: depthRatio = 1.0, mult = 2.2
    const tier = Math.max(1, run.tier ?? 1);
    const tierMul = 1 + (tier - 1) * 0.2;
    const curse = !isBossFloor && floorNumber >= 2 ? CURSES[rng.nextInt(0, CURSES.length - 1)] : null;
    const hpMultiplier = (1.0 + depthRatio * 1.2) * tierMul * (curse?.hpMul ?? 1);
    const damageMultiplier = (1.0 + depthRatio * 0.8) * tierMul * (curse?.damageMul ?? 1);
    const defenseMultiplier = (1.0 + depthRatio * 0.6) * (1 + (tier - 1) * 0.1);

    // Each floor remembers one of the fallen lands; the last is always the rift itself.
    const theme = isBossFloor ? FLOOR_THEMES.find(f => f.id === 'rift')! : FLOOR_THEMES[rng.nextInt(0, FLOOR_THEMES.length - 1)];
    const monsterIds = theme.id === 'rift'
      ? DungeonSystem.pickMonsters(rng, floorNumber, totalFloors)
      : DungeonSystem.pickThemeMonsters(rng, theme);

    // Spawn count scales with depth
    const baseMin = 4 + Math.floor(depthRatio * 3);
    const baseMax = 7 + Math.floor(depthRatio * 4);

    // Floor seed for map generation
    const floorSeed = run.seed * 31 + floorNumber * 997;

    // Loot bonuses scale with floor depth
    // Floor 1: +5 quality, +10% MF. Floor 5/10: +15 quality, +30% MF. Boss floor: extra boost.
    const baseLootBonus = 5 + Math.floor(depthRatio * 15) + (tier - 1) * 3 + (curse?.lootBonus ?? 0);
    const lootQualityBonus = isBossFloor ? baseLootBonus + 10 : baseLootBonus;
    const magicFindBonus = 10 + Math.floor(depthRatio * 30) + (isBossFloor ? 20 : 0) + (tier - 1) * 10 + (curse?.magicFind ?? 0);
    const extraGroups = curse?.extraGroups ?? 0;

    return {
      floorNumber,
      totalFloors,
      seed: floorSeed,
      hpMultiplier,
      damageMultiplier,
      defenseMultiplier,
      isBossFloor,
      hasMidBoss,
      monsterIds,
      spawnCountRange: [baseMin + (extraGroups > 0 ? 1 : 0), baseMax + extraGroups],
      lootQualityBonus,
      magicFindBonus,
      tier,
      themeId: theme.id,
      curseId: curse?.id ?? null,
      levelTarget: TIER_BASE_LEVEL + (tier - 1) * TIER_LEVEL_STEP + floorNumber,
      sealKeeper: isBossFloor ? 'boss' : hasMidBoss ? 'mid_boss' : 'gatekeeper',
    };
  }

  /** 2-3 monsters from a themed floor's pool. */
  private static pickThemeMonsters(rng: SeededRandom, theme: FloorThemeDef): string[] {
    const pool = [...theme.monsters];
    const want = Math.min(pool.length, rng.nextInt(2, 3));
    const out: string[] = [];
    while (out.length < want) out.push(pool.splice(rng.nextInt(0, pool.length - 1), 1)[0]);
    return out;
  }

  static getCurse(config: DungeonFloorConfig): CurseDef | null {
    return config.curseId ? CURSES.find(c => c.id === config.curseId) ?? null : null;
  }

  static getTheme(config: DungeonFloorConfig): FloorThemeDef {
    return FLOOR_THEMES.find(f => f.id === config.themeId) ?? FLOOR_THEMES[FLOOR_THEMES.length - 1];
  }

  /** Pick 2-3 monster types for a floor, varying by depth. */
  private static pickMonsters(rng: SeededRandom, floor: number, totalFloors: number): string[] {
    const pool = DungeonMonsterPool;
    const depthRatio = totalFloors > 1 ? (floor - 1) / (totalFloors - 1) : 0;

    // Early floors: weaker monsters. Later floors: stronger monsters + mix.
    const availableCount = Math.min(pool.length, 2 + Math.floor(depthRatio * (pool.length - 2)));
    const startIdx = Math.min(Math.floor(depthRatio * (pool.length - 2)), pool.length - availableCount);

    const selected: string[] = [];
    const indices = new Set<number>();

    // Pick 2-3 different monsters
    const pickCount = rng.nextInt(2, Math.min(3, availableCount));
    while (selected.length < pickCount && indices.size < availableCount) {
      const idx = startIdx + rng.nextInt(0, availableCount - 1);
      const clampedIdx = Math.min(idx, pool.length - 1);
      if (!indices.has(clampedIdx)) {
        indices.add(clampedIdx);
        selected.push(pool[clampedIdx]);
      }
    }

    return selected.length > 0 ? selected : [pool[0]];
  }

  /** Generate a MapData for a dungeon floor. */
  static generateFloorMap(config: DungeonFloorConfig): MapData {
    const rng = new SeededRandom(config.seed);
    const themed = !!config.themeId;
    const cols = themed ? rng.nextInt(54, 68) : 60;
    const rows = themed ? rng.nextInt(54, 68) : 60;
    const layout = DungeonSystem.floorLayout(themed ? rng.nextInt(0, 3) : 0, cols, rows);

    // Build spawn list from floor config
    const spawns: MapData['spawns'] = [];
    const curse = DungeonSystem.getCurse(config);
    const groups = config.monsterIds.length * 2 + (curse?.extraGroups ?? 0);
    const spawnPositions = DungeonSystem.generateSpawnPositions(rng, cols, rows, groups, layout.start);

    for (let i = 0; i < spawnPositions.length; i++) {
      const monsterId = config.monsterIds[i % config.monsterIds.length];
      const count = rng.nextInt(config.spawnCountRange[0], config.spawnCountRange[1]);
      spawns.push({
        col: spawnPositions[i].col,
        row: spawnPositions[i].row,
        monsterId,
        count,
      });
    }

    // Boss/mid-boss spawn: they guard the way out.
    if (config.isBossFloor) {
      spawns.push({ ...layout.guard, monsterId: DungeonBossDef.id, count: 1 });
    }
    if (config.hasMidBoss) {
      spawns.push({ ...layout.guard, monsterId: DungeonMidBossDef.id, count: 1 });
    }

    // Exit to next floor (not on boss floor — boss floor has an exit back to Abyss Rift)
    const exits: MapData['exits'] = [];
    if (!config.isBossFloor) {
      exits.push({
        ...layout.exit,
        targetMap: `dungeon_floor_${config.floorNumber + 1}`,
        targetCol: 3,
        targetRow: 3,
      });
    } else {
      // Boss floor exit goes back to abyss_rift
      exits.push({
        ...layout.exit,
        targetMap: 'abyss_rift',
        targetCol: 60,
        targetRow: 60,
      });
    }

    // Create minimal MapData for MapGenerator
    const mapData: MapData = {
      id: `dungeon_floor_${config.floorNumber}`,
      name: t('zone.dungeon.floorName', { floor: config.floorNumber }),
      cols,
      rows,
      tiles: [],
      collisions: [],
      spawns,
      camps: [], // No camps in dungeons
      playerStart: layout.start,
      exits,
      levelRange: config.levelTarget
        ? [config.levelTarget - 2, config.levelTarget + 2]
        : [40 + config.floorNumber * 2, 48 + config.floorNumber * 2],
      theme: (themed ? DungeonSystem.getTheme(config).mapTheme : 'abyss') as MapTheme,
      seed: config.seed,
      bgColor: '#12081a',
    };

    // Use MapGenerator to procedurally generate tiles/collisions/decorations
    return MapGenerator.generate(mapData);
  }

  /**
   * Where a floor starts, ends and is guarded. Orientation 0-3: north→south,
   * south→north, west→east, east→west, so floors don't all run the same way.
   */
  static floorLayout(orientation: number, cols: number, rows: number): {
    start: { col: number; row: number };
    exit: { col: number; row: number };
    guard: { col: number; row: number };
  } {
    const midC = Math.floor(cols / 2);
    const midR = Math.floor(rows / 2);
    switch (orientation) {
      case 1: return { start: { col: midC, row: rows - 4 }, exit: { col: midC, row: 1 }, guard: { col: midC, row: Math.floor(rows * 0.25) } };
      case 2: return { start: { col: 3, row: midR }, exit: { col: cols - 2, row: midR }, guard: { col: Math.floor(cols * 0.75), row: midR } };
      case 3: return { start: { col: cols - 4, row: midR }, exit: { col: 1, row: midR }, guard: { col: Math.floor(cols * 0.25), row: midR } };
      default: return { start: { col: midC, row: 3 }, exit: { col: midC, row: rows - 2 }, guard: { col: midC, row: Math.floor(rows * 0.72) } };
    }
  }

  /** Generate random spawn positions spread across the map interior, away from the start. */
  private static generateSpawnPositions(
    rng: SeededRandom,
    cols: number,
    rows: number,
    count: number,
    start: { col: number; row: number } = { col: Math.floor(cols / 2), row: 3 },
  ): { col: number; row: number }[] {
    const positions: { col: number; row: number }[] = [];
    const margin = 8;
    for (let i = 0; i < count; i++) {
      let pos = { col: rng.nextInt(margin, cols - margin), row: rng.nextInt(margin, rows - margin) };
      for (let tries = 0; tries < 8 && Math.hypot(pos.col - start.col, pos.row - start.row) < 12; tries++) {
        pos = { col: rng.nextInt(margin, cols - margin), row: rng.nextInt(margin, rows - margin) };
      }
      positions.push(pos);
    }
    return positions;
  }

  /** Apply depth-based stat scaling to a monster definition. Returns a new def (no mutation). */
  static scaleMonster(baseDef: MonsterDefinition, config: DungeonFloorConfig, difficulty: 'normal' | 'nightmare' | 'hell'): MonsterDefinition {
    baseDef = DungeonSystem.raiseToLevel(baseDef, config.levelTarget);
    const difficultyMult = DungeonSystem.getDifficultyMultipliers(difficulty);
    const curse = DungeonSystem.getCurse(config);
    return {
      ...baseDef,
      speed: Math.round(baseDef.speed * (curse?.speedMul ?? 1)),
      attackSpeed: Math.round(baseDef.attackSpeed / (curse?.speedMul ?? 1)),
      hp: Math.round(baseDef.hp * config.hpMultiplier * difficultyMult.hp),
      damage: Math.round(baseDef.damage * config.damageMultiplier * difficultyMult.damage),
      defense: Math.round(baseDef.defense * config.defenseMultiplier * difficultyMult.defense),
      expReward: Math.round(baseDef.expReward * (1 + (config.floorNumber - 1) * 0.15) * difficultyMult.exp),
      goldReward: [
        Math.round(baseDef.goldReward[0] * (1 + (config.floorNumber - 1) * 0.1)),
        Math.round(baseDef.goldReward[1] * (1 + (config.floorNumber - 1) * 0.1)),
      ],
    };
  }

  /**
   * Bring a monster from an earlier land up to the labyrinth's level. Monsters
   * already within 6 levels keep their stats (the rift's own demons).
   */
  static raiseToLevel(def: MonsterDefinition, level: number | undefined): MonsterDefinition {
    if (!level || def.level >= level - 6) return def;
    const m = level / Math.max(1, def.level);
    return {
      ...def,
      level,
      hp: Math.round(def.hp * Math.pow(m, 1.1)),
      damage: Math.round(def.damage * Math.pow(m, 0.95)),
      defense: Math.round(def.defense * Math.pow(m, 0.9)),
      expReward: Math.round(def.expReward * Math.pow(m, 1.1)),
      goldReward: [Math.round(def.goldReward[0] * m), Math.round(def.goldReward[1] * m)],
    };
  }

  /** The floor's gatekeeper: its theme's champion, raised, named and elite. */
  static makeGatekeeper(config: DungeonFloorConfig, base: MonsterDefinition, difficulty: 'normal' | 'nightmare' | 'hell'): MonsterDefinition {
    const scaled = DungeonSystem.scaleMonster(base, config, difficulty);
    const hpMul = base.isMiniBoss || base.elite ? 1.6 : 4;
    return {
      ...scaled,
      id: GATEKEEPER_ID,
      name: t(`dungeon.gatekeeper.${config.themeId}`),
      hp: Math.round(scaled.hp * hpMul),
      damage: Math.round(scaled.damage * 1.3),
      expReward: Math.round(scaled.expReward * 4),
      goldReward: [scaled.goldReward[0] * 3, scaled.goldReward[1] * 3],
      aggroRange: Math.max(scaled.aggroRange, 8),
      elite: true,
      isMiniBoss: true,
    };
  }

  // ── Boons ──────────────────────────────────────────────────

  /** Up to `count` distinct boons weighted by rarity, skipping ones already at max stacks. */
  static rollBoonOffer(seed: number, held: Record<string, number>, count = 3): string[] {
    // Neighbouring seeds give correlated first rolls in a Lehmer RNG: scramble first.
    let h = (seed ^ 0x9e3779b9) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
    const rng = new SeededRandom((h ^ (h >>> 16)) || 1);
    const pool = BOONS.filter(b => (held[b.id] ?? 0) < (b.maxStacks ?? 3));
    const out: string[] = [];
    while (out.length < count && pool.length > 0) {
      const total = pool.reduce((sum, b) => sum + BOON_RARITY_WEIGHT[b.rarity], 0);
      let roll = rng.next() * total;
      let idx = 0;
      for (; idx < pool.length - 1; idx++) {
        roll -= BOON_RARITY_WEIGHT[pool[idx].rarity];
        if (roll < 0) break;
      }
      out.push(pool.splice(idx, 1)[0].id);
    }
    return out;
  }

  /** Sum of the run's boon stats, to merge into equipment stats. */
  static boonStats(held: Record<string, number> | undefined): Partial<EquipStats> {
    const out: Partial<Record<keyof EquipStats, number>> = {};
    for (const [id, stacks] of Object.entries(held ?? {})) {
      const boon: BoonDef | undefined = BOONS.find(b => b.id === id);
      if (!boon || stacks <= 0) continue;
      for (const [stat, value] of Object.entries(boon.stats) as [keyof EquipStats, number][]) {
        out[stat] = (out[stat] ?? 0) + value * stacks;
      }
    }
    return out;
  }

  // ── Records ────────────────────────────────────────────────

  /** Update the hero's record after clearing `tier` in `timeMs`. */
  static recordClear(record: AbyssRecord, tier: number, timeMs: number): { record: AbyssRecord; newBest: boolean } {
    const newBest = tier > record.bestTier;
    const faster = tier === record.bestTier && (record.bestTimeMs === undefined || timeMs < record.bestTimeMs);
    return {
      newBest,
      record: {
        unlockedTier: Math.max(record.unlockedTier, tier + 1),
        bestTier: Math.max(record.bestTier, tier),
        bestTimeMs: newBest || faster ? timeMs : record.bestTimeMs,
      },
    };
  }

  /** Get difficulty multipliers for Nightmare/Hell. */
  static getDifficultyMultipliers(difficulty: 'normal' | 'nightmare' | 'hell'): { hp: number; damage: number; defense: number; exp: number } {
    switch (difficulty) {
      case 'nightmare':
        return { hp: 1.5, damage: 1.5, defense: 1.3, exp: 2.0 };
      case 'hell':
        return { hp: 2.0, damage: 2.0, defense: 1.6, exp: 3.0 };
      default:
        return { hp: 1.0, damage: 1.0, defense: 1.0, exp: 1.0 };
    }
  }

  /** Get the exit label for a non-final floor. */
  static getFloorExitLabel(nextFloor: number): string {
    return t('zone.dungeon.floorExitLabel', { floor: nextFloor });
  }

  /** Get the dungeon portal label. */
  static getDungeonPortalLabel(): string {
    return t('zone.dungeon.portalLabel');
  }

  /** Get the dungeon exclusive legendary IDs. */
  static getDungeonExclusiveLegendaryIds(): string[] {
    return DUNGEON_EXCLUSIVE_LEGENDARIES.map(l => l.id);
  }

  /** Check if the final boss guarantees rare+ loot. */
  static getBossLootFloor(): 'rare' {
    return 'rare';
  }

  /** Check if mid-boss guarantees magic+ loot. */
  static getMidBossLootFloor(): 'magic' {
    return 'magic';
  }
}
