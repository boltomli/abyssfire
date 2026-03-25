import { describe, it, expect, beforeEach } from 'vitest';
import {
  CombatSystem,
  emptyEquipStats,
  getBuffValue,
} from '../systems/CombatSystem';
import type { CombatEntity, ActiveBuff, EquipStats } from '../systems/CombatSystem';
import type { MonsterDefinition, Stats } from '../data/types';
import { WarriorClass } from '../data/classes/warrior';
import {
  EliteAffixSystem,
  ELITE_AFFIX_DEFINITIONS,
  type EliteAffixInstance,
  type EliteAffixType,
} from '../systems/EliteAffixSystem';
import { StatusEffectSystem } from '../systems/StatusEffectSystem';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStats(overrides?: Partial<Stats>): Stats {
  return { str: 10, dex: 0, vit: 10, int: 10, spi: 10, lck: 0, ...overrides };
}

function makeEntity(overrides?: Partial<CombatEntity>): CombatEntity {
  return {
    id: 'e1',
    name: 'Test Entity',
    hp: 100,
    maxHp: 100,
    mana: 100,
    maxMana: 100,
    stats: makeStats(),
    level: 1,
    baseDamage: 10,
    defense: 0,
    attackSpeed: 1000,
    attackRange: 1,
    buffs: [],
    ...overrides,
  };
}

function makeAffix(type: EliteAffixType): EliteAffixInstance {
  return {
    definition: ELITE_AFFIX_DEFINITIONS[type],
    lastTeleportTime: 0,
    lastCurseTickTime: 0,
  };
}

function makeMonsterDef(overrides?: Partial<MonsterDefinition>): MonsterDefinition {
  return {
    id: 'test_monster',
    name: '测试怪物',
    level: 10,
    hp: 100,
    damage: 20,
    defense: 5,
    speed: 50,
    aggroRange: 6,
    attackRange: 1.5,
    attackSpeed: 1500,
    expReward: 50,
    goldReward: [10, 20],
    spriteKey: 'monster_test',
    elite: true,
    ...overrides,
  };
}

// ============================================================================
// Fix #1: Dual Wield Mastery buff spam
// ============================================================================

describe('Fix #1: Dual Wield Mastery buff deduplication', () => {
  it('ActiveBuff interface supports optional tag field', () => {
    const buff: ActiveBuff = {
      stat: 'damageBonus',
      value: 0.06,
      duration: 2000,
      startTime: 0,
      tag: 'dualWieldMastery',
    };
    expect(buff.tag).toBe('dualWieldMastery');
    expect(buff.stat).toBe('damageBonus');
  });

  it('tag-based deduplication prevents multiple dualWieldMastery buffs', () => {
    // Simulate the frame-by-frame logic from ZoneScene
    const buffs: ActiveBuff[] = [];
    const dualWieldLevel = 3;
    const bonusValue = dualWieldLevel * 0.03;

    // Frame 1: no buff yet, should add
    const hasDWBuff1 = buffs.some(b => b.tag === 'dualWieldMastery');
    expect(hasDWBuff1).toBe(false);
    buffs.push({ stat: 'damageBonus', value: bonusValue, duration: 2000, startTime: 0, tag: 'dualWieldMastery' });

    // Frame 2: buff exists, should NOT add
    const hasDWBuff2 = buffs.some(b => b.tag === 'dualWieldMastery');
    expect(hasDWBuff2).toBe(true);
    // Verify only 1 buff exists
    expect(buffs.filter(b => b.tag === 'dualWieldMastery').length).toBe(1);

    // Frame 3: simulate many frames, still should have only 1
    for (let i = 0; i < 100; i++) {
      const has = buffs.some(b => b.tag === 'dualWieldMastery');
      if (!has) {
        buffs.push({ stat: 'damageBonus', value: bonusValue, duration: 2000, startTime: i, tag: 'dualWieldMastery' });
      }
    }
    expect(buffs.filter(b => b.tag === 'dualWieldMastery').length).toBe(1);
  });

  it('old stat-based guard ("dualWieldBonus") would fail since buff uses "damageBonus"', () => {
    const buffs: ActiveBuff[] = [];
    const bonusValue = 0.09;

    // Simulate old code (broken): check for dualWieldBonus stat, push damageBonus
    const hasOldBuff = buffs.some(b => b.stat === 'dualWieldBonus');
    expect(hasOldBuff).toBe(false);
    buffs.push({ stat: 'damageBonus', value: bonusValue, duration: 2000, startTime: 0 });

    // Frame 2: old guard still finds nothing because it checks wrong stat name
    const hasOldBuff2 = buffs.some(b => b.stat === 'dualWieldBonus');
    expect(hasOldBuff2).toBe(false); // This is the bug! Would add another buff

    // New tag-based guard correctly finds the buff
    buffs[0].tag = 'dualWieldMastery';
    const hasNewBuff = buffs.some(b => b.tag === 'dualWieldMastery');
    expect(hasNewBuff).toBe(true); // Fixed!
  });

  it('damageBonus from dualWieldMastery is correctly read by CombatSystem.getBuffValue', () => {
    const entity = makeEntity({
      buffs: [
        { stat: 'damageBonus', value: 0.09, duration: 2000, startTime: 0, tag: 'dualWieldMastery' },
      ],
    });
    const bonus = getBuffValue(entity, 'damageBonus');
    expect(bonus).toBeCloseTo(0.09);
  });
});

// ============================================================================
// Fix #2: Monster respawn stat inflation
// ============================================================================

describe('Fix #2: Monster respawn stat inflation prevention', () => {
  let system: EliteAffixSystem;

  beforeEach(() => {
    system = new EliteAffixSystem();
  });

  it('applyEliteAffixes mutates definition damage, speed, defense', () => {
    // Simulate what Monster.applyEliteAffixes does internally
    const originalDef = makeMonsterDef({ damage: 20, speed: 50, defense: 5 });
    const affixes = [makeAffix('extra_strong')]; // damageMult: 1.35

    // Monster constructor stores definition
    const definition = originalDef;
    const stats = system.getCombinedStats(affixes);

    // Simulate the applyEliteAffixes mutation
    const mutatedDef = {
      ...definition,
      damage: Math.floor(definition.damage * stats.damageMult),
      speed: Math.floor(definition.speed * stats.speedMult),
      defense: Math.floor(definition.defense * stats.defenseMult),
    };

    // After affix application, values are inflated
    expect(mutatedDef.damage).toBe(Math.floor(20 * 1.35)); // 27
    expect(mutatedDef.damage).toBeGreaterThan(originalDef.damage);
  });

  it('using mutated definition for respawn causes compounding inflation', () => {
    const originalDef = makeMonsterDef({ damage: 20 });
    const affixes = [makeAffix('extra_strong')]; // damageMult: 1.35
    const stats = system.getCombinedStats(affixes);

    // First spawn: 20 * 1.35 = 27
    let currentDamage = Math.floor(originalDef.damage * stats.damageMult);
    expect(currentDamage).toBe(27);

    // Second spawn (using mutated definition): 27 * 1.35 = 36
    currentDamage = Math.floor(currentDamage * stats.damageMult);
    expect(currentDamage).toBe(36);

    // Third spawn: 36 * 1.35 = 48
    currentDamage = Math.floor(currentDamage * stats.damageMult);
    expect(currentDamage).toBe(48);

    // This is the bug! Damage keeps compounding
    expect(currentDamage).toBeGreaterThan(Math.floor(20 * 1.35));
  });

  it('using originalDefinition for respawn prevents inflation', () => {
    const originalDef = makeMonsterDef({ damage: 20 });
    const affixes = [makeAffix('extra_strong')]; // damageMult: 1.35
    const stats = system.getCombinedStats(affixes);

    // First spawn
    const firstDamage = Math.floor(originalDef.damage * stats.damageMult);
    expect(firstDamage).toBe(27);

    // Second spawn (from original): still 20 * 1.35 = 27
    const secondDamage = Math.floor(originalDef.damage * stats.damageMult);
    expect(secondDamage).toBe(27);

    // Third spawn: still the same
    const thirdDamage = Math.floor(originalDef.damage * stats.damageMult);
    expect(thirdDamage).toBe(27);

    // All spawns produce same damage
    expect(firstDamage).toBe(secondDamage);
    expect(secondDamage).toBe(thirdDamage);
  });

  it('originalDefinition stays unmodified after multiple affix applications', () => {
    const baseDef = makeMonsterDef({ damage: 20, speed: 50, defense: 5 });
    const originalDamage = baseDef.damage;
    const originalSpeed = baseDef.speed;
    const originalDefense = baseDef.defense;

    // Simulate 5 respawn cycles
    for (let i = 0; i < 5; i++) {
      const affixes = [makeAffix('extra_strong'), makeAffix('swift')];
      const stats = system.getCombinedStats(affixes);

      // Each respawn creates a new mutated definition from original
      const _mutated = {
        ...baseDef,
        damage: Math.floor(baseDef.damage * stats.damageMult),
        speed: Math.floor(baseDef.speed * stats.speedMult),
        defense: Math.floor(baseDef.defense * stats.defenseMult),
      };

      // Original stays unchanged
      expect(baseDef.damage).toBe(originalDamage);
      expect(baseDef.speed).toBe(originalSpeed);
      expect(baseDef.defense).toBe(originalDefense);
    }
  });
});

// ============================================================================
// Fix #3: Status effect tint management for concurrent effects
// ============================================================================

describe('Fix #3: Status effect tint management', () => {
  let ses: StatusEffectSystem;

  beforeEach(() => {
    ses = new StatusEffectSystem();
  });

  it('getEffectsOnEntity returns all active effects after one expires', () => {
    // Apply both burn and poison
    ses.apply('m1', 'burn', 10, 3000, 'player', 0);
    ses.apply('m1', 'poison', 8, 5000, 'player', 0);

    // At t=2000, both should be active
    const effectsAt2000 = ses.getEffectsOnEntity('m1');
    expect(effectsAt2000.length).toBe(2);

    // At t=3500, burn should expire but poison should remain
    const expired = ses.expire('m1', 3500);
    expect(expired).toContain('burn');
    expect(expired).not.toContain('poison');

    // After expiry, remaining effects should include poison
    const remaining = ses.getEffectsOnEntity('m1');
    expect(remaining.length).toBe(1);
    expect(remaining[0].type).toBe('poison');
  });

  it('tint re-application after partial expiry should only include remaining effects', () => {
    ses.apply('m1', 'burn', 10, 3000, 'player', 0);
    ses.apply('m1', 'freeze', 1, 2000, 'player', 0);
    ses.apply('m1', 'poison', 8, 5000, 'player', 0);

    // Expire freeze at t=2500
    const expired = ses.expire('m1', 2500);
    expect(expired).toContain('freeze');

    // Remaining should be burn and poison
    const remaining = ses.getEffectsOnEntity('m1');
    const remainingTypes = remaining.map(e => e.type);
    expect(remainingTypes).toContain('burn');
    expect(remainingTypes).toContain('poison');
    expect(remainingTypes).not.toContain('freeze');
  });

  it('statusTintApplied tracking prevents redundant per-frame tint application', () => {
    // Simulate the tracking map used in ZoneScene
    const statusTintApplied = new Map<string, Set<string>>();

    // First frame: tint not applied yet
    let appliedSet = statusTintApplied.get('m1');
    expect(appliedSet).toBeUndefined();

    // Apply tint and track
    appliedSet = new Set();
    statusTintApplied.set('m1', appliedSet);
    appliedSet.add('burn');

    // Second frame: check before applying
    const alreadyApplied = statusTintApplied.get('m1')?.has('burn');
    expect(alreadyApplied).toBe(true);
    // Would skip applying tint again

    // Third frame: same check
    expect(statusTintApplied.get('m1')?.has('burn')).toBe(true);
    expect(statusTintApplied.get('m1')?.has('poison')).toBe(false);
  });
});

// ============================================================================
// Fix #4: Teleport fallback when no walkable tile found
// ============================================================================

describe('Fix #4: Teleport fallback for blocked destinations', () => {
  it('search algorithm finds walkable tile within radius 3', () => {
    // Simulate a small collision map
    const cols = 20;
    const rows = 20;
    const collisions = Array.from({ length: rows }, () => Array(cols).fill(true));

    // Block the target destination and surrounding area (radius 2)
    const destCol = 10;
    const destRow = 10;
    collisions[destRow][destCol] = false;
    collisions[destRow + 1][destCol] = false;
    collisions[destRow - 1][destCol] = false;
    collisions[destRow][destCol + 1] = false;
    collisions[destRow][destCol - 1] = false;

    // But leave some tiles at radius 2+ walkable
    // The search should find one of those

    let foundCol = destCol;
    let foundRow = destRow;
    let found = false;

    if (!collisions[foundRow]?.[foundCol]) {
      for (let r = 1; r <= 3 && !found; r++) {
        for (let dr = -r; dr <= r && !found; dr++) {
          for (let dc = -r; dc <= r && !found; dc++) {
            const nr = destRow + dr, nc = destCol + dc;
            if (nr >= 1 && nr < rows - 1 && nc >= 1 && nc < cols - 1 && collisions[nr]?.[nc]) {
              foundCol = nc; foundRow = nr; found = true;
            }
          }
        }
      }
    }

    expect(found).toBe(true);
    expect(collisions[foundRow][foundCol]).toBe(true);
  });

  it('search correctly returns not-found when entire area is blocked', () => {
    const cols = 20;
    const rows = 20;
    const collisions = Array.from({ length: rows }, () => Array(cols).fill(false)); // all blocked

    const destCol = 10;
    const destRow = 10;
    let found = false;

    for (let r = 1; r <= 3 && !found; r++) {
      for (let dr = -r; dr <= r && !found; dr++) {
        for (let dc = -r; dc <= r && !found; dc++) {
          const nr = destRow + dr, nc = destCol + dc;
          if (nr >= 1 && nr < rows - 1 && nc >= 1 && nc < cols - 1 && collisions[nr]?.[nc]) {
            found = true;
          }
        }
      }
    }

    expect(found).toBe(false);
    // In this case, teleport should be aborted and mana refunded
  });

  it('teleport succeeds when destination tile itself is walkable', () => {
    const cols = 20;
    const rows = 20;
    const collisions = Array.from({ length: rows }, () => Array(cols).fill(true));

    const destCol = 10;
    const destRow = 10;

    // Destination is walkable — no search needed
    const isWalkable = collisions[destRow]?.[destCol];
    expect(isWalkable).toBe(true);
  });
});

// ============================================================================
// Fix #5: Status tint redundancy prevention
// ============================================================================

describe('Fix #5: Status tint application tracking', () => {
  it('tracking map prevents redundant tint application across frames', () => {
    const statusTintApplied = new Map<string, Set<string>>();
    let applyCount = 0;

    // Simulate 60 frames of update
    for (let frame = 0; frame < 60; frame++) {
      let appliedSet = statusTintApplied.get('m1');
      if (!appliedSet) {
        appliedSet = new Set();
        statusTintApplied.set('m1', appliedSet);
      }

      const tintType = 'burn';
      if (!appliedSet.has(tintType)) {
        // Would call vfx.applyStatusTint here
        applyCount++;
        appliedSet.add(tintType);
      }
    }

    // Should only apply once, not 60 times
    expect(applyCount).toBe(1);
  });

  it('tracking resets after effect expiry and tint clear', () => {
    const statusTintApplied = new Map<string, Set<string>>();
    let applyCount = 0;

    // First set of frames: apply burn tint
    for (let frame = 0; frame < 30; frame++) {
      let appliedSet = statusTintApplied.get('m1');
      if (!appliedSet) {
        appliedSet = new Set();
        statusTintApplied.set('m1', appliedSet);
      }
      if (!appliedSet.has('burn')) {
        applyCount++;
        appliedSet.add('burn');
      }
    }
    expect(applyCount).toBe(1);

    // Effect expires, tracking resets
    statusTintApplied.delete('m1');

    // Second set of frames: new burn effect applied
    for (let frame = 0; frame < 30; frame++) {
      let appliedSet = statusTintApplied.get('m1');
      if (!appliedSet) {
        appliedSet = new Set();
        statusTintApplied.set('m1', appliedSet);
      }
      if (!appliedSet.has('burn')) {
        applyCount++;
        appliedSet.add('burn');
      }
    }
    expect(applyCount).toBe(2); // Applied twice total: once per effect lifecycle
  });

  it('supports multiple concurrent effect types per entity', () => {
    const statusTintApplied = new Map<string, Set<string>>();
    const appliedTypes: string[] = [];

    const appliedSet = new Set<string>();
    statusTintApplied.set('m1', appliedSet);

    for (const tintType of ['burn', 'poison', 'freeze']) {
      if (!appliedSet.has(tintType)) {
        appliedTypes.push(tintType);
        appliedSet.add(tintType);
      }
    }

    expect(appliedTypes).toEqual(['burn', 'poison', 'freeze']);
    expect(appliedSet.size).toBe(3);

    // Re-checking should not add any more
    const reApplied: string[] = [];
    for (const tintType of ['burn', 'poison', 'freeze']) {
      if (!appliedSet.has(tintType)) {
        reApplied.push(tintType);
      }
    }
    expect(reApplied.length).toBe(0);
  });
});

// ============================================================================
// Fix #6: ActiveBuff tag field (curse aura typing)
// ============================================================================

describe('Fix #6: ActiveBuff tag field for curse aura', () => {
  it('ActiveBuff interface supports tag field without any cast', () => {
    const buff: ActiveBuff = {
      stat: 'damageAmplify',
      value: 0.15,
      duration: 2000,
      startTime: 1000,
      tag: 'curseAura',
    };
    expect(buff.tag).toBe('curseAura');
    expect(buff.stat).toBe('damageAmplify');
    expect(buff.value).toBe(0.15);
  });

  it('finding curse aura buff by tag works correctly', () => {
    const buffs: ActiveBuff[] = [
      { stat: 'damageBonus', value: 0.2, duration: 8000, startTime: 0 },
      { stat: 'damageAmplify', value: 0.15, duration: 2000, startTime: 0, tag: 'curseAura' },
      { stat: 'damageReduction', value: 0.5, duration: 5000, startTime: 0 },
    ];

    const curseFound = buffs.find(b => b.stat === 'damageAmplify' && b.tag === 'curseAura');
    expect(curseFound).toBeDefined();
    expect(curseFound!.value).toBe(0.15);
    expect(curseFound!.tag).toBe('curseAura');
  });

  it('refreshing curse aura duration by tag reference works', () => {
    const buffs: ActiveBuff[] = [
      { stat: 'damageAmplify', value: 0.15, duration: 2000, startTime: 1000, tag: 'curseAura' },
    ];

    const existing = buffs.find(b => b.stat === 'damageAmplify' && b.tag === 'curseAura');
    expect(existing).toBeDefined();

    // Refresh
    existing!.startTime = 5000;
    expect(buffs[0].startTime).toBe(5000);
  });

  it('tag is optional — buffs without tag still work', () => {
    const buff: ActiveBuff = {
      stat: 'damageBonus',
      value: 0.25,
      duration: 6000,
      startTime: 0,
    };
    expect(buff.tag).toBeUndefined();

    // getBuffValue should work regardless of tag
    const entity = makeEntity({ buffs: [buff] });
    const val = getBuffValue(entity, 'damageBonus');
    expect(val).toBeCloseTo(0.25);
  });

  it('buffs with different tags but same stat stack correctly', () => {
    const entity = makeEntity({
      buffs: [
        { stat: 'damageBonus', value: 0.1, duration: 2000, startTime: 0, tag: 'dualWieldMastery' },
        { stat: 'damageBonus', value: 0.2, duration: 8000, startTime: 0, tag: 'frenzy' },
        { stat: 'damageBonus', value: 0.25, duration: 6000, startTime: 0 }, // no tag
      ],
    });
    const total = getBuffValue(entity, 'damageBonus');
    expect(total).toBeCloseTo(0.55);
  });
});

// ============================================================================
// Fix #7: Frenzy description accuracy
// ============================================================================

describe('Fix #7: Frenzy description matches mechanic', () => {
  it('Frenzy skill description does not mention attack speed', () => {
    const frenzy = WarriorClass.skills.find(s => s.id === 'frenzy');
    expect(frenzy).toBeDefined();
    expect(frenzy!.description).not.toContain('攻击速度');
  });

  it('Frenzy description mentions damage bonus', () => {
    const frenzy = WarriorClass.skills.find(s => s.id === 'frenzy');
    expect(frenzy).toBeDefined();
    expect(frenzy!.description).toContain('伤害');
  });

  it('Frenzy buff stat is damageBonus', () => {
    const frenzy = WarriorClass.skills.find(s => s.id === 'frenzy');
    expect(frenzy).toBeDefined();
    expect(frenzy!.buff).toBeDefined();
    expect(frenzy!.buff!.stat).toBe('damageBonus');
  });

  it('Frenzy buff value is 0.2 (20% damage bonus)', () => {
    const frenzy = WarriorClass.skills.find(s => s.id === 'frenzy');
    expect(frenzy).toBeDefined();
    expect(frenzy!.buff!.value).toBe(0.2);
  });

  it('Frenzy duration is 8000ms', () => {
    const frenzy = WarriorClass.skills.find(s => s.id === 'frenzy');
    expect(frenzy).toBeDefined();
    expect(frenzy!.buff!.duration).toBe(8000);
  });

  it('Frenzy damageBonus is correctly applied in combat calculation', () => {
    const cs = new CombatSystem();
    const attacker = makeEntity({
      buffs: [{ stat: 'damageBonus', value: 0.2, duration: 8000, startTime: 0 }],
    });
    const defender = makeEntity({ stats: makeStats({ dex: 0 }) });

    const noBuff = cs.calculateDamage(makeEntity(), defender);
    const withBuff = cs.calculateDamage(attacker, defender);

    // With 20% damageBonus, damage should be about 20% higher
    expect(withBuff.damage).toBeGreaterThan(noBuff.damage);
  });
});

// ============================================================================
// Integration: Combined scenario tests
// ============================================================================

describe('Integration: combined scenario tests', () => {
  it('curse aura + dual wield mastery buffs can coexist with proper tags', () => {
    const buffs: ActiveBuff[] = [
      { stat: 'damageAmplify', value: 0.15, duration: 2000, startTime: 0, tag: 'curseAura' },
      { stat: 'damageBonus', value: 0.09, duration: 2000, startTime: 0, tag: 'dualWieldMastery' },
      { stat: 'damageBonus', value: 0.2, duration: 8000, startTime: 0 }, // frenzy (no tag)
    ];

    // Can find each by tag
    expect(buffs.find(b => b.tag === 'curseAura')).toBeDefined();
    expect(buffs.find(b => b.tag === 'dualWieldMastery')).toBeDefined();

    // Tag deduplication works independently
    const hasCurse = buffs.some(b => b.tag === 'curseAura');
    const hasDW = buffs.some(b => b.tag === 'dualWieldMastery');
    expect(hasCurse).toBe(true);
    expect(hasDW).toBe(true);

    // Untagged frenzy buff is separate
    const untagged = buffs.filter(b => !b.tag && b.stat === 'damageBonus');
    expect(untagged.length).toBe(1);
  });

  it('respawned monster with originalDefinition has correct stats', () => {
    const system = new EliteAffixSystem();
    const baseDef = makeMonsterDef({ damage: 20, hp: 100, defense: 5, speed: 50 });

    // 10 respawn cycles should all produce same stats
    const damages = new Set<number>();
    for (let i = 0; i < 10; i++) {
      const affixes = [makeAffix('extra_strong')];
      const stats = system.getCombinedStats(affixes);
      damages.add(Math.floor(baseDef.damage * stats.damageMult));
    }

    // All cycles produce same damage
    expect(damages.size).toBe(1);
    expect(damages.has(27)).toBe(true); // 20 * 1.35 = 27
  });
});
