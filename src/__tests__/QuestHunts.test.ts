import { describe, expect, it } from 'vitest';
import { huntsToSpawn, isHuntDue, makeHuntDefinition } from '../systems/QuestHunts';
import { QuestSystem } from '../systems/QuestSystem';
import { AllQuests } from '../data/quests/all_quests';
import { getMonsterDef } from '../data/monsters/index';
import type { QuestDefinition, QuestProgress } from '../data/types';

const pendant = AllQuests.find(q => q.id === 'q_lost_pendant')!;
const bounty = AllQuests.find(q => q.id === 'q_bandit_trouble')!;
const progressOf = (q: QuestDefinition, done: number[], status: QuestProgress['status'] = 'active'): QuestProgress => ({
  questId: q.id, status, objectives: q.objectives.map((_, i) => ({ current: done.includes(i) ? q.objectives[i].required : 0 })),
});

describe('quest hunts', () => {
  it('a bounty target is out as soon as the quest is accepted', () => {
    expect(isHuntDue(bounty, progressOf(bounty, []), bounty.hunts![0])).toBe(true);
    expect(isHuntDue(bounty, progressOf(bounty, [0]), bounty.hunts![0])).toBe(false);
    expect(isHuntDue(bounty, progressOf(bounty, [], 'available'), bounty.hunts![0])).toBe(false);
  });

  it('a tracked quarry stays hidden until its trail is followed', () => {
    const hunt = pendant.hunts![0];
    expect(isHuntDue(pendant, progressOf(pendant, [0, 1]), hunt)).toBe(false);
    expect(isHuntDue(pendant, progressOf(pendant, [0, 1, 2]), hunt)).toBe(true);
  });

  it('only spawns hunts of this zone that are not already out', () => {
    const open = [{ quest: pendant, progress: progressOf(pendant, [0, 1, 2]) }, { quest: bounty, progress: progressOf(bounty, []) }];
    expect(huntsToSpawn(open, 'emerald_plains', new Set()).map(h => h.hunt.huntId).sort())
      .toEqual(['hunt_pendant_thief', 'hunt_redcap_gruk']);
    expect(huntsToSpawn(open, 'emerald_plains', new Set(['hunt_redcap_gruk'])).map(h => h.hunt.huntId)).toEqual(['hunt_pendant_thief']);
    expect(huntsToSpawn(open, 'twilight_forest', new Set())).toEqual([]);
  });

  it('builds a tougher, named elite from the base monster', () => {
    const base = getMonsterDef('goblin')!;
    const def = makeHuntDefinition(base, bounty.hunts![0], 'Gruk');
    expect(def.id).toBe('hunt_redcap_gruk');
    expect(def.name).toBe('Gruk');
    expect(def.hp).toBe(Math.round(base.hp * 5));
    expect(def.elite).toBe(true);
    expect(def.isMiniBoss).toBe(true);
    expect(def.spriteKey).toBe(base.spriteKey);
  });
});

describe('deliveries and redesigned saves', () => {
  it('a delivery only counts once the goods are in hand', () => {
    const qs = new QuestSystem();
    qs.registerQuests(AllQuests);
    qs.acceptQuest('q_collect_slime_gel');
    qs.updateProgress('talk', 'plains_herbalist');
    expect(qs.progress.get('q_collect_slime_gel')!.objectives[1].current).toBe(0);
    qs.updateProgress('collect', 'mat_slime_gel', 6);
    qs.updateProgress('talk', 'plains_herbalist');
    expect(qs.progress.get('q_collect_slime_gel')!.status).toBe('completed');
  });

  it('restarts a quest whose objectives changed since the save', () => {
    const qs = new QuestSystem();
    qs.registerQuests(AllQuests);
    qs.loadProgress([{ questId: 'q_lost_pendant', status: 'active', objectives: [{ current: 8 }, { current: 0 }] }]);
    const p = qs.progress.get('q_lost_pendant')!;
    expect(p.objectives).toHaveLength(pendant.objectives.length);
    expect(p.objectives.every(o => o.current === 0)).toBe(true);
  });
});
