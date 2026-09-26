import { describe, expect, it } from 'vitest';
import { AllQuests } from '../data/quests/all_quests';
import { NPCDefinitions } from '../data/npcs';
import { AllMaps } from '../data/maps';
import { resolveGatherSpots } from '../systems/QuestRewards';
import { MiniBossSpawns } from '../data/miniBosses';

/** NPC ids standing in each zone (camps + field NPCs). */
function npcsIn(zone: string): Set<string> {
  const map = AllMaps[zone];
  return new Set([...map.camps.flatMap(c => c.npcs), ...(map.fieldNpcs ?? []).map(n => n.npcId)]);
}

function monstersIn(zone: string): Set<string> {
  const ids = new Set(AllMaps[zone].spawns.map(s => s.monsterId));
  const boss = MiniBossSpawns[zone];
  if (boss) ids.add((boss as { monsterId?: string }).monsterId ?? '');
  return ids;
}

const giverOf = new Map<string, string[]>();
for (const def of Object.values(NPCDefinitions)) {
  for (const q of def.quests ?? []) giverOf.set(q, [...(giverOf.get(q) ?? []), def.id]);
}

describe('quest content is completable', () => {
  for (const quest of AllQuests) {
    describe(quest.id, () => {
      it('has exactly one giver, and the giver stands in the quest zone', () => {
        const givers = giverOf.get(quest.id) ?? [];
        expect(givers, 'givers').toHaveLength(1);
        expect(npcsIn(quest.zone).has(givers[0]), `${givers[0]} in ${quest.zone}`).toBe(true);
        expect(NPCDefinitions[givers[0]].type).toBe('quest');
      });

      it('targets things that exist in its zone', () => {
        for (const obj of quest.objectives) {
          if (obj.type === 'kill') expect(monstersIn(quest.zone).has(obj.targetId), obj.targetId).toBe(true);
          if (obj.type === 'talk') expect(npcsIn(quest.zone).has(obj.targetId), obj.targetId).toBe(true);
          if (obj.type === 'collect' || obj.type === 'craft_collect') {
            expect(obj.source, `${obj.targetId} needs a source`).toBeDefined();
            const src = obj.source!;
            if (src.kind === 'drop') {
              expect(src.chance).toBeGreaterThan(0);
              for (const m of src.monsters) expect(monstersIn(quest.zone).has(m), `${m} drops ${obj.targetId}`).toBe(true);
            } else {
              expect(src.count).toBeGreaterThanOrEqual(obj.required);
              const map = AllMaps[quest.zone];
              const spots = resolveGatherSpots(src.area, src.count, (c, r) => !!map.collisions[r]?.[c], `${quest.id}:${quest.objectives.indexOf(obj)}`);
              expect(spots.length, `${obj.targetId} gather spots`).toBe(src.count);
            }
          }
        }
      });

      it('names a reward-choice list only with known slots', () => {
        const known = ['weapon', 'armor', 'helmet', 'gloves', 'boots', 'belt', 'jewelry', 'offhand'];
        for (const c of quest.rewards.choices ?? []) expect(known).toContain(c);
      });
    });
  }

  it('gives every zone finale a gear choice', () => {
    const finales = ['q_secure_plains', 'q_seal_dark_source', 'q_kill_stone_guardian', 'q_seal_fire_rift', 'q_kill_abyss_lord'];
    for (const id of finales) {
      expect(AllQuests.find(q => q.id === id)?.rewards.choices?.length ?? 0, id).toBeGreaterThan(0);
    }
  });
});
