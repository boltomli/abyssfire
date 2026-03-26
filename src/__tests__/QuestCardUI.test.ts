import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  gatherNpcQuests,
  buildQuestCardData,
  formatObjectiveLabel,
  formatRewardSummary,
  buildToastMessage,
} from '../ui/QuestCardUI';
import type { QuestDefinition, QuestProgress, QuestObjective, QuestReward } from '../data/types';
import { AllQuests } from '../data/quests/all_quests';
import { QUEST_TYPE_LABELS } from '../systems/QuestSystem';
import { NPCDefinitions } from '../data/npcs';

// Mock Phaser EventBus (required by QuestSystem import)
vi.mock('../utils/EventBus', () => ({
  EventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
  GameEvents: {
    QUEST_COMPLETED: 'quest:completed',
    QUEST_FAILED: 'quest:failed',
    LOG_MESSAGE: 'log:message',
  },
}));

// Mock dialogueTrees for NPC data import
vi.mock('../data/dialogueTrees', () => ({
  DialogueTrees: {},
}));

// ─── Test Fixtures ──────────────────────────────────────────────

function makeQuest(overrides: Partial<QuestDefinition> = {}): QuestDefinition {
  return {
    id: 'test_quest_1',
    name: '测试任务',
    description: '这是一个测试任务。',
    zone: 'emerald_plains',
    type: 'kill',
    category: 'main',
    objectives: [
      { type: 'kill', targetId: 'goblin', targetName: '哥布林', required: 10, current: 0 },
    ],
    rewards: { exp: 100, gold: 50 },
    level: 1,
    ...overrides,
  };
}

function makeProgress(questId: string, status: QuestProgress['status'], objectives: { current: number }[]): QuestProgress {
  return { questId, status, objectives };
}

// ═══════════════════════════════════════
// Quest Card Data Formatting Tests
// ═══════════════════════════════════════

describe('QuestCardUI — formatObjectiveLabel', () => {
  it('formats kill objective correctly', () => {
    const obj: QuestObjective = { type: 'kill', targetId: 'goblin', targetName: '哥布林', required: 10, current: 0 };
    expect(formatObjectiveLabel(obj)).toBe('猎杀 哥布林');
  });

  it('formats collect objective correctly', () => {
    const obj: QuestObjective = { type: 'collect', targetId: 'herb', targetName: '草药', required: 5, current: 0 };
    expect(formatObjectiveLabel(obj)).toBe('收集 草药');
  });

  it('formats explore objective correctly', () => {
    const obj: QuestObjective = { type: 'explore', targetId: 'zone_camp', targetName: '营地', required: 1, current: 0 };
    expect(formatObjectiveLabel(obj)).toBe('探索 营地');
  });

  it('formats talk objective correctly', () => {
    const obj: QuestObjective = { type: 'talk', targetId: 'hermit', targetName: '隐士', required: 1, current: 0 };
    expect(formatObjectiveLabel(obj)).toBe('对话 隐士');
  });

  it('formats escort objective correctly', () => {
    const obj: QuestObjective = { type: 'escort', targetId: 'merchant_npc', targetName: '商人', required: 1, current: 0 };
    expect(formatObjectiveLabel(obj)).toBe('护送 商人');
  });

  it('formats defend_wave objective correctly', () => {
    const obj: QuestObjective = { type: 'defend_wave', targetId: 'camp', targetName: '营地', required: 3, current: 0 };
    expect(formatObjectiveLabel(obj)).toBe('防守 营地');
  });

  it('formats investigate_clue objective correctly', () => {
    const obj: QuestObjective = { type: 'investigate_clue', targetId: 'clue_1', targetName: '线索', required: 3, current: 0 };
    expect(formatObjectiveLabel(obj)).toBe('调查 线索');
  });

  it('formats craft_collect objective correctly', () => {
    const obj: QuestObjective = { type: 'craft_collect', targetId: 'ore', targetName: '矿石', required: 5, current: 0 };
    expect(formatObjectiveLabel(obj)).toBe('采集 矿石');
  });

  it('formats craft_craft objective correctly', () => {
    const obj: QuestObjective = { type: 'craft_craft', targetId: 'sword', targetName: '剑', required: 1, current: 0 };
    expect(formatObjectiveLabel(obj)).toBe('制作 剑');
  });

  it('formats craft_deliver objective correctly', () => {
    const obj: QuestObjective = { type: 'craft_deliver', targetId: 'npc', targetName: 'NPC', required: 1, current: 0 };
    expect(formatObjectiveLabel(obj)).toBe('交付 NPC');
  });
});

describe('QuestCardUI — formatRewardSummary', () => {
  it('formats exp and gold', () => {
    const rewards: QuestReward = { exp: 200, gold: 50 };
    expect(formatRewardSummary(rewards)).toBe('200 经验  50 金币');
  });

  it('formats exp only', () => {
    const rewards: QuestReward = { exp: 100, gold: 0 };
    expect(formatRewardSummary(rewards)).toBe('100 经验');
  });

  it('includes item count', () => {
    const rewards: QuestReward = { exp: 100, gold: 30, items: ['item_a', 'item_b'] };
    expect(formatRewardSummary(rewards)).toBe('100 经验  30 金币  2 物品');
  });

  it('includes pet reward', () => {
    const rewards: QuestReward = { exp: 50, gold: 10, petReward: 'pet_wolf' };
    expect(formatRewardSummary(rewards)).toBe('50 经验  10 金币  宠物');
  });

  it('handles all components', () => {
    const rewards: QuestReward = { exp: 300, gold: 100, items: ['i1'], petReward: 'pet_cat' };
    expect(formatRewardSummary(rewards)).toBe('300 经验  100 金币  1 物品  宠物');
  });
});

describe('QuestCardUI — buildToastMessage', () => {
  it('builds accept toast', () => {
    expect(buildToastMessage('accept', '史莱姆之灾')).toBe('已接受: 史莱姆之灾');
  });

  it('builds turn-in toast', () => {
    expect(buildToastMessage('turn_in', '哥布林猎杀')).toBe('已交付: 哥布林猎杀');
  });
});

// ═══════════════════════════════════════
// Quest Prioritisation & Gathering
// ═══════════════════════════════════════

describe('QuestCardUI — gatherNpcQuests', () => {
  let questMap: Map<string, QuestDefinition>;
  let progressMap: Map<string, QuestProgress>;

  beforeEach(() => {
    questMap = new Map();
    progressMap = new Map();
  });

  it('returns empty array when NPC has no quest IDs', () => {
    const result = gatherNpcQuests([], questMap, progressMap, 10);
    expect(result).toEqual([]);
  });

  it('returns available quests when no progress exists', () => {
    const q = makeQuest({ id: 'q1' });
    questMap.set('q1', q);
    const result = gatherNpcQuests(['q1'], questMap, progressMap, 10);
    expect(result).toHaveLength(1);
    expect(result[0].cardAction).toBe('accept');
    expect(result[0].quest.id).toBe('q1');
  });

  it('returns completed quests as turn_in', () => {
    const q = makeQuest({ id: 'q1' });
    questMap.set('q1', q);
    progressMap.set('q1', makeProgress('q1', 'completed', [{ current: 10 }]));
    const result = gatherNpcQuests(['q1'], questMap, progressMap, 10);
    expect(result).toHaveLength(1);
    expect(result[0].cardAction).toBe('turn_in');
  });

  it('turn-in quests appear before available quests', () => {
    const q1 = makeQuest({ id: 'q1', name: '可交付' });
    const q2 = makeQuest({ id: 'q2', name: '可接受' });
    questMap.set('q1', q1);
    questMap.set('q2', q2);
    progressMap.set('q1', makeProgress('q1', 'completed', [{ current: 10 }]));

    const result = gatherNpcQuests(['q1', 'q2'], questMap, progressMap, 10);
    expect(result).toHaveLength(2);
    expect(result[0].cardAction).toBe('turn_in');
    expect(result[0].quest.name).toBe('可交付');
    expect(result[1].cardAction).toBe('accept');
    expect(result[1].quest.name).toBe('可接受');
  });

  it('excludes active (in-progress) quests', () => {
    const q = makeQuest({ id: 'q1' });
    questMap.set('q1', q);
    progressMap.set('q1', makeProgress('q1', 'active', [{ current: 3 }]));
    const result = gatherNpcQuests(['q1'], questMap, progressMap, 10);
    expect(result).toHaveLength(0);
  });

  it('excludes already turned-in quests', () => {
    const q = makeQuest({ id: 'q1' });
    questMap.set('q1', q);
    progressMap.set('q1', makeProgress('q1', 'turned_in', [{ current: 10 }]));
    const result = gatherNpcQuests(['q1'], questMap, progressMap, 10);
    expect(result).toHaveLength(0);
  });

  it('excludes quests above player level + 5', () => {
    const q = makeQuest({ id: 'q1', level: 20 });
    questMap.set('q1', q);
    const result = gatherNpcQuests(['q1'], questMap, progressMap, 10);
    expect(result).toHaveLength(0);
  });

  it('includes quests at exactly player level + 5', () => {
    const q = makeQuest({ id: 'q1', level: 15 });
    questMap.set('q1', q);
    const result = gatherNpcQuests(['q1'], questMap, progressMap, 10);
    expect(result).toHaveLength(1);
  });

  it('excludes quests with unmet prereqs', () => {
    const q = makeQuest({ id: 'q2', prereqQuests: ['q1'] });
    questMap.set('q2', q);
    const result = gatherNpcQuests(['q2'], questMap, progressMap, 10);
    expect(result).toHaveLength(0);
  });

  it('includes quests with met prereqs', () => {
    const q1 = makeQuest({ id: 'q1' });
    const q2 = makeQuest({ id: 'q2', prereqQuests: ['q1'] });
    questMap.set('q1', q1);
    questMap.set('q2', q2);
    progressMap.set('q1', makeProgress('q1', 'turned_in', [{ current: 10 }]));
    const result = gatherNpcQuests(['q2'], questMap, progressMap, 10);
    expect(result).toHaveLength(1);
    expect(result[0].cardAction).toBe('accept');
  });

  it('includes failed reacceptable quests as available', () => {
    const q = makeQuest({ id: 'q1', reacceptable: true });
    questMap.set('q1', q);
    progressMap.set('q1', makeProgress('q1', 'failed', [{ current: 5 }]));
    const result = gatherNpcQuests(['q1'], questMap, progressMap, 10);
    expect(result).toHaveLength(1);
    expect(result[0].cardAction).toBe('accept');
  });

  it('excludes failed non-reacceptable quests', () => {
    const q = makeQuest({ id: 'q1' });
    questMap.set('q1', q);
    progressMap.set('q1', makeProgress('q1', 'failed', [{ current: 5 }]));
    const result = gatherNpcQuests(['q1'], questMap, progressMap, 10);
    expect(result).toHaveLength(0);
  });

  it('handles mixed scenario: 1 turn-in, 1 available, 1 active, 1 turned_in', () => {
    const q1 = makeQuest({ id: 'q1', name: '交付中' });
    const q2 = makeQuest({ id: 'q2', name: '可接受' });
    const q3 = makeQuest({ id: 'q3', name: '进行中' });
    const q4 = makeQuest({ id: 'q4', name: '已交付' });
    questMap.set('q1', q1);
    questMap.set('q2', q2);
    questMap.set('q3', q3);
    questMap.set('q4', q4);
    progressMap.set('q1', makeProgress('q1', 'completed', [{ current: 10 }]));
    // q2 has no progress — available
    progressMap.set('q3', makeProgress('q3', 'active', [{ current: 3 }]));
    progressMap.set('q4', makeProgress('q4', 'turned_in', [{ current: 10 }]));

    const result = gatherNpcQuests(['q1', 'q2', 'q3', 'q4'], questMap, progressMap, 10);
    expect(result).toHaveLength(2);
    expect(result[0].quest.name).toBe('交付中');
    expect(result[0].cardAction).toBe('turn_in');
    expect(result[1].quest.name).toBe('可接受');
    expect(result[1].cardAction).toBe('accept');
  });
});

// ═══════════════════════════════════════
// Card Data Assembly
// ═══════════════════════════════════════

describe('QuestCardUI — buildQuestCardData', () => {
  it('builds card data for an available quest', () => {
    const quest = makeQuest({ id: 'q1', type: 'kill', category: 'main' });
    const entry = { quest, progress: undefined, cardAction: 'accept' as const };
    const card = buildQuestCardData(entry, true);

    expect(card.questId).toBe('q1');
    expect(card.name).toBe('测试任务');
    expect(card.description).toBe('这是一个测试任务。');
    expect(card.typeBadge).toBe('猎杀');
    expect(card.category).toBe('main');
    expect(card.cardAction).toBe('accept');
    expect(card.hasLore).toBe(true);
    expect(card.objectives).toHaveLength(1);
    expect(card.objectives[0].label).toBe('猎杀 哥布林');
    expect(card.objectives[0].progress).toBe('0/10');
    expect(card.objectives[0].done).toBe(false);
    expect(card.rewards.exp).toBe(100);
    expect(card.rewards.gold).toBe(50);
    expect(card.rewards.items).toEqual([]);
  });

  it('builds card data for a completed (turn-in) quest with progress', () => {
    const quest = makeQuest({ id: 'q1', objectives: [
      { type: 'kill', targetId: 'goblin', targetName: '哥布林', required: 10, current: 0 },
      { type: 'collect', targetId: 'loot', targetName: '战利品', required: 5, current: 0 },
    ] });
    const progress = makeProgress('q1', 'completed', [{ current: 10 }, { current: 5 }]);
    const entry = { quest, progress, cardAction: 'turn_in' as const };
    const card = buildQuestCardData(entry, false);

    expect(card.cardAction).toBe('turn_in');
    expect(card.hasLore).toBe(false);
    expect(card.objectives).toHaveLength(2);
    expect(card.objectives[0].progress).toBe('10/10');
    expect(card.objectives[0].done).toBe(true);
    expect(card.objectives[1].progress).toBe('5/5');
    expect(card.objectives[1].done).toBe(true);
  });

  it('handles quests with item rewards', () => {
    const quest = makeQuest({ rewards: { exp: 200, gold: 30, items: ['w_short_sword'] } });
    const entry = { quest, progress: undefined, cardAction: 'accept' as const };
    const card = buildQuestCardData(entry, false);
    expect(card.rewards.items).toEqual(['w_short_sword']);
  });

  it('shows correct type badges for all 8 quest types', () => {
    const types: QuestDefinition['type'][] = ['kill', 'collect', 'explore', 'talk', 'escort', 'defend', 'investigate', 'craft'];
    for (const type of types) {
      const quest = makeQuest({ type });
      const entry = { quest, progress: undefined, cardAction: 'accept' as const };
      const card = buildQuestCardData(entry, false);
      expect(card.typeBadge).toBe(QUEST_TYPE_LABELS[type]);
    }
  });
});

// ═══════════════════════════════════════
// Integration with real quest data
// ═══════════════════════════════════════

describe('QuestCardUI — real quest data integration', () => {
  let questMap: Map<string, QuestDefinition>;

  beforeEach(() => {
    questMap = new Map();
    for (const q of AllQuests) {
      questMap.set(q.id, q);
    }
  });

  it('village elder NPC yields available quests for a new player', () => {
    const elderDef = NPCDefinitions['quest_elder'];
    const progressMap = new Map<string, QuestProgress>();
    const result = gatherNpcQuests(elderDef.quests!, questMap, progressMap, 10);
    // First quest should be available (q_kill_slimes — no prereqs, level 1)
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].cardAction).toBe('accept');
  });

  it('excludes quests with unmet prereqs from village elder for new player', () => {
    const elderDef = NPCDefinitions['quest_elder'];
    const progressMap = new Map<string, QuestProgress>();
    const result = gatherNpcQuests(elderDef.quests!, questMap, progressMap, 10);
    // q_kill_goblins requires q_kill_slimes turned in — should NOT appear
    const goblinQuest = result.find(e => e.quest.id === 'q_kill_goblins');
    expect(goblinQuest).toBeUndefined();
  });

  it('all quest types have valid QUEST_TYPE_LABELS', () => {
    const allTypes = new Set(AllQuests.map(q => q.type));
    for (const type of allTypes) {
      expect(QUEST_TYPE_LABELS[type], `Missing label for type: ${type}`).toBeDefined();
      expect(QUEST_TYPE_LABELS[type].length).toBeGreaterThan(0);
    }
  });

  it('every NPC quest definition has quests registered in AllQuests', () => {
    const questNpcs = Object.values(NPCDefinitions).filter(npc => npc.type === 'quest' && npc.quests && npc.quests.length > 0);
    for (const npc of questNpcs) {
      for (const qid of npc.quests!) {
        expect(questMap.has(qid), `Quest ${qid} referenced by NPC ${npc.id} not found in AllQuests`).toBe(true);
      }
    }
  });

  it('buildQuestCardData works for each real quest', () => {
    for (const quest of AllQuests.slice(0, 10)) {
      const entry = { quest, progress: undefined, cardAction: 'accept' as const };
      const card = buildQuestCardData(entry, false);
      expect(card.name.length).toBeGreaterThan(0);
      expect(card.objectives.length).toBeGreaterThan(0);
      expect(card.rewards.exp).toBeGreaterThan(0);
    }
  });
});
