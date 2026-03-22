import { EventBus, GameEvents } from '../utils/EventBus';
import { clamp, chance } from '../utils/MathUtils';
import type { Stats, SkillDefinition } from '../data/types';

export interface CombatEntity {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  stats: Stats;
  level: number;
  baseDamage: number;
  defense: number;
  attackSpeed: number;
  attackRange: number;
  buffs: ActiveBuff[];
}

export interface ActiveBuff {
  stat: string;
  value: number;
  duration: number;
  startTime: number;
}

export interface DamageResult {
  damage: number;
  isCrit: boolean;
  isDodged: boolean;
}

/**
 * D2-style tiered scaling: early levels give more value per point.
 * Bracket multipliers: levels 1-8 = 100%, 9-16 = 75%, 17-20 = 50%.
 */
function tieredScale(perLevel: number, level: number): number {
  if (level <= 1) return 0;
  let total = 0;
  for (let i = 2; i <= level; i++) {
    if (i <= 8) total += perLevel;
    else if (i <= 16) total += perLevel * 0.75;
    else total += perLevel * 0.5;
  }
  return total;
}

/** Resolve the effective damage multiplier for a skill at a given level. */
export function getSkillDamageMultiplier(skill: SkillDefinition, level: number): number {
  const base = skill.damageMultiplier;
  const perLevel = skill.scaling?.damagePerLevel ?? 0.05;
  return base + tieredScale(perLevel, level);
}

/** Resolve the effective mana cost for a skill at a given level. */
export function getSkillManaCost(skill: SkillDefinition, level: number): number {
  const base = skill.manaCost;
  const perLevel = skill.scaling?.manaCostPerLevel ?? 0.5;
  return Math.floor(base + tieredScale(perLevel, level));
}

/** Resolve the effective cooldown (ms) for a skill at a given level. */
export function getSkillCooldown(skill: SkillDefinition, level: number): number {
  const base = skill.cooldown;
  const perLevel = skill.scaling?.cooldownReductionPerLevel ?? 0;
  return Math.max(500, Math.floor(base - tieredScale(perLevel, level)));
}

/** Resolve the effective AoE radius for a skill at a given level. */
export function getSkillAoeRadius(skill: SkillDefinition, level: number): number {
  const base = skill.aoeRadius ?? 0;
  const perLevel = skill.scaling?.aoeRadiusPerLevel ?? 0;
  return base + tieredScale(perLevel, level);
}

/** Resolve the effective buff value for a skill at a given level. */
export function getSkillBuffValue(skill: SkillDefinition, level: number): number {
  const base = skill.buff?.value ?? 0;
  const perLevel = skill.scaling?.buffValuePerLevel ?? 0.02;
  return base + tieredScale(perLevel, level);
}

/** Resolve the effective buff duration (ms) for a skill at a given level. */
export function getSkillBuffDuration(skill: SkillDefinition, level: number): number {
  const base = skill.buff?.duration ?? 0;
  const perLevel = skill.scaling?.buffDurationPerLevel ?? 0;
  return Math.floor(base + tieredScale(perLevel, level));
}

/** Calculate synergy bonus multiplier (1.0 = no bonus). */
export function getSynergyBonus(
  skill: SkillDefinition,
  skillLevels: Map<string, number> | Record<string, number>,
): number {
  if (!skill.synergies || skill.synergies.length === 0) return 1;
  let bonus = 0;
  for (const syn of skill.synergies) {
    const synLevel = skillLevels instanceof Map
      ? (skillLevels.get(syn.skillId) ?? 0)
      : (skillLevels[syn.skillId] ?? 0);
    bonus += syn.damagePerLevel * synLevel;
  }
  return 1 + bonus;
}

export class CombatSystem {
  calculateDamage(
    attacker: CombatEntity,
    defender: CombatEntity,
    skill?: SkillDefinition,
    skillLevel = 1,
    skillLevels?: Map<string, number>,
  ): DamageResult {
    // Dodge check
    const dodgeRate = clamp(defender.stats.dex * 0.3, 0, 30);
    if (chance(dodgeRate)) {
      return { damage: 0, isCrit: false, isDodged: true };
    }

    // Crit check -- skill critBonus adds to base crit rate
    const skillCritBonus = skill?.critBonus ?? 0;
    const critRate = clamp(
      attacker.stats.dex * 0.2 + attacker.stats.lck * 0.5 + skillCritBonus,
      0,
      75,
    );
    const isCrit = chance(critRate);
    const critMultiplier = isCrit ? 1.5 + attacker.stats.lck * 0.01 : 1;

    let baseDmg: number;
    let multiplier = 1;

    if (skill) {
      const isPhysical = skill.damageType === 'physical';
      const statBonus = isPhysical ? attacker.stats.str : attacker.stats.int;
      baseDmg = attacker.baseDamage + statBonus * 0.5;
      multiplier = getSkillDamageMultiplier(skill, skillLevel);

      // Synergy bonus
      if (skillLevels) {
        multiplier *= getSynergyBonus(skill, skillLevels);
      }
    } else {
      baseDmg = attacker.baseDamage + attacker.stats.str * 0.5;
    }

    // Damage reduction from buffs
    let damageReduction = 0;
    for (const buff of defender.buffs) {
      if (buff.stat === 'damageReduction') {
        damageReduction += buff.value;
      }
    }

    const rawDamage = baseDmg * multiplier * critMultiplier;
    const defense = defender.defense * (1 - damageReduction);
    const finalDamage = Math.max(1, Math.floor(rawDamage - defense * 0.5));

    return { damage: finalDamage, isCrit, isDodged: false };
  }

  applyDamage(target: CombatEntity, result: DamageResult): void {
    if (result.isDodged) {
      EventBus.emit(GameEvents.COMBAT_DAMAGE, {
        targetId: target.id,
        damage: 0,
        isDodged: true,
        isCrit: false,
      });
      return;
    }

    target.hp = Math.max(0, target.hp - result.damage);
    EventBus.emit(GameEvents.COMBAT_DAMAGE, {
      targetId: target.id,
      damage: result.damage,
      isDodged: false,
      isCrit: result.isCrit,
    });

    if (target.hp <= 0) {
      EventBus.emit(GameEvents.MONSTER_DIED, { id: target.id, name: target.name });
    }
  }

  canUseSkill(entity: CombatEntity, skill: SkillDefinition, skillLevel: number = 1): boolean {
    return entity.mana >= getSkillManaCost(skill, skillLevel);
  }

  useSkillMana(entity: CombatEntity, skill: SkillDefinition, skillLevel: number = 1): void {
    entity.mana = Math.max(0, entity.mana - getSkillManaCost(skill, skillLevel));
  }

  updateBuffs(entity: CombatEntity, now: number): void {
    entity.buffs = entity.buffs.filter(b => now - b.startTime < b.duration);
  }

  addBuff(entity: CombatEntity, buff: ActiveBuff): void {
    entity.buffs.push(buff);
  }
}
