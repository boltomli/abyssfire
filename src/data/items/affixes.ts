import type { AffixDefinition } from '../types';

export const Prefixes: AffixDefinition[] = [
  // Tier 1 (lv 1-10)
  { id: 'pre_sharp', name: '锋利的', nameEn: 'Sharp', type: 'prefix', tier: 1, stat: 'damage', minValue: 1, maxValue: 3, levelReq: 1 },
  { id: 'pre_sturdy', name: '坚韧的', nameEn: 'Sturdy', type: 'prefix', tier: 1, stat: 'defense', minValue: 1, maxValue: 3, levelReq: 1 },
  { id: 'pre_quick', name: '迅捷的', nameEn: 'Quick', type: 'prefix', tier: 1, stat: 'attackSpeed', minValue: 3, maxValue: 5, levelReq: 1 },
  { id: 'pre_strong', name: '强壮的', nameEn: 'Strong', type: 'prefix', tier: 1, stat: 'str', minValue: 2, maxValue: 4, levelReq: 1 },
  { id: 'pre_nimble', name: '灵巧的', nameEn: 'Nimble', type: 'prefix', tier: 1, stat: 'dex', minValue: 2, maxValue: 4, levelReq: 1 },
  { id: 'pre_wise', name: '睿智的', nameEn: 'Wise', type: 'prefix', tier: 1, stat: 'int', minValue: 2, maxValue: 4, levelReq: 1 },
  // Tier 2 (lv 10-20)
  { id: 'pre_keen', name: '敏锐的', nameEn: 'Keen', type: 'prefix', tier: 2, stat: 'damage', minValue: 4, maxValue: 8, levelReq: 10 },
  { id: 'pre_fortified', name: '强化的', nameEn: 'Fortified', type: 'prefix', tier: 2, stat: 'defense', minValue: 4, maxValue: 8, levelReq: 10 },
  { id: 'pre_savage', name: '凶猛的', nameEn: 'Savage', type: 'prefix', tier: 2, stat: 'str', minValue: 5, maxValue: 10, levelReq: 10 },
  { id: 'pre_agile', name: '敏捷的', nameEn: 'Agile', type: 'prefix', tier: 2, stat: 'dex', minValue: 5, maxValue: 10, levelReq: 10 },
  { id: 'pre_arcane', name: '奥术的', nameEn: 'Arcane', type: 'prefix', tier: 2, stat: 'int', minValue: 5, maxValue: 10, levelReq: 10 },
  // Tier 3 (lv 20-30)
  { id: 'pre_deadly', name: '致命的', nameEn: 'Deadly', type: 'prefix', tier: 3, stat: 'damage', minValue: 10, maxValue: 18, levelReq: 20 },
  { id: 'pre_godly', name: '神圣的', nameEn: 'Godly', type: 'prefix', tier: 3, stat: 'defense', minValue: 10, maxValue: 18, levelReq: 20 },
  { id: 'pre_titan', name: '泰坦的', nameEn: 'Titan\'s', type: 'prefix', tier: 3, stat: 'str', minValue: 12, maxValue: 20, levelReq: 20 },
  // Tier 4 (lv 30-40)
  { id: 'pre_cruel', name: '残忍的', nameEn: 'Cruel', type: 'prefix', tier: 4, stat: 'damage', minValue: 20, maxValue: 35, levelReq: 30 },
  { id: 'pre_mythic', name: '传说的', nameEn: 'Mythic', type: 'prefix', tier: 4, stat: 'defense', minValue: 20, maxValue: 30, levelReq: 30 },
  // Tier 5 (lv 40-50)
  { id: 'pre_abyssal', name: '深渊的', nameEn: 'Abyssal', type: 'prefix', tier: 5, stat: 'damage', minValue: 35, maxValue: 55, levelReq: 40 },
];

export const Suffixes: AffixDefinition[] = [
  // Tier 1
  { id: 'suf_life', name: '生命', nameEn: 'of Life', type: 'suffix', tier: 1, stat: 'maxHp', minValue: 5, maxValue: 15, levelReq: 1 },
  { id: 'suf_mana', name: '法力', nameEn: 'of Mana', type: 'suffix', tier: 1, stat: 'maxMana', minValue: 3, maxValue: 10, levelReq: 1 },
  { id: 'suf_leech', name: '吸血', nameEn: 'of Leech', type: 'suffix', tier: 1, stat: 'lifeSteal', minValue: 1, maxValue: 3, levelReq: 1 },
  { id: 'suf_flame', name: '火焰', nameEn: 'of Flame', type: 'suffix', tier: 1, stat: 'fireDamage', minValue: 1, maxValue: 4, levelReq: 1 },
  { id: 'suf_frost', name: '冰霜', nameEn: 'of Frost', type: 'suffix', tier: 1, stat: 'iceDamage', minValue: 1, maxValue: 4, levelReq: 1 },
  { id: 'suf_luck', name: '幸运', nameEn: 'of Fortune', type: 'suffix', tier: 1, stat: 'lck', minValue: 2, maxValue: 4, levelReq: 1 },
  // Tier 2
  { id: 'suf_vitality', name: '活力', nameEn: 'of Vitality', type: 'suffix', tier: 2, stat: 'maxHp', minValue: 20, maxValue: 40, levelReq: 10 },
  { id: 'suf_energy', name: '魔能', nameEn: 'of Energy', type: 'suffix', tier: 2, stat: 'maxMana', minValue: 15, maxValue: 30, levelReq: 10 },
  { id: 'suf_crit', name: '暴击', nameEn: 'of Precision', type: 'suffix', tier: 2, stat: 'critRate', minValue: 3, maxValue: 6, levelReq: 10 },
  { id: 'suf_inferno', name: '地狱火', nameEn: 'of Inferno', type: 'suffix', tier: 2, stat: 'fireDamage', minValue: 5, maxValue: 12, levelReq: 10 },
  // Tier 3
  { id: 'suf_titan_life', name: '巨人生命', nameEn: 'of the Titan', type: 'suffix', tier: 3, stat: 'maxHp', minValue: 50, maxValue: 80, levelReq: 20 },
  { id: 'suf_bloodthirst', name: '嗜血', nameEn: 'of Bloodthirst', type: 'suffix', tier: 3, stat: 'lifeSteal', minValue: 4, maxValue: 8, levelReq: 20 },
  { id: 'suf_devastation', name: '毁灭', nameEn: 'of Devastation', type: 'suffix', tier: 3, stat: 'critDamage', minValue: 10, maxValue: 25, levelReq: 20 },
  // Tier 4-5
  { id: 'suf_immortal', name: '不朽', nameEn: 'of Immortality', type: 'suffix', tier: 4, stat: 'maxHp', minValue: 100, maxValue: 160, levelReq: 30 },
  { id: 'suf_oblivion', name: '湮灭', nameEn: 'of Oblivion', type: 'suffix', tier: 5, stat: 'critDamage', minValue: 30, maxValue: 50, levelReq: 40 },
];

export const AllAffixes: AffixDefinition[] = [...Prefixes, ...Suffixes];
