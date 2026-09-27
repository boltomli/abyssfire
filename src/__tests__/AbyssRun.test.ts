import { describe, expect, it } from 'vitest';
import { DungeonSystem, GATEKEEPER_ID } from '../systems/DungeonSystem';
import { BOONS, CURSES, FLOOR_THEMES } from '../data/abyssRun';
import { getMonsterDef } from '../data/monsters/index';
import { emptyEquipStats } from '../systems/CombatSystem';

describe('abyss tiers', () => {
  it('tier runs are 5-8 floors and grow every three tiers', () => {
    expect(DungeonSystem.createRun('normal', 1, 1).totalFloors).toBe(5);
    expect(DungeonSystem.createRun('normal', 1, 4).totalFloors).toBe(6);
    expect(DungeonSystem.createRun('normal', 1, 99).totalFloors).toBe(8);
  });

  it('higher tiers hit harder and pay better', () => {
    const f1 = DungeonSystem.getFloorConfig(DungeonSystem.createRun('normal', 7, 1), 1);
    const f5 = DungeonSystem.getFloorConfig(DungeonSystem.createRun('normal', 7, 5), 1);
    expect(f5.hpMultiplier).toBeGreaterThan(f1.hpMultiplier);
    expect(f5.lootQualityBonus).toBeGreaterThan(f1.lootQualityBonus);
    expect(f5.levelTarget).toBeGreaterThan(f1.levelTarget);
  });

  it('records clears: unlocks the next tier, keeps the best and the fastest time', () => {
    let rec = { unlockedTier: 1, bestTier: 0 } as { unlockedTier: number; bestTier: number; bestTimeMs?: number };
    let r = DungeonSystem.recordClear(rec, 1, 90_000);
    expect(r.newBest).toBe(true);
    rec = r.record;
    expect(rec).toEqual({ unlockedTier: 2, bestTier: 1, bestTimeMs: 90_000 });
    r = DungeonSystem.recordClear(rec, 1, 60_000);
    expect(r.newBest).toBe(false);
    expect(r.record.bestTimeMs).toBe(60_000);
    r = DungeonSystem.recordClear(r.record, 1, 99_000);
    expect(r.record.bestTimeMs).toBe(60_000);
  });
});

describe('abyss floors', () => {
  it('the boss floor is the rift, sealed by the boss; curses never land on floor 1 or the boss floor', () => {
    for (let seed = 1; seed < 40; seed++) {
      const run = DungeonSystem.createRun('normal', seed, 2);
      for (let f = 1; f <= run.totalFloors; f++) {
        const c = DungeonSystem.getFloorConfig(run, f);
        if (c.isBossFloor) {
          expect(c.themeId).toBe('rift');
          expect(c.sealKeeper).toBe('boss');
          expect(c.curseId).toBeNull();
        } else {
          expect(c.sealKeeper).toBe(c.hasMidBoss ? 'mid_boss' : 'gatekeeper');
        }
        if (f === 1) expect(c.curseId).toBeNull();
      }
    }
  });

  it('every floor layout keeps its start and exit on walkable ground', () => {
    for (let seed = 1; seed < 12; seed++) {
      const run = DungeonSystem.createRun('normal', seed, 1);
      for (let f = 1; f <= run.totalFloors; f++) {
        const map = DungeonSystem.generateFloorMap(DungeonSystem.getFloorConfig(run, f));
        expect(map.collisions[map.playerStart.row][map.playerStart.col], `start ${seed}/${f}`).toBe(true);
        const e = map.exits[0];
        const near = [-1, 0, 1].some(dr => [-1, 0, 1].some(dc => map.collisions[e.row + dr]?.[e.col + dc]));
        expect(near, `exit ${seed}/${f}`).toBe(true);
      }
    }
  });

  it('raises monsters from earlier lands to the labyrinth level', () => {
    const run = DungeonSystem.createRun('normal', 3, 1);
    const cfg = DungeonSystem.getFloorConfig(run, 1);
    const skeleton = getMonsterDef('skeleton')!;
    const raised = DungeonSystem.scaleMonster(skeleton, cfg, 'normal');
    expect(raised.level).toBe(cfg.levelTarget);
    expect(raised.hp).toBeGreaterThan(skeleton.hp * 4);
  });

  it('builds a named, elite gatekeeper from each theme', () => {
    const run = DungeonSystem.createRun('normal', 3, 1);
    const cfg = DungeonSystem.getFloorConfig(run, 1);
    for (const theme of FLOOR_THEMES) {
      const base = getMonsterDef(theme.gatekeeper);
      expect(base, theme.gatekeeper).toBeDefined();
      const gk = DungeonSystem.makeGatekeeper({ ...cfg, themeId: theme.id }, base!, 'normal');
      expect(gk.id).toBe(GATEKEEPER_ID);
      expect(gk.elite).toBe(true);
      expect(gk.hp).toBeGreaterThan(base!.hp);
    }
    for (const theme of FLOOR_THEMES) for (const m of theme.monsters) expect(getMonsterDef(m), m).toBeDefined();
  });
});

describe('abyss boons and curses', () => {
  it('offers three distinct boons, never beyond max stacks, and varies floor to floor', () => {
    const offers = new Set<string>();
    for (let f = 1; f <= 6; f++) {
      const o = DungeonSystem.rollBoonOffer(1234 + f * 131, {});
      expect(new Set(o).size).toBe(3);
      offers.add(o.join());
    }
    expect(offers.size).toBeGreaterThan(3);
    const maxed = Object.fromEntries(BOONS.map(b => [b.id, b.maxStacks ?? 3]));
    expect(DungeonSystem.rollBoonOffer(9, maxed)).toEqual([]);
  });

  it('boon stats stack and only touch real equipment stats', () => {
    const stats = DungeonSystem.boonStats({ wrath: 2, vigor: 1 });
    expect(stats.damagePercent).toBe(30);
    expect(stats.maxHpPercent).toBe(15);
    const known = Object.keys(emptyEquipStats());
    for (const b of BOONS) for (const k of Object.keys(b.stats)) expect(known, `${b.id}.${k}`).toContain(k);
  });

  it('every curse pays for its danger', () => {
    for (const c of CURSES) {
      expect(c.lootBonus).toBeGreaterThan(0);
      expect(c.magicFind).toBeGreaterThan(0);
    }
  });
});
