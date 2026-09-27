/**
 * Text helpers for the Abyss Labyrinth UI. Every number shown to the player is
 * generated from the data in src/data/abyssRun.ts so the UI never drifts from
 * the balance values.
 */
import { t } from '../i18n';
import { getStatLabel, isStatPercent } from '../i18n/gameAccessors';
import { BOONS, CURSES, FLOOR_THEMES, TIER_BASE_LEVEL, TIER_LEVEL_STEP, type BoonDef, type CurseDef } from '../data/abyssRun';
import type { EquipStats } from '../systems/CombatSystem';

export function getBoon(id: string): BoonDef | undefined {
  return BOONS.find((b) => b.id === id);
}

export function getCurse(id: string): CurseDef | undefined {
  return CURSES.find((c) => c.id === id);
}

/** Stats that have a dedicated phrase in `dungeon.stat.<key>` ({v} = value). */
export const BOON_STAT_PHRASES = [
  'damagePercent', 'maxHpPercent', 'lifeSteal', 'moveSpeed', 'critRate', 'defensePercent', 'allResist',
  'magicFind', 'attackSpeed', 'cooldownReduction', 'critDamage', 'killHealPercent', 'elementalDamagePercent',
  'thornsHeal', 'damageReduction', 'ignoreDefense', 'critDoubleStrike', 'deathSave', 'freeCast', 'manaRegen',
] as const;

function fmtNum(v: number): string {
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 10) / 10);
}

/** One line per stat, e.g. "+15% 伤害". `stacks` multiplies the values (held stacks). */
export function formatBoonStats(stats: Partial<EquipStats>, stacks = 1): string[] {
  const out: string[] = [];
  for (const [key, raw] of Object.entries(stats)) {
    if (typeof raw !== 'number' || raw === 0) continue;
    const v = raw * stacks;
    if ((BOON_STAT_PHRASES as readonly string[]).includes(key)) {
      out.push(t(`dungeon.stat.${key}`, { v: fmtNum(v) }));
    } else {
      out.push(`${v > 0 ? '+' : ''}${fmtNum(v)}${isStatPercent(key) ? '%' : ''} ${getStatLabel(key)}`);
    }
  }
  return out;
}

/** Description lines of a boon (per stack). */
export function boonDescLines(id: string, stacks = 1): string[] {
  const b = getBoon(id);
  return b ? formatBoonStats(b.stats, stacks) : [];
}

export function boonName(id: string): string {
  return t(`dungeon.boon.${id}.name`);
}

export function boonMaxStacks(b: BoonDef): number {
  return b.maxStacks ?? 3;
}

export function curseName(id: string): string {
  return t(`dungeon.curse.${id}.name`);
}

/** Curse description with its numbers filled in from the curse data. */
export function curseDesc(id: string): string {
  const c = getCurse(id);
  if (!c) return '';
  const pct = (m: number | undefined): number => Math.round(((m ?? 1) - 1) * 100);
  return t(`dungeon.curse.${id}.desc`, {
    speed: pct(c.speedMul),
    dmg: pct(c.damageMul),
    hp: pct(c.hpMul),
    elite: Math.round((c.eliteChance ?? 0) * 100),
    groups: c.extraGroups ?? 0,
    vision: Math.round((1 - (c.visionMul ?? 1)) * 100),
    regen: fmtNum((c.regenPerSec ?? 0) * 100),
    burst: Math.round((c.deathBurst ?? 0) * 100),
    mf: c.magicFind,
    loot: c.lootBonus,
  });
}

export function themeName(id: string): string {
  return FLOOR_THEMES.some((f) => f.id === id) ? t(`dungeon.theme.${id}`) : id;
}

export function recommendedLevel(tier: number): number {
  return TIER_BASE_LEVEL + (Math.max(1, tier) - 1) * TIER_LEVEL_STEP;
}

/** mm:ss (or h:mm:ss past an hour). */
export function formatRunTime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${String(m).padStart(2, '0')}:${ss}`;
}
