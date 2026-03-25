import { describe, it, expect } from 'vitest';
import { RogueClass } from '../data/classes/rogue';
import type { SkillDefinition } from '../data/types';
import { getSkillDamageMultiplier, getSkillManaCost, getSkillCooldown, getSkillAoeRadius, getSkillBuffValue, getSynergyBonus } from '../systems/CombatSystem';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const ALL_SKILLS = RogueClass.skills;
const SKILL_IDS = ALL_SKILLS.map(s => s.id);
const skillById = (id: string): SkillDefinition =>
  ALL_SKILLS.find(s => s.id === id)!;

// The 7 new skills added by rogue-skills-expansion
const NEW_SKILL_IDS = [
  'death_mark', 'poison_cloud', 'slow_trap',
  'chain_trap', 'piercing_arrow', 'poison_arrow',
  'shadow_step',
];

// Original 6 rogue skills
const ORIGINAL_SKILL_IDS = [
  'backstab', 'poison_blade', 'vanish',
  'multishot', 'arrow_rain',
  'explosive_trap',
];

// Active new skills that must have mana cost > 0 and cooldown > 0
const ACTIVE_NEW_SKILL_IDS = [
  'death_mark', 'poison_cloud', 'slow_trap',
  'chain_trap', 'piercing_arrow', 'poison_arrow',
  'shadow_step',
];

// Valid rogue trees
const VALID_TREES = ['assassination', 'archery', 'traps'];

// Valid rogue damage types
const VALID_DAMAGE_TYPES = ['physical', 'fire', 'poison'];

// Required fields every skill must have
const REQUIRED_FIELDS: (keyof SkillDefinition)[] = [
  'id', 'name', 'nameEn', 'description', 'tree', 'tier', 'maxLevel',
  'manaCost', 'cooldown', 'range', 'damageMultiplier', 'damageType', 'icon',
];

// ---------------------------------------------------------------------------
// 1. Rogue skill count — VAL-SKILL-003
// ---------------------------------------------------------------------------
describe('Rogue skill count', () => {
  it('has exactly 13 total skills (6 original + 7 new)', () => {
    expect(ALL_SKILLS).toHaveLength(13);
  });

  it('includes all 7 new skill IDs', () => {
    for (const id of NEW_SKILL_IDS) {
      expect(SKILL_IDS, `Missing new skill: ${id}`).toContain(id);
    }
  });

  it('retains all original skill IDs', () => {
    for (const id of ORIGINAL_SKILL_IDS) {
      expect(SKILL_IDS, `Missing original skill: ${id}`).toContain(id);
    }
  });

  it('has unique skill IDs (no duplicates)', () => {
    const unique = new Set(SKILL_IDS);
    expect(unique.size).toBe(SKILL_IDS.length);
  });
});

// ---------------------------------------------------------------------------
// 2. Required fields — VAL-SKILL-003
// ---------------------------------------------------------------------------
describe('Rogue skill required fields', () => {
  for (const skill of ALL_SKILLS) {
    it(`${skill.id} has all required fields`, () => {
      for (const field of REQUIRED_FIELDS) {
        expect(skill, `${skill.id} missing field: ${field}`).toHaveProperty(field);
        expect(skill[field], `${skill.id}.${field} is undefined`).not.toBeUndefined();
      }
    });
  }
});

// ---------------------------------------------------------------------------
// 3. Chinese names and descriptions — VAL-SKILL-003
// ---------------------------------------------------------------------------
describe('Rogue skill Chinese text', () => {
  const CN_REGEX = /[\u4e00-\u9fff]/;

  for (const skill of ALL_SKILLS) {
    it(`${skill.id} has Chinese name`, () => {
      expect(skill.name).toMatch(CN_REGEX);
    });

    it(`${skill.id} has Chinese description`, () => {
      expect(skill.description).toMatch(CN_REGEX);
    });

    it(`${skill.id} has English nameEn`, () => {
      expect(skill.nameEn.length).toBeGreaterThan(0);
    });
  }
});

// ---------------------------------------------------------------------------
// 4. Tree and tier validity — VAL-SKILL-003
// ---------------------------------------------------------------------------
describe('Rogue skill tree/tier validity', () => {
  for (const skill of ALL_SKILLS) {
    it(`${skill.id} is in a valid tree`, () => {
      expect(VALID_TREES, `${skill.id} tree: ${skill.tree}`).toContain(skill.tree);
    });

    it(`${skill.id} tier is 1-3`, () => {
      expect(skill.tier).toBeGreaterThanOrEqual(1);
      expect(skill.tier).toBeLessThanOrEqual(3);
    });
  }

  it('assassination tree has correct skills', () => {
    const aSkills = ALL_SKILLS.filter(s => s.tree === 'assassination').map(s => s.id);
    expect(aSkills).toContain('backstab');
    expect(aSkills).toContain('poison_blade');
    expect(aSkills).toContain('vanish');
    expect(aSkills).toContain('death_mark');
    expect(aSkills).toContain('shadow_step');
  });

  it('archery tree has correct skills', () => {
    const archSkills = ALL_SKILLS.filter(s => s.tree === 'archery').map(s => s.id);
    expect(archSkills).toContain('multishot');
    expect(archSkills).toContain('arrow_rain');
    expect(archSkills).toContain('piercing_arrow');
    expect(archSkills).toContain('poison_arrow');
  });

  it('traps tree has correct skills', () => {
    const tSkills = ALL_SKILLS.filter(s => s.tree === 'traps').map(s => s.id);
    expect(tSkills).toContain('explosive_trap');
    expect(tSkills).toContain('poison_cloud');
    expect(tSkills).toContain('slow_trap');
    expect(tSkills).toContain('chain_trap');
  });
});

// ---------------------------------------------------------------------------
// 5. Damage multiplier caps — VAL-SKILL-012
// ---------------------------------------------------------------------------
describe('Rogue skill damage multiplier caps', () => {
  for (const skill of ALL_SKILLS) {
    it(`${skill.id} damageMultiplier ≤ 3.0 (300%)`, () => {
      expect(skill.damageMultiplier).toBeLessThanOrEqual(3.0);
    });

    it(`${skill.id} damageMultiplier ≥ 0`, () => {
      expect(skill.damageMultiplier).toBeGreaterThanOrEqual(0);
    });
  }
});

// ---------------------------------------------------------------------------
// 6. Synergy references — VAL-SKILL-008
// ---------------------------------------------------------------------------
describe('Rogue skill synergy references', () => {
  for (const skill of ALL_SKILLS) {
    if (skill.synergies && skill.synergies.length > 0) {
      for (const syn of skill.synergies) {
        it(`${skill.id} synergy ${syn.skillId} references a valid rogue skill`, () => {
          expect(SKILL_IDS, `${skill.id} has invalid synergy ref: ${syn.skillId}`).toContain(syn.skillId);
        });

        it(`${skill.id} synergy ${syn.skillId} has damagePerLevel > 0`, () => {
          expect(syn.damagePerLevel).toBeGreaterThan(0);
        });

        it(`${skill.id} does not reference itself in synergies`, () => {
          expect(syn.skillId).not.toBe(skill.id);
        });
      }
    }
  }

  it('all new skills have at least one synergy', () => {
    for (const id of NEW_SKILL_IDS) {
      const skill = skillById(id);
      expect(skill.synergies, `${id} has no synergies`).toBeDefined();
      expect(skill.synergies!.length, `${id} synergies empty`).toBeGreaterThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// 7. Active skills: manaCost and cooldown — VAL-SKILL-010
// ---------------------------------------------------------------------------
describe('Rogue active new skills: manaCost and cooldown', () => {
  for (const id of ACTIVE_NEW_SKILL_IDS) {
    const skill = skillById(id);

    it(`${id} has manaCost > 0`, () => {
      expect(skill.manaCost).toBeGreaterThan(0);
    });

    it(`${id} has cooldown > 0`, () => {
      expect(skill.cooldown).toBeGreaterThan(0);
    });
  }
});

// ---------------------------------------------------------------------------
// 8. Specific skill characteristics — VAL-SKILL-006
// ---------------------------------------------------------------------------
describe('Rogue skill-specific characteristics', () => {
  it('Death Mark: debuff target, amplifies damage, in assassination tree', () => {
    const s = skillById('death_mark');
    expect(s.tree).toBe('assassination');
    expect(s.damageType).toBe('physical');
    // Has buff with damageAmplify stat
    expect(s.buff).toBeDefined();
    expect(s.buff!.stat).toBe('damageAmplify');
    expect(s.buff!.value).toBeGreaterThan(0);
    expect(s.buff!.duration).toBeGreaterThan(0);
    // Has some damage component as well
    expect(s.damageMultiplier).toBeGreaterThanOrEqual(0);
    expect(s.range).toBeGreaterThanOrEqual(1);
  });

  it('Poison Cloud: poison AoE DoT, damageType poison, in traps tree', () => {
    const s = skillById('poison_cloud');
    expect(s.damageType).toBe('poison');
    expect(s.tree).toBe('traps');
    expect(s.aoe).toBe(true);
    expect(s.aoeRadius).toBeGreaterThan(0);
    expect(s.damageMultiplier).toBeGreaterThan(0);
  });

  it('Slow Trap: placed trap that slows enemies, in traps tree', () => {
    const s = skillById('slow_trap');
    expect(s.tree).toBe('traps');
    expect(s.aoe).toBe(true);
    expect(s.aoeRadius).toBeGreaterThan(0);
    // Has slow buff/debuff
    expect(s.buff).toBeDefined();
    expect(s.buff!.stat).toBe('slowEffect');
    expect(s.buff!.value).toBeGreaterThan(0);
    expect(s.buff!.duration).toBeGreaterThan(0);
  });

  it('Chain Trap: multi-target trap, in traps tree', () => {
    const s = skillById('chain_trap');
    expect(s.tree).toBe('traps');
    expect(s.aoe).toBe(true);
    expect(s.aoeRadius).toBeGreaterThan(0);
    expect(s.damageMultiplier).toBeGreaterThan(0);
    // Has stun duration for chain binding
    expect(s.stunDuration).toBeDefined();
    expect(s.stunDuration).toBeGreaterThan(0);
  });

  it('Piercing Arrow: ranged physical that pierces through enemies, in archery tree', () => {
    const s = skillById('piercing_arrow');
    expect(s.tree).toBe('archery');
    expect(s.damageType).toBe('physical');
    expect(s.range).toBeGreaterThanOrEqual(4);
    expect(s.damageMultiplier).toBeGreaterThan(0);
    // AoE for piercing (hits through enemies)
    expect(s.aoe).toBe(true);
    expect(s.aoeRadius).toBeGreaterThan(0);
  });

  it('Poison Arrow: ranged poison DoT, damageType poison, in archery tree', () => {
    const s = skillById('poison_arrow');
    expect(s.tree).toBe('archery');
    expect(s.damageType).toBe('poison');
    expect(s.range).toBeGreaterThanOrEqual(4);
    expect(s.damageMultiplier).toBeGreaterThan(0);
  });

  it('Shadow Step: reposition to target, crit buff, in assassination tree', () => {
    const s = skillById('shadow_step');
    expect(s.tree).toBe('assassination');
    expect(s.damageType).toBe('physical');
    expect(s.damageMultiplier).toBe(0); // utility skill
    expect(s.range).toBeGreaterThanOrEqual(3);
    // Has buff for crit bonus
    expect(s.buff).toBeDefined();
    expect(s.buff!.duration).toBeGreaterThan(0);
    expect(s.manaCost).toBeGreaterThan(0);
    expect(s.cooldown).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 9. Death Mark amplifies subsequent damage — VAL-SKILL-006
// ---------------------------------------------------------------------------
describe('Death Mark damage amplification', () => {
  it('Death Mark buff stat is damageAmplify', () => {
    const s = skillById('death_mark');
    expect(s.buff).toBeDefined();
    expect(s.buff!.stat).toBe('damageAmplify');
  });

  it('Death Mark buff value > 0 (amplifies damage)', () => {
    const s = skillById('death_mark');
    expect(s.buff!.value).toBeGreaterThan(0);
    expect(s.buff!.value).toBeLessThanOrEqual(1.0); // reasonable cap
  });

  it('Death Mark buff duration is meaningful (> 3s)', () => {
    const s = skillById('death_mark');
    expect(s.buff!.duration).toBeGreaterThanOrEqual(3000);
  });

  it('Death Mark buff value scales with level', () => {
    const s = skillById('death_mark');
    if (s.scaling?.buffValuePerLevel) {
      const v1 = getSkillBuffValue(s, 1);
      const v10 = getSkillBuffValue(s, 10);
      expect(v10).toBeGreaterThan(v1);
    }
  });
});

// ---------------------------------------------------------------------------
// 10. Piercing Arrow hits through enemies — VAL-SKILL-006
// ---------------------------------------------------------------------------
describe('Piercing Arrow pierce mechanic', () => {
  it('Piercing Arrow is AoE (hits through enemies)', () => {
    const s = skillById('piercing_arrow');
    expect(s.aoe).toBe(true);
  });

  it('Piercing Arrow has aoeRadius for pierce area', () => {
    const s = skillById('piercing_arrow');
    expect(s.aoeRadius).toBeDefined();
    expect(s.aoeRadius).toBeGreaterThan(0);
  });

  it('Piercing Arrow has physical damageType', () => {
    const s = skillById('piercing_arrow');
    expect(s.damageType).toBe('physical');
  });

  it('Piercing Arrow has ranged range (≥ 4)', () => {
    const s = skillById('piercing_arrow');
    expect(s.range).toBeGreaterThanOrEqual(4);
  });
});

// ---------------------------------------------------------------------------
// 11. Scaling fields — VAL-SKILL-012
// ---------------------------------------------------------------------------
describe('Rogue skill scaling', () => {
  for (const skill of ALL_SKILLS) {
    if (skill.scaling) {
      it(`${skill.id} scaling.damagePerLevel ≥ 0`, () => {
        expect(skill.scaling!.damagePerLevel).toBeGreaterThanOrEqual(0);
      });

      it(`${skill.id} scaling.manaCostPerLevel ≥ 0`, () => {
        expect(skill.scaling!.manaCostPerLevel).toBeGreaterThanOrEqual(0);
      });
    }
  }

  // D2-style tiered scaling: levels 1-8 full, 9-16 75%, 17-20 50%
  it('tiered scaling applies diminishing returns for damage multiplier', () => {
    const skill = skillById('backstab');
    const lvl1 = getSkillDamageMultiplier(skill, 1);
    const lvl8 = getSkillDamageMultiplier(skill, 8);
    const lvl16 = getSkillDamageMultiplier(skill, 16);
    const lvl20 = getSkillDamageMultiplier(skill, 20);

    // lvl8 > lvl1 (grows)
    expect(lvl8).toBeGreaterThan(lvl1);

    // Growth from 9-16 should be less than 1-8 (diminishing)
    const growth1to8 = lvl8 - lvl1;
    const growth9to16 = lvl16 - lvl8;
    expect(growth9to16).toBeLessThan(growth1to8);

    // Growth from 17-20 should be even less per level
    const growth17to20 = lvl20 - lvl16;
    expect(growth17to20 / 4).toBeLessThan(growth9to16 / 8);
  });

  it('mana cost scales up with level for new skills', () => {
    const skill = skillById('death_mark');
    const mana1 = getSkillManaCost(skill, 1);
    const mana10 = getSkillManaCost(skill, 10);
    expect(mana10).toBeGreaterThan(mana1);
  });

  it('cooldown scales down with level (when cooldownReductionPerLevel set)', () => {
    const skill = skillById('piercing_arrow');
    if (skill.scaling?.cooldownReductionPerLevel) {
      const cd1 = getSkillCooldown(skill, 1);
      const cd10 = getSkillCooldown(skill, 10);
      expect(cd10).toBeLessThan(cd1);
      // Cooldown should never go below 500ms
      const cd20 = getSkillCooldown(skill, 20);
      expect(cd20).toBeGreaterThanOrEqual(500);
    }
  });

  it('AoE radius scales up for poison_cloud', () => {
    const skill = skillById('poison_cloud');
    if (skill.scaling?.aoeRadiusPerLevel) {
      const r1 = getSkillAoeRadius(skill, 1);
      const r10 = getSkillAoeRadius(skill, 10);
      expect(r10).toBeGreaterThan(r1);
    }
  });
});

// ---------------------------------------------------------------------------
// 12. Synergy bonus computation — VAL-SKILL-008
// ---------------------------------------------------------------------------
describe('Rogue synergy bonus computation', () => {
  it('getSynergyBonus returns 1 (no bonus) when synergy skill has 0 points', () => {
    const skill = skillById('death_mark');
    const levels: Record<string, number> = { backstab: 0, poison_blade: 0 };
    const bonus = getSynergyBonus(skill, levels);
    expect(bonus).toBe(1);
  });

  it('getSynergyBonus returns > 1 when synergy skill has points', () => {
    const skill = skillById('death_mark');
    const levels: Record<string, number> = { backstab: 5, poison_blade: 0 };
    const bonus = getSynergyBonus(skill, levels);
    expect(bonus).toBeGreaterThan(1);
  });

  it('getSynergyBonus scales with synergy skill level', () => {
    const skill = skillById('piercing_arrow');
    const levels1: Record<string, number> = { multishot: 1, arrow_rain: 0 };
    const levels5: Record<string, number> = { multishot: 5, arrow_rain: 0 };
    const bonus1 = getSynergyBonus(skill, levels1);
    const bonus5 = getSynergyBonus(skill, levels5);
    expect(bonus5).toBeGreaterThan(bonus1);
  });

  it('new skill synergies reference valid existing rogue skills', () => {
    for (const id of NEW_SKILL_IDS) {
      const skill = skillById(id);
      if (skill.synergies) {
        for (const syn of skill.synergies) {
          expect(SKILL_IDS).toContain(syn.skillId);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 13. Icon naming convention
// ---------------------------------------------------------------------------
describe('Rogue skill icon naming', () => {
  for (const skill of ALL_SKILLS) {
    it(`${skill.id} icon starts with 'skill_'`, () => {
      expect(skill.icon.startsWith('skill_')).toBe(true);
    });
  }

  // New skills specifically should have 'skill_icon_{id}' pattern
  for (const id of NEW_SKILL_IDS) {
    it(`new skill ${id} has a matching icon key`, () => {
      const skill = skillById(id);
      const validIcons = [`skill_icon_${id}`, `skill_${id}`];
      expect(validIcons).toContain(skill.icon);
    });
  }
});

// ---------------------------------------------------------------------------
// 14. VFX case coverage (static analysis via skill ID format)
// ---------------------------------------------------------------------------
describe('Rogue VFX coverage', () => {
  it('all rogue skill IDs have valid format for VFX case matching', () => {
    const allIds = ALL_SKILLS.map(s => s.id);
    for (const id of allIds) {
      expect(id).toMatch(/^[a-z_]+$/);
    }
  });
});

// ---------------------------------------------------------------------------
// 15. damageType validity
// ---------------------------------------------------------------------------
describe('Rogue skill damageType', () => {
  for (const skill of ALL_SKILLS) {
    it(`${skill.id} has a valid rogue damageType`, () => {
      expect(VALID_DAMAGE_TYPES).toContain(skill.damageType);
    });
  }

  it('assassination tree skills use physical or poison damageType', () => {
    const assSkills = ALL_SKILLS.filter(s => s.tree === 'assassination');
    for (const skill of assSkills) {
      expect(['physical', 'poison']).toContain(skill.damageType);
    }
  });

  it('archery tree skills use physical or poison damageType', () => {
    const archSkills = ALL_SKILLS.filter(s => s.tree === 'archery');
    for (const skill of archSkills) {
      expect(['physical', 'poison']).toContain(skill.damageType);
    }
  });

  it('poison_cloud uses poison damageType', () => {
    const s = skillById('poison_cloud');
    expect(s.damageType).toBe('poison');
  });

  it('poison_arrow uses poison damageType', () => {
    const s = skillById('poison_arrow');
    expect(s.damageType).toBe('poison');
  });
});

// ---------------------------------------------------------------------------
// 16. maxLevel consistency
// ---------------------------------------------------------------------------
describe('Rogue skill maxLevel', () => {
  for (const skill of ALL_SKILLS) {
    it(`${skill.id} has maxLevel = 20`, () => {
      expect(skill.maxLevel).toBe(20);
    });
  }
});

// ---------------------------------------------------------------------------
// 17. Original skills unchanged — VAL-SKILL-013
// ---------------------------------------------------------------------------
describe('Original rogue skills unchanged', () => {
  it('Backstab: physical, tier 1, damageMultiplier 2.0', () => {
    const s = skillById('backstab');
    expect(s.damageType).toBe('physical');
    expect(s.tier).toBe(1);
    expect(s.damageMultiplier).toBe(2.0);
    expect(s.manaCost).toBe(10);
    expect(s.cooldown).toBe(2500);
    expect(s.range).toBe(1.5);
    expect(s.critBonus).toBe(20);
  });

  it('Poison Blade: poison, tier 2, buff poisonDamage', () => {
    const s = skillById('poison_blade');
    expect(s.damageType).toBe('poison');
    expect(s.tier).toBe(2);
    expect(s.buff).toBeDefined();
    expect(s.buff!.stat).toBe('poisonDamage');
  });

  it('Vanish: physical, tier 3, buff stealthDamage', () => {
    const s = skillById('vanish');
    expect(s.damageType).toBe('physical');
    expect(s.tier).toBe(3);
    expect(s.buff).toBeDefined();
    expect(s.buff!.stat).toBe('stealthDamage');
  });

  it('Multi Shot: physical, tier 1, damageMultiplier 0.8, aoe', () => {
    const s = skillById('multishot');
    expect(s.damageType).toBe('physical');
    expect(s.tier).toBe(1);
    expect(s.damageMultiplier).toBe(0.8);
    expect(s.aoe).toBe(true);
  });

  it('Arrow Rain: physical, tier 3, damageMultiplier 0.6, aoe', () => {
    const s = skillById('arrow_rain');
    expect(s.damageType).toBe('physical');
    expect(s.tier).toBe(3);
    expect(s.damageMultiplier).toBe(0.6);
    expect(s.aoe).toBe(true);
  });

  it('Explosive Trap: fire, tier 1, damageMultiplier 1.5, aoe', () => {
    const s = skillById('explosive_trap');
    expect(s.damageType).toBe('fire');
    expect(s.tier).toBe(1);
    expect(s.damageMultiplier).toBe(1.5);
    expect(s.aoe).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 18. Buff skills have correct scaling
// ---------------------------------------------------------------------------
describe('Rogue buff skill scaling', () => {
  const buffSkills = ALL_SKILLS.filter(s => s.buff);

  for (const skill of buffSkills) {
    if (skill.scaling?.buffValuePerLevel) {
      it(`${skill.id} buff value increases with level`, () => {
        const v1 = getSkillBuffValue(skill, 1);
        const v10 = getSkillBuffValue(skill, 10);
        expect(v10).toBeGreaterThan(v1);
      });
    }
  }
});

// ---------------------------------------------------------------------------
// 19. Tree balance
// ---------------------------------------------------------------------------
describe('Rogue tree balance', () => {
  it('assassination tree has 5 skills', () => {
    expect(ALL_SKILLS.filter(s => s.tree === 'assassination')).toHaveLength(5);
  });

  it('archery tree has 4 skills', () => {
    expect(ALL_SKILLS.filter(s => s.tree === 'archery')).toHaveLength(4);
  });

  it('traps tree has 4 skills', () => {
    expect(ALL_SKILLS.filter(s => s.tree === 'traps')).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// 20. Vanish has synergies (was missing before expansion)
// ---------------------------------------------------------------------------
describe('Vanish synergies added', () => {
  it('Vanish now has at least one synergy', () => {
    const s = skillById('vanish');
    expect(s.synergies).toBeDefined();
    expect(s.synergies!.length).toBeGreaterThanOrEqual(1);
  });

  it('Vanish synergies reference valid rogue skills', () => {
    const s = skillById('vanish');
    for (const syn of s.synergies!) {
      expect(SKILL_IDS).toContain(syn.skillId);
    }
  });
});
