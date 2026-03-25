import { describe, it, expect } from 'vitest';
import { MageClass } from '../data/classes/mage';
import type { SkillDefinition } from '../data/types';
import { getSkillDamageMultiplier, getSkillManaCost, getSkillCooldown, getSkillAoeRadius, getSkillBuffValue, getSynergyBonus } from '../systems/CombatSystem';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const ALL_SKILLS = MageClass.skills;
const SKILL_IDS = ALL_SKILLS.map(s => s.id);
const skillById = (id: string): SkillDefinition =>
  ALL_SKILLS.find(s => s.id === id)!;

// The 6 new skills added by mage-skills-expansion
const NEW_SKILL_IDS = [
  'fire_wall', 'combustion',
  'ice_arrow', 'freeze',
  'teleport', 'arcane_torrent',
];

// Original 6 mage skills
const ORIGINAL_SKILL_IDS = [
  'fireball', 'meteor',
  'blizzard', 'ice_armor',
  'chain_lightning', 'mana_shield',
];

// Active new skills that must have mana cost > 0 and cooldown > 0
const ACTIVE_NEW_SKILL_IDS = [
  'fire_wall', 'combustion',
  'ice_arrow', 'freeze',
  'teleport', 'arcane_torrent',
];

// Valid mage trees
const VALID_TREES = ['fire', 'frost', 'arcane'];

// Valid mage damage types
const VALID_DAMAGE_TYPES = ['fire', 'ice', 'lightning', 'arcane'];

// Required fields every skill must have
const REQUIRED_FIELDS: (keyof SkillDefinition)[] = [
  'id', 'name', 'nameEn', 'description', 'tree', 'tier', 'maxLevel',
  'manaCost', 'cooldown', 'range', 'damageMultiplier', 'damageType', 'icon',
];

// ---------------------------------------------------------------------------
// 1. Mage skill count — VAL-SKILL-002
// ---------------------------------------------------------------------------
describe('Mage skill count', () => {
  it('has exactly 12 total skills (6 original + 6 new)', () => {
    expect(ALL_SKILLS).toHaveLength(12);
  });

  it('includes all 6 new skill IDs', () => {
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
// 2. Required fields — VAL-SKILL-002
// ---------------------------------------------------------------------------
describe('Mage skill required fields', () => {
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
// 3. Chinese names and descriptions — VAL-SKILL-002
// ---------------------------------------------------------------------------
describe('Mage skill Chinese text', () => {
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
// 4. Tree and tier validity — VAL-SKILL-002
// ---------------------------------------------------------------------------
describe('Mage skill tree/tier validity', () => {
  for (const skill of ALL_SKILLS) {
    it(`${skill.id} is in a valid tree`, () => {
      expect(VALID_TREES, `${skill.id} tree: ${skill.tree}`).toContain(skill.tree);
    });

    it(`${skill.id} tier is 1-3`, () => {
      expect(skill.tier).toBeGreaterThanOrEqual(1);
      expect(skill.tier).toBeLessThanOrEqual(3);
    });
  }

  it('fire tree has correct skills', () => {
    const fSkills = ALL_SKILLS.filter(s => s.tree === 'fire').map(s => s.id);
    expect(fSkills).toContain('fireball');
    expect(fSkills).toContain('meteor');
    expect(fSkills).toContain('fire_wall');
    expect(fSkills).toContain('combustion');
  });

  it('frost tree has correct skills', () => {
    const frSkills = ALL_SKILLS.filter(s => s.tree === 'frost').map(s => s.id);
    expect(frSkills).toContain('blizzard');
    expect(frSkills).toContain('ice_armor');
    expect(frSkills).toContain('ice_arrow');
    expect(frSkills).toContain('freeze');
  });

  it('arcane tree has correct skills', () => {
    const aSkills = ALL_SKILLS.filter(s => s.tree === 'arcane').map(s => s.id);
    expect(aSkills).toContain('chain_lightning');
    expect(aSkills).toContain('mana_shield');
    expect(aSkills).toContain('teleport');
    expect(aSkills).toContain('arcane_torrent');
  });
});

// ---------------------------------------------------------------------------
// 5. Damage multiplier caps — VAL-SKILL-012
// ---------------------------------------------------------------------------
describe('Mage skill damage multiplier caps', () => {
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
describe('Mage skill synergy references', () => {
  for (const skill of ALL_SKILLS) {
    if (skill.synergies && skill.synergies.length > 0) {
      for (const syn of skill.synergies) {
        it(`${skill.id} synergy ${syn.skillId} references a valid mage skill`, () => {
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
describe('Mage active new skills: manaCost and cooldown', () => {
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
// 8. Specific skill characteristics — VAL-SKILL-005
// ---------------------------------------------------------------------------
describe('Mage skill-specific characteristics', () => {
  it('Fire Wall: fire AoE zone, damageType fire, in fire tree', () => {
    const s = skillById('fire_wall');
    expect(s.damageType).toBe('fire');
    expect(s.tree).toBe('fire');
    expect(s.aoe).toBe(true);
    expect(s.aoeRadius).toBeGreaterThan(0);
    expect(s.damageMultiplier).toBeGreaterThan(0);
    expect(s.range).toBeGreaterThanOrEqual(3);
  });

  it('Combustion: fire damage, bonus on burning targets, in fire tree', () => {
    const s = skillById('combustion');
    expect(s.damageType).toBe('fire');
    expect(s.tree).toBe('fire');
    expect(s.damageMultiplier).toBeGreaterThanOrEqual(1.5);
    expect(s.damageMultiplier).toBeLessThanOrEqual(3.0);
    // Should not be buff-only
    expect(s.damageMultiplier).toBeGreaterThan(0);
  });

  it('Ice Arrow: ranged ice projectile, damageType ice, range ≥ 3, in frost tree', () => {
    const s = skillById('ice_arrow');
    expect(s.damageType).toBe('ice');
    expect(s.tree).toBe('frost');
    expect(s.range).toBeGreaterThanOrEqual(3);
    expect(s.damageMultiplier).toBeGreaterThan(0);
    // Should not be AoE (single-target projectile)
    expect(s.aoe).toBeFalsy();
  });

  it('Freeze: immobilize target, damageType ice, applies Freeze status, in frost tree', () => {
    const s = skillById('freeze');
    expect(s.damageType).toBe('ice');
    expect(s.tree).toBe('frost');
    // Must have stunDuration or skill ID includes 'freeze' (ZoneScene checks both)
    // stunDuration is preferred for explicit freeze duration
    expect(s.stunDuration).toBeDefined();
    expect(s.stunDuration).toBeGreaterThan(0);
    // Can have minor damage alongside freeze
    expect(s.damageMultiplier).toBeGreaterThanOrEqual(0);
  });

  it('Teleport: instant reposition, damageMultiplier 0, in arcane tree', () => {
    const s = skillById('teleport');
    expect(s.damageType).toBe('arcane');
    expect(s.tree).toBe('arcane');
    expect(s.damageMultiplier).toBe(0);
    // Should have range for teleport distance
    expect(s.range).toBeGreaterThanOrEqual(3);
    // Not AoE
    expect(s.aoe).toBeFalsy();
    // Not a buff
    expect(s.buff).toBeUndefined();
  });

  it('Arcane Torrent: arcane AoE damage, damageType arcane, in arcane tree', () => {
    const s = skillById('arcane_torrent');
    expect(s.damageType).toBe('arcane');
    expect(s.tree).toBe('arcane');
    expect(s.aoe).toBe(true);
    expect(s.aoeRadius).toBeGreaterThan(0);
    expect(s.damageMultiplier).toBeGreaterThan(0);
    expect(s.damageMultiplier).toBeLessThanOrEqual(3.0);
  });
});

// ---------------------------------------------------------------------------
// 9. Teleport special requirements — VAL-SKILL-005
// ---------------------------------------------------------------------------
describe('Teleport special requirements', () => {
  it('Teleport has damageMultiplier = 0 (utility skill)', () => {
    const s = skillById('teleport');
    expect(s.damageMultiplier).toBe(0);
  });

  it('Teleport has manaCost > 0', () => {
    const s = skillById('teleport');
    expect(s.manaCost).toBeGreaterThan(0);
  });

  it('Teleport has cooldown > 0', () => {
    const s = skillById('teleport');
    expect(s.cooldown).toBeGreaterThan(0);
  });

  it('Teleport range is reasonable (3-10 tiles)', () => {
    const s = skillById('teleport');
    expect(s.range).toBeGreaterThanOrEqual(3);
    expect(s.range).toBeLessThanOrEqual(10);
  });
});

// ---------------------------------------------------------------------------
// 10. Freeze applies Freeze status effect — VAL-SKILL-005
// ---------------------------------------------------------------------------
describe('Freeze status effect application', () => {
  it('Freeze skill has stunDuration > 0 (triggers Freeze in ZoneScene)', () => {
    const s = skillById('freeze');
    expect(s.stunDuration).toBeDefined();
    expect(s.stunDuration!).toBeGreaterThan(0);
    expect(s.stunDuration!).toBeLessThanOrEqual(5000); // reasonable cap
  });

  it('Freeze skill ID includes "freeze" (ZoneScene pattern match)', () => {
    const s = skillById('freeze');
    expect(s.id).toContain('freeze');
  });

  it('Freeze is ice damageType (required for ZoneScene ice status effect logic)', () => {
    const s = skillById('freeze');
    expect(s.damageType).toBe('ice');
  });
});

// ---------------------------------------------------------------------------
// 11. Scaling fields — VAL-SKILL-012
// ---------------------------------------------------------------------------
describe('Mage skill scaling', () => {
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
    const skill = skillById('fireball');
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
    const skill = skillById('fire_wall');
    const mana1 = getSkillManaCost(skill, 1);
    const mana10 = getSkillManaCost(skill, 10);
    expect(mana10).toBeGreaterThan(mana1);
  });

  it('cooldown scales down with level (when cooldownReductionPerLevel set)', () => {
    const skill = skillById('ice_arrow');
    if (skill.scaling?.cooldownReductionPerLevel) {
      const cd1 = getSkillCooldown(skill, 1);
      const cd10 = getSkillCooldown(skill, 10);
      expect(cd10).toBeLessThan(cd1);
      // Cooldown should never go below 500ms
      const cd20 = getSkillCooldown(skill, 20);
      expect(cd20).toBeGreaterThanOrEqual(500);
    }
  });

  it('AoE radius scales up for fire_wall', () => {
    const skill = skillById('fire_wall');
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
describe('Mage synergy bonus computation', () => {
  it('getSynergyBonus returns 1 (no bonus) when synergy skill has 0 points', () => {
    const skill = skillById('fire_wall');
    const levels: Record<string, number> = { fireball: 0, combustion: 0 };
    const bonus = getSynergyBonus(skill, levels);
    expect(bonus).toBe(1);
  });

  it('getSynergyBonus returns > 1 when synergy skill has points', () => {
    const skill = skillById('fire_wall');
    const levels: Record<string, number> = { fireball: 5, combustion: 0 };
    const bonus = getSynergyBonus(skill, levels);
    expect(bonus).toBeGreaterThan(1);
  });

  it('getSynergyBonus scales with synergy skill level', () => {
    const skill = skillById('combustion');
    const levels1: Record<string, number> = { fireball: 1, fire_wall: 0, meteor: 0 };
    const levels5: Record<string, number> = { fireball: 5, fire_wall: 0, meteor: 0 };
    const bonus1 = getSynergyBonus(skill, levels1);
    const bonus5 = getSynergyBonus(skill, levels5);
    expect(bonus5).toBeGreaterThan(bonus1);
  });

  it('new skill synergies reference valid existing mage skills', () => {
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
describe('Mage skill icon naming', () => {
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
describe('Mage VFX coverage', () => {
  it('all mage skill IDs have valid format for VFX case matching', () => {
    const allIds = ALL_SKILLS.map(s => s.id);
    for (const id of allIds) {
      expect(id).toMatch(/^[a-z_]+$/);
    }
  });
});

// ---------------------------------------------------------------------------
// 15. damageType validity
// ---------------------------------------------------------------------------
describe('Mage skill damageType', () => {
  for (const skill of ALL_SKILLS) {
    it(`${skill.id} has a valid mage damageType`, () => {
      expect(VALID_DAMAGE_TYPES).toContain(skill.damageType);
    });
  }

  it('fire tree skills use fire damageType', () => {
    const fireSkills = ALL_SKILLS.filter(s => s.tree === 'fire');
    for (const skill of fireSkills) {
      expect(skill.damageType).toBe('fire');
    }
  });

  it('frost tree skills use ice damageType', () => {
    const frostSkills = ALL_SKILLS.filter(s => s.tree === 'frost');
    for (const skill of frostSkills) {
      expect(skill.damageType).toBe('ice');
    }
  });

  it('arcane tree skills use arcane or lightning damageType', () => {
    const arcaneSkills = ALL_SKILLS.filter(s => s.tree === 'arcane');
    for (const skill of arcaneSkills) {
      expect(['arcane', 'lightning']).toContain(skill.damageType);
    }
  });
});

// ---------------------------------------------------------------------------
// 16. maxLevel consistency
// ---------------------------------------------------------------------------
describe('Mage skill maxLevel', () => {
  for (const skill of ALL_SKILLS) {
    it(`${skill.id} has maxLevel = 20`, () => {
      expect(skill.maxLevel).toBe(20);
    });
  }
});

// ---------------------------------------------------------------------------
// 17. Original skills unchanged — VAL-SKILL-013
// ---------------------------------------------------------------------------
describe('Original mage skills unchanged', () => {
  it('Fireball: fire, tier 1, damageMultiplier 1.8', () => {
    const s = skillById('fireball');
    expect(s.damageType).toBe('fire');
    expect(s.tier).toBe(1);
    expect(s.damageMultiplier).toBe(1.8);
    expect(s.manaCost).toBe(10);
    expect(s.cooldown).toBe(2000);
    expect(s.range).toBe(6);
  });

  it('Meteor: fire, tier 3, damageMultiplier 2.5', () => {
    const s = skillById('meteor');
    expect(s.damageType).toBe('fire');
    expect(s.tier).toBe(3);
    expect(s.damageMultiplier).toBe(2.5);
    expect(s.aoe).toBe(true);
  });

  it('Blizzard: ice, tier 2, damageMultiplier 1.0', () => {
    const s = skillById('blizzard');
    expect(s.damageType).toBe('ice');
    expect(s.tier).toBe(2);
    expect(s.damageMultiplier).toBe(1.0);
    expect(s.aoe).toBe(true);
  });

  it('Ice Armor: ice, tier 1, buff damageReduction', () => {
    const s = skillById('ice_armor');
    expect(s.damageType).toBe('ice');
    expect(s.tier).toBe(1);
    expect(s.buff).toBeDefined();
    expect(s.buff!.stat).toBe('damageReduction');
  });

  it('Chain Lightning: lightning, tier 2, damageMultiplier 1.3', () => {
    const s = skillById('chain_lightning');
    expect(s.damageType).toBe('lightning');
    expect(s.tier).toBe(2);
    expect(s.damageMultiplier).toBe(1.3);
  });

  it('Mana Shield: arcane, tier 1, buff manaShield', () => {
    const s = skillById('mana_shield');
    expect(s.damageType).toBe('arcane');
    expect(s.tier).toBe(1);
    expect(s.buff).toBeDefined();
    expect(s.buff!.stat).toBe('manaShield');
  });
});

// ---------------------------------------------------------------------------
// 18. Buff skills have correct scaling
// ---------------------------------------------------------------------------
describe('Mage buff skill scaling', () => {
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
// 19. Each tree has 4 skills (balanced distribution)
// ---------------------------------------------------------------------------
describe('Mage tree balance', () => {
  it('fire tree has 4 skills', () => {
    expect(ALL_SKILLS.filter(s => s.tree === 'fire')).toHaveLength(4);
  });

  it('frost tree has 4 skills', () => {
    expect(ALL_SKILLS.filter(s => s.tree === 'frost')).toHaveLength(4);
  });

  it('arcane tree has 4 skills', () => {
    expect(ALL_SKILLS.filter(s => s.tree === 'arcane')).toHaveLength(4);
  });
});
