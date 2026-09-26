import { describe, expect, it } from 'vitest';
import { AllQuests } from '../data/quests/all_quests';
import { NPCDefinitions } from '../data/npcs';
import { AllMaps } from '../data/maps';
import { resolveGatherSpots } from '../systems/QuestRewards';
import { MiniBossSpawns } from '../data/miniBosses';
import { getMonsterDef } from '../data/monsters/index';
import type { QuestDefinition } from '../data/types';

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

/** Monsters a quest can be finished against: the zone's own plus the quest's hunts. */
function questMonsters(quest: QuestDefinition): Set<string> {
  const ids = monstersIn(quest.zone);
  for (const h of quest.hunts ?? []) ids.add(h.huntId);
  return ids;
}

function walkableNear(zone: string, col: number, row: number, rings: number): boolean {
  const map = AllMaps[zone];
  for (let r = row - rings; r <= row + rings; r++) {
    for (let c = col - rings; c <= col + rings; c++) if (map.collisions[r]?.[c]) return true;
  }
  return false;
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
          if (obj.type === 'kill') expect(questMonsters(quest).has(obj.targetId), obj.targetId).toBe(true);
          if (obj.type === 'talk') expect(npcsIn(quest.zone).has(obj.targetId), obj.targetId).toBe(true);
          if (obj.type === 'collect' || obj.type === 'craft_collect') {
            expect(obj.source, `${obj.targetId} needs a source`).toBeDefined();
            const src = obj.source!;
            if (src.kind === 'drop') {
              expect(src.chance).toBeGreaterThan(0);
              for (const m of src.monsters) expect(questMonsters(quest).has(m), `${m} drops ${obj.targetId}`).toBe(true);
            } else {
              expect(src.count).toBeGreaterThanOrEqual(obj.required);
              const map = AllMaps[quest.zone];
              const spots = resolveGatherSpots(src.area, src.count, (c, r) => !!map.collisions[r]?.[c], `${quest.id}:${quest.objectives.indexOf(obj)}`);
              expect(spots.length, `${obj.targetId} gather spots`).toBe(src.count);
            }
          }
        }
      });

      it('puts its hunts and clues where the hero can reach them', () => {
        for (const h of quest.hunts ?? []) {
          expect(getMonsterDef(h.monsterId), h.monsterId).toBeDefined();
          if (h.minions) expect(getMonsterDef(h.minions.monsterId), h.minions.monsterId).toBeDefined();
          expect(walkableNear(quest.zone, h.col, h.row, 6), `${h.huntId} spot`).toBe(true);
          expect(quest.objectives.some(o => o.type === 'kill' && o.targetId === h.huntId), `${h.huntId} has a kill objective`).toBe(true);
        }
        for (const o of quest.objectives) {
          if (o.type === 'investigate_clue' && o.location) {
            expect(walkableNear(quest.zone, o.location.col, o.location.row, 2), `${o.targetId} spot`).toBe(true);
          }
        }
      });

      it('names a reward-choice list only with known slots', () => {
        const known = ['weapon', 'armor', 'helmet', 'gloves', 'boots', 'belt', 'jewelry', 'offhand'];
        for (const c of quest.rewards.choices ?? []) expect(known).toContain(c);
      });
    });
  }

  it('keeps each zone\'s side quests distinct in how they play', () => {
    const shape = (q: QuestDefinition) => [
      q.escortNpc ? 'escort' : q.defendTarget ? 'defend' : q.craftPhases ? 'craft' : '',
      ...q.objectives.map(o => (o.type === 'kill' && q.hunts?.some(h => h.huntId === o.targetId) ? 'hunt' : o.type)
        + (o.source?.kind ? `:${o.source.kind}` : '')),
    ].join('>');
    const byZone = new Map<string, Map<string, string>>();
    for (const q of AllQuests.filter(q => q.category === 'side')) {
      const seen = byZone.get(q.zone) ?? new Map<string, string>();
      byZone.set(q.zone, seen);
      const sh = shape(q);
      expect(seen.get(sh), `${q.id} plays like ${seen.get(sh)} (${sh})`).toBeUndefined();
      seen.set(sh, q.id);
      // No side quest is a bare "kill N of a common monster".
      const bareKill = q.objectives.every(o => o.type === 'kill' && !q.hunts?.some(h => h.huntId === o.targetId));
      expect(bareKill, `${q.id} is a plain kill-count quest`).toBe(false);
    }
  });

  it('gives every zone finale a gear choice', () => {
    const finales = ['q_secure_plains', 'q_seal_dark_source', 'q_kill_stone_guardian', 'q_seal_fire_rift', 'q_kill_abyss_lord'];
    for (const id of finales) {
      expect(AllQuests.find(q => q.id === id)?.rewards.choices?.length ?? 0, id).toBeGreaterThan(0);
    }
  });
});
