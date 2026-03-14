import type { SetDefinition, LegendaryDefinition } from '../types';

export const SetDefinitions: SetDefinition[] = [
  {
    id: 'set_shadow_assassin',
    name: '暗影刺客套装',
    nameEn: 'Shadow Assassin',
    pieces: ['set_shadow_helm', 'set_shadow_armor', 'set_shadow_gloves', 'set_shadow_boots'],
    bonuses: [
      { count: 2, description: '+20% 暴击率', stats: { critRate: 20 } },
      { count: 3, description: '背刺伤害翻倍', stats: { backstabDamage: 100 } },
      { count: 4, description: '击杀后隐身2秒', stats: { killStealth: 2000 } },
    ],
  },
  {
    id: 'set_iron_guardian',
    name: '铁壁守护者套装',
    nameEn: 'Iron Guardian',
    pieces: ['set_iron_helm', 'set_iron_armor', 'set_iron_shield', 'set_iron_belt'],
    bonuses: [
      { count: 2, description: '+30% 最大生命', stats: { maxHpPercent: 30 } },
      { count: 3, description: '受击回复2%生命', stats: { thornsHeal: 2 } },
      { count: 4, description: '生命低于30%时免疫一次致死伤害', stats: { deathSave: 1 } },
    ],
  },
  {
    id: 'set_archmage',
    name: '大法师套装',
    nameEn: 'Archmage',
    pieces: ['set_archmage_hat', 'set_archmage_robe', 'set_archmage_staff', 'set_archmage_ring'],
    bonuses: [
      { count: 2, description: '+25% 法力上限', stats: { maxManaPercent: 25 } },
      { count: 3, description: '技能冷却减少20%', stats: { cooldownReduction: 20 } },
      { count: 4, description: '火球术发射3个投射物', stats: { fireballProjectiles: 2 } },
    ],
  },
  {
    id: 'set_hunter',
    name: '猎手套装',
    nameEn: 'Hunter',
    pieces: ['set_hunter_helm', 'set_hunter_armor', 'set_hunter_boots', 'set_hunter_bow'],
    bonuses: [
      { count: 2, description: '+15% 攻击速度', stats: { attackSpeedPercent: 15 } },
      { count: 3, description: '+30% 掉宝率', stats: { magicFind: 30 } },
      { count: 4, description: '多重射击数量翻倍', stats: { multishotExtra: 5 } },
    ],
  },
];

export const LegendaryItems: LegendaryDefinition[] = [
  {
    id: 'leg_soulreaver',
    baseId: 'w_demon_blade',
    name: '灵魂收割者',
    nameEn: 'Soulreaver',
    fixedAffixes: [
      { affixId: 'leg_1', name: '灵魂收割', stat: 'damage', value: 45 },
      { affixId: 'leg_2', name: '生命窃取', stat: 'lifeSteal', value: 8 },
    ],
    specialEffect: 'killHealPercent',
    specialEffectDescription: '每次击杀回复5%最大生命',
  },
  {
    id: 'leg_frostburn',
    baseId: 'w_arcane_staff',
    name: '霜火之杖',
    nameEn: 'Frostburn',
    fixedAffixes: [
      { affixId: 'leg_3', name: '霜火', stat: 'fireDamage', value: 20 },
      { affixId: 'leg_4', name: '冰冻', stat: 'iceDamage', value: 20 },
    ],
    specialEffect: 'fireballExtra',
    specialEffectDescription: '火球术额外发射2个投射物',
  },
  {
    id: 'leg_shadowstep',
    baseId: 'a_leather_boots',
    name: '暗影之履',
    nameEn: 'Shadowstep',
    fixedAffixes: [
      { affixId: 'leg_5', name: '疾行', stat: 'moveSpeed', value: 25 },
      { affixId: 'leg_6', name: '闪避', stat: 'dex', value: 15 },
    ],
    specialEffect: 'dodgeCounter',
    specialEffectDescription: '闪避后下次攻击必定暴击',
  },
  {
    id: 'leg_aegis',
    baseId: 'w_iron_shield',
    name: '不灭之盾',
    nameEn: 'Aegis',
    fixedAffixes: [
      { affixId: 'leg_7', name: '不朽', stat: 'defense', value: 30 },
      { affixId: 'leg_8', name: '坚韧', stat: 'maxHp', value: 100 },
    ],
    specialEffect: 'deathDefiance',
    specialEffectDescription: '受到致命伤害时10%概率不死并回复30%生命',
  },
  {
    id: 'leg_windforce',
    baseId: 'w_war_bow',
    name: '风之力',
    nameEn: 'Windforce',
    fixedAffixes: [
      { affixId: 'leg_9', name: '疾风', stat: 'damage', value: 35 },
      { affixId: 'leg_10', name: '击退', stat: 'knockback', value: 2 },
    ],
    specialEffect: 'multiArrow',
    specialEffectDescription: '普攻有25%概率发射双倍箭矢',
  },
];
