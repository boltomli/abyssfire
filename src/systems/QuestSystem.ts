import { EventBus, GameEvents } from '../utils/EventBus';
import type { ItemInstance, QuestDefinition, QuestProgress, QuestReward } from '../data/types';
import { t } from '../i18n';

/** Locale-aware quest type labels. Reads from i18n at access time. */
export function getQuestTypeLabels(): Record<string, string> {
  return {
    kill: t('sys.quest.type.kill'),
    collect: t('sys.quest.type.collect'),
    explore: t('sys.quest.type.explore'),
    talk: t('sys.quest.type.talk'),
    escort: t('sys.quest.type.escort'),
    defend: t('sys.quest.type.defend'),
    investigate: t('sys.quest.type.investigate'),
    craft: t('sys.quest.type.craft'),
  };
}

/**
 * Legacy export: static-looking object, but callers should
 * prefer getQuestTypeLabels() for locale-reactivity.
 * Kept for backward compatibility with existing code.
 */
export const QUEST_TYPE_LABELS: Record<string, string> = new Proxy({} as Record<string, string>, {
  get(_target, prop: string) {
    return getQuestTypeLabels()[prop];
  },
  ownKeys() {
    return Object.keys(getQuestTypeLabels());
  },
  getOwnPropertyDescriptor(_target, prop: string) {
    const labels = getQuestTypeLabels();
    if (prop in labels) {
      return { configurable: true, enumerable: true, writable: true, value: labels[prop] };
    }
    return undefined;
  },
  has(_target, prop: string) {
    return prop in getQuestTypeLabels();
  },
});

export class QuestSystem {
  quests: Map<string, QuestDefinition> = new Map();
  progress: Map<string, QuestProgress> = new Map();
  /** Quest the player pinned for the guide arrow (null → auto-pick). */
  trackedQuestId: string | null = null;
  /** Generated equipment reward choices, per completed quest (not persisted). */
  rewardChoiceCache: Map<string, ItemInstance[]> = new Map();

  registerQuest(quest: QuestDefinition): void {
    this.quests.set(quest.id, quest);
  }

  registerQuests(quests: QuestDefinition[]): void {
    for (const q of quests) this.registerQuest(q);
  }

  acceptQuest(questId: string): boolean {
    const quest = this.quests.get(questId);
    if (!quest) return false;

    const existing = this.progress.get(questId);
    // Allow re-accepting failed quests that are reacceptable
    if (existing) {
      if (existing.status === 'failed' && quest.reacceptable) {
        // Reset progress for re-acceptance
        this.progress.set(questId, {
          questId,
          status: 'active',
          objectives: quest.objectives.map(() => ({ current: 0 })),
        });
        EventBus.emit(GameEvents.LOG_MESSAGE, {
          text: t('sys.quest.reaccepted', { name: quest.name }),
          type: 'system',
        });
        EventBus.emit(GameEvents.QUEST_ACCEPTED, { questId: quest.id, questName: quest.name });
        return true;
      }
      return false;
    }

    // Check prereqs
    if (quest.prereqQuests) {
      for (const pre of quest.prereqQuests) {
        const p = this.progress.get(pre);
        if (!p || p.status !== 'turned_in') return false;
      }
    }

    this.progress.set(questId, {
      questId,
      status: 'active',
      objectives: quest.objectives.map(() => ({ current: 0 })),
    });

    EventBus.emit(GameEvents.LOG_MESSAGE, {
      text: t('sys.quest.accepted', { name: quest.name }),
      type: 'system',
    });
    EventBus.emit(GameEvents.QUEST_ACCEPTED, { questId: quest.id, questName: quest.name });
    return true;
  }

  /**
   * Update progress for standard quest objective types.
   * Also checks new objective types: escort, defend_wave, investigate_clue, craft_collect, craft_craft, craft_deliver.
   */
  updateProgress(
    type: 'kill' | 'collect' | 'explore' | 'talk' | 'escort' | 'defend_wave' | 'investigate_clue' | 'craft_collect' | 'craft_craft' | 'craft_deliver',
    targetId: string,
    amount = 1,
  ): void {
    const advanced: number[] = [];
    for (const [questId, prog] of this.progress.entries()) {
      if (prog.status !== 'active') continue;
      const quest = this.quests.get(questId);
      if (!quest) continue;

      for (let i = 0; i < quest.objectives.length; i++) {
        const obj = quest.objectives[i];
        if (obj.type === type && obj.targetId === targetId) {
          // A delivery (talk objective after other steps) only counts once
          // the hero has what they are delivering.
          if (type === 'talk' && !this.earlierObjectivesDone(quest, prog, i)) continue;
          const before = prog.objectives[i].current;
          prog.objectives[i].current = Math.min(before + amount, obj.required);
          if (prog.objectives[i].current > before) advanced.push(i);
        }
      }

      // For craft quests: enforce phase ordering (collect → craft → deliver)
      if (quest.type === 'craft') {
        this.enforceCraftPhaseOrder(quest, prog);
      }

      // Check completion
      const allDone = quest.objectives.every(
        (obj, i) => prog.objectives[i].current >= obj.required,
      );

      for (const i of advanced) {
        const current = prog.objectives[i].current;
        if (current <= 0) continue; // undone by craft phase ordering
        const obj = quest.objectives[i];
        EventBus.emit(GameEvents.QUEST_PROGRESS, {
          questId, objectiveIndex: i, current, required: obj.required, targetId: obj.targetId, amount,
          completesQuest: allDone,
        });
      }
      advanced.length = 0;
      if (allDone && prog.status === 'active') {
        prog.status = 'completed';
        EventBus.emit(GameEvents.QUEST_COMPLETED, { questId: quest.id, questName: quest.name });
        EventBus.emit(GameEvents.LOG_MESSAGE, {
          text: t('sys.quest.completed', { name: quest.name }),
          type: 'system',
        });
      }
    }
  }

  private earlierObjectivesDone(quest: QuestDefinition, prog: QuestProgress, index: number): boolean {
    for (let j = 0; j < index; j++) {
      if (prog.objectives[j].current < quest.objectives[j].required) return false;
    }
    return true;
  }

  /**
   * Fail a quest (e.g., escort NPC died, defend target destroyed).
   */
  failQuest(questId: string): void {
    const prog = this.progress.get(questId);
    if (!prog || prog.status !== 'active') return;
    const quest = this.quests.get(questId);
    if (!quest) return;

    prog.status = 'failed';
    EventBus.emit(GameEvents.QUEST_FAILED, { questId: quest.id, questName: quest.name });
    EventBus.emit(GameEvents.LOG_MESSAGE, {
      text: t('sys.quest.failed', { name: quest.name }),
      type: 'system',
    });
  }

  turnInQuest(questId: string): QuestReward | null {
    const prog = this.progress.get(questId);
    if (!prog || prog.status !== 'completed') return null;
    const quest = this.quests.get(questId);
    if (!quest) return null;

    prog.status = 'turned_in';
    if (this.trackedQuestId === questId) this.setTracked(null);
    EventBus.emit(GameEvents.LOG_MESSAGE, {
      text: t('sys.quest.turnedIn', { name: quest.name, exp: quest.rewards.exp, gold: quest.rewards.gold }),
      type: 'system',
    });
    EventBus.emit(GameEvents.QUEST_TURNED_IN, { questId: quest.id, questName: quest.name });
    return quest.rewards;
  }

  getAvailableQuests(npcQuests: string[], playerLevel: number): QuestDefinition[] {
    return npcQuests
      .map(id => this.quests.get(id))
      .filter((q): q is QuestDefinition => {
        if (!q) return false;
        if (q.level > playerLevel + 5) return false;
        const prog = this.progress.get(q.id);
        if (prog) {
          if (prog.status === 'turned_in') return false;
          // Show failed reacceptable quests as available
          if (prog.status === 'failed' && q.reacceptable) {
            // Fall through to prereq check
          } else {
            // active, completed, or failed-non-reacceptable — not available
            return false;
          }
        }
        if (q.prereqQuests) {
          return q.prereqQuests.every(pre => {
            const p = this.progress.get(pre);
            return p && p.status === 'turned_in';
          });
        }
        return true;
      });
  }

  getActiveQuests(): { quest: QuestDefinition; progress: QuestProgress }[] {
    const result: { quest: QuestDefinition; progress: QuestProgress }[] = [];
    for (const [id, prog] of this.progress.entries()) {
      if (prog.status === 'active' || prog.status === 'completed') {
        const quest = this.quests.get(id);
        if (quest) result.push({ quest, progress: prog });
      }
    }
    return result;
  }

  /** Pin a quest for the guide arrow (null clears the pin). */
  setTracked(questId: string | null): void {
    if (this.trackedQuestId === questId) return;
    this.trackedQuestId = questId;
    EventBus.emit(GameEvents.QUEST_TRACKED_CHANGED, { questId });
  }

  /**
   * The quest the guide follows in `zoneId`: the pinned one if it is still
   * open there, else the first open main quest in the zone, else any open
   * quest in the zone (completed quests count — they lead back to the NPC).
   */
  getGuidedQuest(zoneId: string): { quest: QuestDefinition; progress: QuestProgress } | null {
    const open = this.getActiveQuests().filter(e => e.quest.zone === zoneId);
    if (this.trackedQuestId) {
      const pinned = open.find(e => e.quest.id === this.trackedQuestId);
      if (pinned) return pinned;
    }
    return open.find(e => e.quest.category === 'main') ?? open[0] ?? null;
  }

  getProgressData(): QuestProgress[] {
    return Array.from(this.progress.values());
  }

  loadProgress(data: QuestProgress[]): void {
    this.progress.clear();
    for (const p of data) {
      const quest = this.quests.get(p.questId);
      // A quest redesigned since the save was made: restart its objectives
      // rather than index into a list that no longer matches.
      if (quest && (p.status === 'active' || p.status === 'completed') && p.objectives.length !== quest.objectives.length) {
        p.status = 'active';
        p.objectives = quest.objectives.map(() => ({ current: 0 }));
      }
      this.progress.set(p.questId, p);
    }
  }

  /**
   * For craft quests, enforce phase ordering:
   * craft_collect objectives must all be complete before craft_craft can progress,
   * and craft_craft must be complete before craft_deliver can progress.
   */
  private enforceCraftPhaseOrder(quest: QuestDefinition, prog: QuestProgress): void {
    const collectDone = quest.objectives
      .filter(o => o.type === 'craft_collect')
      .every((o, _idx) => {
        const idx = quest.objectives.indexOf(o);
        return prog.objectives[idx].current >= o.required;
      });
    const craftDone = quest.objectives
      .filter(o => o.type === 'craft_craft')
      .every((o) => {
        const idx = quest.objectives.indexOf(o);
        return prog.objectives[idx].current >= o.required;
      });

    // If collect phase not done, reset any craft or deliver progress
    if (!collectDone) {
      quest.objectives.forEach((o, i) => {
        if (o.type === 'craft_craft' || o.type === 'craft_deliver') {
          prog.objectives[i].current = 0;
        }
      });
    }
    // If craft phase not done, reset deliver progress
    if (!craftDone) {
      quest.objectives.forEach((o, i) => {
        if (o.type === 'craft_deliver') {
          prog.objectives[i].current = 0;
        }
      });
    }
  }

  /**
   * Get the current phase label for a craft quest.
   */
  getCraftPhaseLabel(quest: QuestDefinition, prog: QuestProgress): string {
    if (quest.type !== 'craft') return '';

    const collectDone = quest.objectives
      .filter(o => o.type === 'craft_collect')
      .every((o) => {
        const idx = quest.objectives.indexOf(o);
        return prog.objectives[idx].current >= o.required;
      });
    if (!collectDone) return t('sys.quest.phase.collect');

    const craftDone = quest.objectives
      .filter(o => o.type === 'craft_craft')
      .every((o) => {
        const idx = quest.objectives.indexOf(o);
        return prog.objectives[idx].current >= o.required;
      });
    if (!craftDone) return t('sys.quest.phase.craft');

    return t('sys.quest.phase.deliver');
  }
}
