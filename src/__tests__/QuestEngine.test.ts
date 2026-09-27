import { describe, expect, it, vi } from 'vitest';
import type { ItemInstance, QuestDefinition, QuestProgress } from '../data/types';
import { computeGuideTarget, type GuideWorld } from '../systems/QuestGuide';
import {
  CLASS_WEAPON_TYPES, generateRewardChoices, pickRewardBase, questDropChance, resolveGatherSpots, rewardItemLevel,
} from '../systems/QuestRewards';
import { QuestSystem } from '../systems/QuestSystem';
import { EventBus, GameEvents } from '../utils/EventBus';
import { getItemBase } from '../data/items/bases';
import type { WeaponBase } from '../data/types';

function quest(over: Partial<QuestDefinition> = {}): QuestDefinition {
  return {
    id: 'q_test', name: 't', description: 'd', zone: 'z', type: 'kill', category: 'main', level: 10,
    objectives: [{ type: 'kill', targetId: 'goblin', targetName: 'g', required: 3, current: 0 }],
    rewards: { exp: 1, gold: 1 },
    ...over,
  };
}

function world(over: Partial<GuideWorld> = {}): GuideWorld {
  return {
    player: { col: 0, row: 0 },
    npcTile: (id) => (id === 'giver' ? { col: 5, row: 5 } : null),
    monsters: () => [{ col: 20, row: 0 }, { col: 3, row: 4 }],
    spawns: () => [{ col: 50, row: 50 }],
    gatherSpots: () => [],
    giverOf: () => 'giver',
    ...over,
  };
}

const active = (current: number[]): QuestProgress => ({ questId: 'q_test', status: 'active', objectives: current.map(c => ({ current: c })) });

describe('QuestGuide', () => {
  it('leads to the nearest living target of the first unfinished objective', () => {
    expect(computeGuideTarget(quest(), active([0]), world())).toMatchObject({ col: 3, row: 4, reason: 'objective', objectiveIndex: 0 });
  });

  it('falls back to spawn points when no target is alive', () => {
    expect(computeGuideTarget(quest(), active([0]), world({ monsters: () => [] }))).toMatchObject({ col: 50, row: 50 });
  });

  it('skips finished objectives and uses explicit locations', () => {
    const q = quest({
      objectives: [
        { type: 'kill', targetId: 'goblin', targetName: 'g', required: 1, current: 0 },
        { type: 'explore', targetId: 'camp', targetName: 'c', required: 1, current: 0, location: { col: 9, row: 8, radius: 3 } },
      ],
    });
    expect(computeGuideTarget(q, active([1, 0]), world())).toMatchObject({ col: 9, row: 8, objectiveIndex: 1 });
  });

  it('fetches the escort first, then leads to the destination', () => {
    const q = quest({
      type: 'escort',
      objectives: [{ type: 'escort', targetId: 'merchant', targetName: 'm', required: 1, current: 0, location: { col: 40, row: 40, radius: 5 } }],
    });
    expect(computeGuideTarget(q, active([0]), world({ escortTile: () => ({ col: 10, row: 10 }) }))).toMatchObject({ col: 10, row: 10 });
    expect(computeGuideTarget(q, active([0]), world({ escortTile: () => ({ col: 1, row: 1 }) }))).toMatchObject({ col: 40, row: 40 });
  });

  it('points back at the giver once complete', () => {
    const done: QuestProgress = { questId: 'q_test', status: 'completed', objectives: [{ current: 3 }] };
    expect(computeGuideTarget(quest(), done, world())).toMatchObject({ col: 5, row: 5, reason: 'turn_in' });
  });

  it('routes drop objectives to the monsters that drop the item', () => {
    const seen: string[][] = [];
    const q = quest({
      objectives: [{ type: 'collect', targetId: 'mat_x', targetName: 'x', required: 2, current: 0, source: { kind: 'drop', monsters: ['wolf'], chance: 0.5 } }],
    });
    computeGuideTarget(q, active([0]), world({ monsters: (ids) => { seen.push([...ids]); return [{ col: 1, row: 1 }]; } }));
    expect(seen[0]).toEqual(['wolf']);
  });
});

describe('QuestRewards', () => {
  it('only offers weapons from the class weapon families', () => {
    for (const cls of Object.keys(CLASS_WEAPON_TYPES)) {
      for (let i = 0; i < 20; i++) {
        const base = pickRewardBase('weapon', cls, 30, Math.random) as WeaponBase;
        expect(CLASS_WEAPON_TYPES[cls]).toContain(base.weaponType);
        expect(base.levelReq).toBeLessThanOrEqual(32);
      }
    }
  });

  it('gives non-shield classes jewelry for an off-hand choice', () => {
    expect(getItemBase(pickRewardBase('offhand', 'mage', 20)!.id)?.type).toBe('accessory');
    expect((pickRewardBase('offhand', 'warrior', 20) as WeaponBase).weaponType).toBe('shield');
  });

  it('builds one identified item per choice at the quest quality', () => {
    const made: string[] = [];
    const create = (baseId: string, level: number, quality: ItemInstance['quality']): ItemInstance => {
      made.push(quality);
      return { uid: baseId, baseId, name: baseId, quality, level, affixes: [], sockets: [], identified: false, quantity: 1, stats: {} };
    };
    const items = generateRewardChoices(quest({ rewards: { exp: 1, gold: 1, choices: ['weapon', 'armor'] } }), 'rogue', 12, create);
    expect(items).toHaveLength(2);
    expect(items.every(i => i.identified)).toBe(true);
    expect(made).toEqual(['rare', 'rare']);
  });

  it('scales reward level toward an over-levelled player, capped at +5', () => {
    expect(rewardItemLevel(quest({ level: 10 }), 8)).toBe(10);
    expect(rewardItemLevel(quest({ level: 10 }), 13)).toBe(13);
    expect(rewardItemLevel(quest({ level: 10 }), 40)).toBe(15);
  });

  it('drops quest items only from listed monsters', () => {
    const obj = { type: 'collect' as const, targetId: 'm', targetName: 'm', required: 1, current: 0, source: { kind: 'drop' as const, monsters: ['wolf'], chance: 0.4 } };
    expect(questDropChance(obj, 'wolf')).toBe(0.4);
    expect(questDropChance(obj, 'slime')).toBe(0);
    expect(questDropChance({ ...obj, source: { kind: 'gather', area: { col: 0, row: 0, radius: 3 }, count: 2 } }, 'wolf')).toBe(0);
    expect(questDropChance({ ...obj, type: 'kill' }, 'wolf')).toBe(0);
  });

  it('resolves gather spots deterministically on walkable, spaced tiles', () => {
    const walkable = (c: number, r: number) => (c + r) % 5 !== 0;
    const a = resolveGatherSpots({ col: 20, row: 20, radius: 8 }, 6, walkable, 'q:0');
    const b = resolveGatherSpots({ col: 20, row: 20, radius: 8 }, 6, walkable, 'q:0');
    expect(a).toEqual(b);
    expect(a).toHaveLength(6);
    for (const p of a) {
      expect(walkable(p.col, p.row)).toBe(true);
      expect(Math.hypot(p.col - 20, p.row - 20)).toBeLessThanOrEqual(8.8);
    }
    for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) {
      expect(Math.abs(a[i].col - a[j].col) + Math.abs(a[i].row - a[j].row)).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('QuestSystem events', () => {
  it('announces accept, progress (flagging the completing step) and turn-in', () => {
    const qs = new QuestSystem();
    qs.registerQuest(quest());
    const events: [string, unknown][] = [];
    const on = (name: string) => (p: unknown) => events.push([name, p]);
    const handlers = [GameEvents.QUEST_ACCEPTED, GameEvents.QUEST_PROGRESS, GameEvents.QUEST_COMPLETED, GameEvents.QUEST_TURNED_IN]
      .map(ev => [ev, on(ev)] as const);
    for (const [ev, fn] of handlers) EventBus.on(ev, fn);
    try {
      qs.acceptQuest('q_test');
      qs.updateProgress('kill', 'goblin');
      qs.updateProgress('kill', 'goblin', 2);
      qs.updateProgress('kill', 'goblin');
      qs.turnInQuest('q_test');
    } finally {
      for (const [ev, fn] of handlers) EventBus.off(ev, fn);
    }
    expect(events.map(e => e[0])).toEqual([
      GameEvents.QUEST_ACCEPTED, GameEvents.QUEST_PROGRESS, GameEvents.QUEST_PROGRESS, GameEvents.QUEST_COMPLETED, GameEvents.QUEST_TURNED_IN,
    ]);
    expect(events[1][1]).toMatchObject({ current: 1, required: 3, completesQuest: false });
    expect(events[2][1]).toMatchObject({ current: 3, completesQuest: true });
  });

  it('guides the pinned quest, else the zone main quest', () => {
    const qs = new QuestSystem();
    qs.registerQuests([quest({ id: 'a', category: 'side' }), quest({ id: 'b' }), quest({ id: 'c', zone: 'other' })]);
    for (const id of ['a', 'b', 'c']) qs.acceptQuest(id);
    expect(qs.getGuidedQuest('z')?.quest.id).toBe('b');
    const spy = vi.fn();
    EventBus.on(GameEvents.QUEST_TRACKED_CHANGED, spy);
    qs.setTracked('a');
    EventBus.off(GameEvents.QUEST_TRACKED_CHANGED, spy);
    expect(spy).toHaveBeenCalledOnce();
    expect(qs.getGuidedQuest('z')?.quest.id).toBe('a');
    expect(qs.getGuidedQuest('other')?.quest.id).toBe('c');
  });
});
