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

export class CombatSystem {
  calculateDamage(
    attacker: CombatEntity,
    defender: CombatEntity,
    skill?: SkillDefinition,
    skillLevel = 1,
  ): DamageResult {
    // Dodge check
    const dodgeRate = clamp(defender.stats.dex * 0.3, 0, 30);
    if (chance(dodgeRate)) {
      return { damage: 0, isCrit: false, isDodged: true };
    }

    // Crit check
    const critRate = clamp(
      attacker.stats.dex * 0.2 + attacker.stats.lck * 0.5,
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
      multiplier = skill.damageMultiplier + skillLevel * 0.05;
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

  canUseSkill(entity: CombatEntity, skill: SkillDefinition): boolean {
    return entity.mana >= skill.manaCost;
  }

  useSkillMana(entity: CombatEntity, skill: SkillDefinition): void {
    entity.mana = Math.max(0, entity.mana - skill.manaCost);
  }

  updateBuffs(entity: CombatEntity, now: number): void {
    entity.buffs = entity.buffs.filter(b => now - b.startTime < b.duration);
  }

  addBuff(entity: CombatEntity, buff: ActiveBuff): void {
    entity.buffs.push(buff);
  }
}
