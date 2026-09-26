import { describe, it, expect } from 'vitest';
import { QUEST_ITEM_KINDS, questItemIconKey } from '../graphics/icons/QuestItemIcons';

describe('QuestItemIcons', () => {
  it('lists 22 unique kinds', () => {
    expect(QUEST_ITEM_KINDS.length).toBe(22);
    expect(new Set(QUEST_ITEM_KINDS).size).toBe(22);
  });

  it('maps kinds to stable texture keys', () => {
    expect(questItemIconKey('herb')).toBe('quest_icon_herb');
    expect(questItemIconKey('void_crystal')).toBe('quest_icon_void_crystal');
    const keys = QUEST_ITEM_KINDS.map(questItemIconKey);
    expect(new Set(keys).size).toBe(QUEST_ITEM_KINDS.length);
    for (const k of keys) expect(k).toMatch(/^quest_icon_[a-z_]+$/);
  });
});
