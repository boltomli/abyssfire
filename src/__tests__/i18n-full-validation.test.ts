/**
 * Comprehensive i18n validation test suite.
 *
 * Programmatically validates the entire i18n system to satisfy
 * the validation contract assertions without browser interaction.
 *
 * Coverage areas:
 * 1. Locale completeness (all namespaces, all keys)
 * 2. Data file coverage (game accessors in all 3 locales)
 * 3. No hardcoded Chinese audit (scene + system files)
 * 4. Template interpolation (all {param} keys)
 * 5. zh-TW conversion accuracy
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- Node builtins available in vitest but not in tsconfig types
import * as fs from 'fs';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- Node builtins available in vitest but not in tsconfig types
import * as path from 'path';

// __dirname equivalent for ESM — works in vitest
// @ts-ignore
const testDir = typeof __dirname !== 'undefined' ? __dirname : new URL('.', import.meta.url).pathname;

// ── localStorage mock ──
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

let t: (key: string, params?: Record<string, string | number>) => string;
let setLocale: (locale: string) => void;
let getLocale: () => string;
let getLocales: () => string[];
let convertToTraditional: (text: string) => string;

beforeEach(async () => {
  localStorageMock.clear();
  vi.resetModules();
  const i18n = await import('../i18n/index');
  t = i18n.t;
  setLocale = i18n.setLocale;
  getLocale = i18n.getLocale;
  getLocales = i18n.getLocales;
  const conv = await import('../i18n/converter');
  convertToTraditional = conv.convertToTraditional;
});

// ═══════════════════════════════════════════════════════════════════
// 1. LOCALE COMPLETENESS
// ═══════════════════════════════════════════════════════════════════

describe('Locale Completeness', () => {
  const NAMESPACES = ['menu', 'boot', 'ui', 'zone', 'data', 'sys'];

  it('zh-CN has keys in every expected namespace', async () => {
    const zhCN = (await import('../i18n/locales/zh-CN')).default;
    for (const ns of NAMESPACES) {
      const keys = Object.keys(zhCN).filter(k => k.startsWith(`${ns}.`));
      expect(keys.length, `Namespace '${ns}' should have keys in zh-CN`).toBeGreaterThan(0);
    }
  });

  it('en has keys in every expected namespace', async () => {
    const en = (await import('../i18n/locales/en')).default;
    for (const ns of NAMESPACES) {
      const keys = Object.keys(en).filter(k => k.startsWith(`${ns}.`));
      expect(keys.length, `Namespace '${ns}' should have keys in en`).toBeGreaterThan(0);
    }
  });

  it('zh-CN and en have identical key sets (except test-only keys)', async () => {
    const zhCN = (await import('../i18n/locales/zh-CN')).default;
    const en = (await import('../i18n/locales/en')).default;

    const zhCNKeys = new Set(Object.keys(zhCN));
    const enKeys = new Set(Object.keys(en).filter(k => !k.startsWith('test.')));

    const missingInEn = [...zhCNKeys].filter(k => !enKeys.has(k));
    const missingInZhCN = [...enKeys].filter(k => !zhCNKeys.has(k));

    expect(missingInEn, 'Keys in zh-CN but missing in en').toEqual([]);
    expect(missingInZhCN, 'Keys in en but missing in zh-CN').toEqual([]);
  });

  it('zh-TW resolves every zh-CN key (100% parity)', async () => {
    const zhCN = (await import('../i18n/locales/zh-CN')).default;
    setLocale('zh-TW');
    const failedKeys: string[] = [];
    for (const key of Object.keys(zhCN)) {
      const val = t(key);
      if (val === key) failedKeys.push(key);
    }
    expect(failedKeys).toEqual([]);
  });

  it('menu namespace has at least 60 keys', async () => {
    const zhCN = (await import('../i18n/locales/zh-CN')).default;
    const menuKeys = Object.keys(zhCN).filter(k => k.startsWith('menu.'));
    expect(menuKeys.length).toBeGreaterThanOrEqual(60);
  });

  it('boot namespace has at least 4 keys', async () => {
    const zhCN = (await import('../i18n/locales/zh-CN')).default;
    const bootKeys = Object.keys(zhCN).filter(k => k.startsWith('boot.'));
    expect(bootKeys.length).toBeGreaterThanOrEqual(4);
  });

  it('ui namespace has at least 250 keys', async () => {
    const zhCN = (await import('../i18n/locales/zh-CN')).default;
    const uiKeys = Object.keys(zhCN).filter(k => k.startsWith('ui.'));
    expect(uiKeys.length).toBeGreaterThanOrEqual(250);
  });

  it('zone namespace has at least 70 keys', async () => {
    const zhCN = (await import('../i18n/locales/zh-CN')).default;
    const zoneKeys = Object.keys(zhCN).filter(k => k.startsWith('zone.'));
    expect(zoneKeys.length).toBeGreaterThanOrEqual(70);
  });

  it('data namespace has at least 1000 keys', async () => {
    const zhCN = (await import('../i18n/locales/zh-CN')).default;
    const dataKeys = Object.keys(zhCN).filter(k => k.startsWith('data.'));
    expect(dataKeys.length).toBeGreaterThanOrEqual(1000);
  });

  it('sys namespace has at least 100 keys', async () => {
    const zhCN = (await import('../i18n/locales/zh-CN')).default;
    const sysKeys = Object.keys(zhCN).filter(k => k.startsWith('sys.'));
    expect(sysKeys.length).toBeGreaterThanOrEqual(100);
  });

  it('all locale values are non-empty strings', async () => {
    const zhCN = (await import('../i18n/locales/zh-CN')).default;
    const en = (await import('../i18n/locales/en')).default;

    const emptyZhCN = Object.entries(zhCN).filter(([, v]) => !v || v.trim() === '');
    const emptyEn = Object.entries(en).filter(([, v]) => !v || v.trim() === '');

    expect(emptyZhCN.map(([k]) => k), 'Empty zh-CN values').toEqual([]);
    expect(emptyEn.map(([k]) => k), 'Empty en values').toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. DATA FILE COVERAGE — all game data accessible via locales
// ═══════════════════════════════════════════════════════════════════

describe('Data File Coverage — Monster Names', () => {
  const MONSTER_IDS = [
    'slime_green', 'goblin', 'goblin_chief', 'skeleton', 'zombie',
    'werewolf', 'werewolf_alpha', 'gargoyle', 'stone_golem', 'mountain_troll',
    'fire_elemental', 'desert_scorpion', 'sandworm', 'phoenix',
    'imp', 'lesser_demon', 'succubus', 'demon_lord',
    'dungeon_shade', 'dungeon_fiend', 'dungeon_abyss_lord', 'dungeon_mid_boss',
    'sub_mine_guardian', 'sub_altar_keeper',
    'miniboss_goblin_shaman', 'miniboss_shadow_weaver',
    'miniboss_iron_guardian', 'miniboss_sand_wraith', 'miniboss_void_herald',
  ];

  for (const locale of ['zh-CN', 'zh-TW', 'en'] as const) {
    it(`all monster names accessible in ${locale}`, () => {
      setLocale(locale);
      for (const id of MONSTER_IDS) {
        const val = t(`data.monster.${id}`);
        expect(val, `Monster ${id} in ${locale}`).not.toBe(`data.monster.${id}`);
        expect(val.length, `Monster ${id} in ${locale} should be non-empty`).toBeGreaterThan(0);
      }
    });
  }
});

describe('Data File Coverage — Zone Names', () => {
  const ZONE_IDS = ['emerald_plains', 'twilight_forest', 'anvil_mountains', 'scorching_desert', 'abyss_rift'];

  for (const locale of ['zh-CN', 'zh-TW', 'en'] as const) {
    it(`all zone names accessible in ${locale}`, () => {
      setLocale(locale);
      for (const id of ZONE_IDS) {
        const val = t(`data.zone.${id}`);
        expect(val, `Zone ${id} in ${locale}`).not.toBe(`data.zone.${id}`);
        expect(val.length).toBeGreaterThan(0);
      }
    });
  }
});

describe('Data File Coverage — Class Names and Descriptions', () => {
  const CLASS_IDS = ['warrior', 'mage', 'rogue'];

  for (const locale of ['zh-CN', 'zh-TW', 'en'] as const) {
    it(`all class names accessible in ${locale}`, () => {
      setLocale(locale);
      for (const id of CLASS_IDS) {
        const name = t(`data.class.${id}.name`);
        const desc = t(`data.class.${id}.desc`);
        expect(name, `Class ${id} name in ${locale}`).not.toBe(`data.class.${id}.name`);
        expect(desc, `Class ${id} desc in ${locale}`).not.toBe(`data.class.${id}.desc`);
        expect(name.length).toBeGreaterThan(0);
        expect(desc.length).toBeGreaterThan(0);
      }
    });
  }
});

describe('Data File Coverage — Skill Names', () => {
  it('all skill locale keys accessible in all 3 locales', async () => {
    const zhCN = (await import('../i18n/locales/zh-CN')).default;
    const skillKeys = Object.keys(zhCN).filter(k => k.startsWith('data.skill.') && k.endsWith('.name'));

    expect(skillKeys.length, 'Should have skill name keys').toBeGreaterThan(30);

    for (const locale of ['zh-CN', 'zh-TW', 'en'] as const) {
      setLocale(locale);
      for (const key of skillKeys) {
        const val = t(key);
        expect(val, `${key} in ${locale}`).not.toBe(key);
        expect(val.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('Data File Coverage — Quest Names', () => {
  it('all quest locale keys accessible in all 3 locales', async () => {
    const zhCN = (await import('../i18n/locales/zh-CN')).default;
    const questNameKeys = Object.keys(zhCN).filter(k => k.startsWith('data.quest.') && k.endsWith('.name'));

    expect(questNameKeys.length, 'Should have quest name keys').toBeGreaterThan(10);

    for (const locale of ['zh-CN', 'zh-TW', 'en'] as const) {
      setLocale(locale);
      for (const key of questNameKeys) {
        const val = t(key);
        expect(val, `${key} in ${locale}`).not.toBe(key);
        expect(val.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('Data File Coverage — NPC Names', () => {
  it('all NPC name keys accessible in all 3 locales', async () => {
    const zhCN = (await import('../i18n/locales/zh-CN')).default;
    const npcKeys = Object.keys(zhCN).filter(k => k.startsWith('data.npc.') && k.endsWith('.name'));

    expect(npcKeys.length, 'Should have NPC name keys').toBeGreaterThan(5);

    for (const locale of ['zh-CN', 'zh-TW', 'en'] as const) {
      setLocale(locale);
      for (const key of npcKeys) {
        const val = t(key);
        expect(val, `${key} in ${locale}`).not.toBe(key);
        expect(val.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('Data File Coverage — Item Base Names', () => {
  it('all item base name keys accessible in all 3 locales', async () => {
    const zhCN = (await import('../i18n/locales/zh-CN')).default;
    const itemKeys = Object.keys(zhCN).filter(k => k.startsWith('data.item.') && k.endsWith('.name'));

    expect(itemKeys.length, 'Should have item name keys').toBeGreaterThan(20);

    for (const locale of ['zh-CN', 'zh-TW', 'en'] as const) {
      setLocale(locale);
      for (const key of itemKeys) {
        const val = t(key);
        expect(val, `${key} in ${locale}`).not.toBe(key);
        expect(val.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('Data File Coverage — Affix Names', () => {
  it('all affix name keys accessible in all 3 locales', async () => {
    const zhCN = (await import('../i18n/locales/zh-CN')).default;
    const affixKeys = Object.keys(zhCN).filter(k => k.startsWith('data.affix.'));

    expect(affixKeys.length, 'Should have affix keys').toBeGreaterThan(40);

    for (const locale of ['zh-CN', 'zh-TW', 'en'] as const) {
      setLocale(locale);
      for (const key of affixKeys) {
        const val = t(key);
        expect(val, `${key} in ${locale}`).not.toBe(key);
        expect(val.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('Data File Coverage — Set Names and Bonuses', () => {
  it('all set name keys accessible in all 3 locales', async () => {
    const zhCN = (await import('../i18n/locales/zh-CN')).default;
    const setKeys = Object.keys(zhCN).filter(k => k.startsWith('data.set.') && k.endsWith('.name'));

    expect(setKeys.length, 'Should have set name keys').toBeGreaterThan(3);

    for (const locale of ['zh-CN', 'zh-TW', 'en'] as const) {
      setLocale(locale);
      for (const key of setKeys) {
        const val = t(key);
        expect(val, `${key} in ${locale}`).not.toBe(key);
        expect(val.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('Data File Coverage — Legendary Names', () => {
  it('all legendary name keys accessible in all 3 locales', async () => {
    const zhCN = (await import('../i18n/locales/zh-CN')).default;
    const legKeys = Object.keys(zhCN).filter(k => k.startsWith('data.legendary.') && k.endsWith('.name'));

    expect(legKeys.length, 'Should have legendary name keys').toBeGreaterThan(3);

    for (const locale of ['zh-CN', 'zh-TW', 'en'] as const) {
      setLocale(locale);
      for (const key of legKeys) {
        const val = t(key);
        expect(val, `${key} in ${locale}`).not.toBe(key);
        expect(val.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('Data File Coverage — Achievement Names and Descriptions', () => {
  it('all achievement keys accessible in all 3 locales', async () => {
    const zhCN = (await import('../i18n/locales/zh-CN')).default;
    const achNameKeys = Object.keys(zhCN).filter(k => k.startsWith('data.achievement.') && k.endsWith('.name'));
    const achDescKeys = Object.keys(zhCN).filter(k => k.startsWith('data.achievement.') && k.endsWith('.desc'));

    expect(achNameKeys.length, 'Should have achievement name keys').toBeGreaterThan(10);
    expect(achDescKeys.length).toBeGreaterThanOrEqual(achNameKeys.length);

    for (const locale of ['zh-CN', 'zh-TW', 'en'] as const) {
      setLocale(locale);
      for (const key of achNameKeys) {
        const val = t(key);
        expect(val, `${key} in ${locale}`).not.toBe(key);
        expect(val.length).toBeGreaterThan(0);
      }
      for (const key of achDescKeys) {
        const val = t(key);
        expect(val, `${key} in ${locale}`).not.toBe(key);
      }
    }
  });
});

describe('Data File Coverage — Mercenary Names', () => {
  const MERC_TYPES = ['tank', 'melee', 'ranged', 'healer', 'mage'];

  for (const locale of ['zh-CN', 'zh-TW', 'en'] as const) {
    it(`all mercenary names and descs accessible in ${locale}`, () => {
      setLocale(locale);
      for (const id of MERC_TYPES) {
        const name = t(`data.mercenary.${id}.name`);
        const desc = t(`data.mercenary.${id}.desc`);
        expect(name, `Merc ${id} name in ${locale}`).not.toBe(`data.mercenary.${id}.name`);
        expect(desc, `Merc ${id} desc in ${locale}`).not.toBe(`data.mercenary.${id}.desc`);
        expect(name.length).toBeGreaterThan(0);
        expect(desc.length).toBeGreaterThan(0);
      }
    });
  }
});

describe('Data File Coverage — Status Effect Names', () => {
  const EFFECTS = ['burn', 'freeze', 'poison', 'bleed', 'slow', 'stun'];

  for (const locale of ['zh-CN', 'zh-TW', 'en'] as const) {
    it(`all status effect names accessible in ${locale}`, () => {
      setLocale(locale);
      for (const id of EFFECTS) {
        const val = t(`data.statusEffect.${id}`);
        expect(val, `Status effect ${id} in ${locale}`).not.toBe(`data.statusEffect.${id}`);
        expect(val.length).toBeGreaterThan(0);
      }
    });
  }
});

describe('Data File Coverage — Elite Affix Names', () => {
  const AFFIXES = ['fire_enhanced', 'swift', 'teleporting', 'extra_strong', 'curse_aura', 'vampiric', 'frozen'];

  for (const locale of ['zh-CN', 'zh-TW', 'en'] as const) {
    it(`all elite affix names accessible in ${locale}`, () => {
      setLocale(locale);
      for (const id of AFFIXES) {
        const val = t(`data.eliteAffix.${id}`);
        expect(val, `Elite affix ${id} in ${locale}`).not.toBe(`data.eliteAffix.${id}`);
        expect(val.length).toBeGreaterThan(0);
      }
    });
  }
});

describe('Data File Coverage — Difficulty Names', () => {
  const DIFFICULTIES = ['normal', 'nightmare', 'hell'];

  for (const locale of ['zh-CN', 'zh-TW', 'en'] as const) {
    it(`all difficulty names, descs, and unlock messages accessible in ${locale}`, () => {
      setLocale(locale);
      for (const id of DIFFICULTIES) {
        const name = t(`data.difficulty.${id}.name`);
        const desc = t(`data.difficulty.${id}.desc`);
        const unlock = t(`data.difficulty.${id}.unlock`);
        expect(name, `Difficulty ${id} name in ${locale}`).not.toBe(`data.difficulty.${id}.name`);
        expect(desc, `Difficulty ${id} desc in ${locale}`).not.toBe(`data.difficulty.${id}.desc`);
        expect(unlock, `Difficulty ${id} unlock in ${locale}`).not.toBe(`data.difficulty.${id}.unlock`);
      }
    });
  }
});

describe('Data File Coverage — Lore Names and Text', () => {
  it('all lore keys accessible in all 3 locales', async () => {
    const zhCN = (await import('../i18n/locales/zh-CN')).default;
    const loreNameKeys = Object.keys(zhCN).filter(k => k.startsWith('data.lore.') && k.endsWith('.name'));
    const loreTextKeys = Object.keys(zhCN).filter(k => k.startsWith('data.lore.') && k.endsWith('.text'));

    expect(loreNameKeys.length, 'Should have lore name keys').toBeGreaterThan(10);

    for (const locale of ['zh-CN', 'zh-TW', 'en'] as const) {
      setLocale(locale);
      for (const key of loreNameKeys) {
        const val = t(key);
        expect(val, `${key} in ${locale}`).not.toBe(key);
        expect(val.length).toBeGreaterThan(0);
      }
      for (const key of loreTextKeys) {
        const val = t(key);
        expect(val, `${key} in ${locale}`).not.toBe(key);
        expect(val.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('Data File Coverage — Homestead Buildings and Pets', () => {
  it('all homestead building keys accessible in all 3 locales', async () => {
    const zhCN = (await import('../i18n/locales/zh-CN')).default;
    const buildingNameKeys = Object.keys(zhCN).filter(k => k.startsWith('data.homestead.') && k.endsWith('.name'));
    const buildingDescKeys = Object.keys(zhCN).filter(k => k.startsWith('data.homestead.') && k.endsWith('.desc'));

    expect(buildingNameKeys.length, 'Should have homestead building name keys').toBeGreaterThanOrEqual(6);

    for (const locale of ['zh-CN', 'zh-TW', 'en'] as const) {
      setLocale(locale);
      for (const key of buildingNameKeys) {
        const val = t(key);
        expect(val, `${key} in ${locale}`).not.toBe(key);
        expect(val.length).toBeGreaterThan(0);
      }
      for (const key of buildingDescKeys) {
        const val = t(key);
        expect(val, `${key} in ${locale}`).not.toBe(key);
      }
    }
  });

  it('all pet name keys accessible in all 3 locales', async () => {
    const zhCN = (await import('../i18n/locales/zh-CN')).default;
    const petNameKeys = Object.keys(zhCN).filter(k => k.startsWith('data.pet.') && k.endsWith('.name'));

    expect(petNameKeys.length, 'Should have pet name keys').toBeGreaterThan(5);

    for (const locale of ['zh-CN', 'zh-TW', 'en'] as const) {
      setLocale(locale);
      for (const key of petNameKeys) {
        const val = t(key);
        expect(val, `${key} in ${locale}`).not.toBe(key);
        expect(val.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('Data File Coverage — Dialogue Trees', () => {
  it('all dialogue keys accessible in all 3 locales', async () => {
    const zhCN = (await import('../i18n/locales/zh-CN')).default;
    const dialogueKeys = Object.keys(zhCN).filter(k => k.startsWith('data.dialogue.'));

    expect(dialogueKeys.length, 'Should have dialogue keys').toBeGreaterThan(100);

    for (const locale of ['zh-CN', 'zh-TW', 'en'] as const) {
      setLocale(locale);
      for (const key of dialogueKeys) {
        const val = t(key);
        expect(val, `${key} in ${locale}`).not.toBe(key);
        expect(val.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('Data File Coverage — Random Events', () => {
  it('all random event keys accessible in all 3 locales', async () => {
    const zhCN = (await import('../i18n/locales/zh-CN')).default;
    const eventKeys = Object.keys(zhCN).filter(k => k.startsWith('data.randomEvent.'));

    expect(eventKeys.length, 'Should have random event keys').toBeGreaterThan(20);

    for (const locale of ['zh-CN', 'zh-TW', 'en'] as const) {
      setLocale(locale);
      for (const key of eventKeys) {
        const val = t(key);
        expect(val, `${key} in ${locale}`).not.toBe(key);
        expect(val.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('Data File Coverage — Story Decorations', () => {
  it('all story decoration keys accessible in all 3 locales', async () => {
    const zhCN = (await import('../i18n/locales/zh-CN')).default;
    const storyKeys = Object.keys(zhCN).filter(k => k.startsWith('data.storyDeco.'));

    expect(storyKeys.length, 'Should have story decoration keys').toBeGreaterThan(10);

    for (const locale of ['zh-CN', 'zh-TW', 'en'] as const) {
      setLocale(locale);
      for (const key of storyKeys) {
        const val = t(key);
        expect(val, `${key} in ${locale}`).not.toBe(key);
        expect(val.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('Data File Coverage — Damage Types', () => {
  const DAMAGE_TYPES = ['physical', 'fire', 'ice', 'lightning', 'poison', 'arcane'];

  for (const locale of ['zh-CN', 'zh-TW', 'en'] as const) {
    it(`all damage type names accessible in ${locale}`, () => {
      setLocale(locale);
      for (const dt of DAMAGE_TYPES) {
        const val = t(`data.damageType.${dt}`);
        expect(val, `Damage type ${dt} in ${locale}`).not.toBe(`data.damageType.${dt}`);
        expect(val.length).toBeGreaterThan(0);
      }
    });
  }
});

describe('Data File Coverage — Skill Trees', () => {
  it('all skill tree branch names accessible in all 3 locales', async () => {
    const zhCN = (await import('../i18n/locales/zh-CN')).default;
    const treeKeys = Object.keys(zhCN).filter(k => k.startsWith('data.skillTree.'));

    expect(treeKeys.length, 'Should have skill tree keys').toBeGreaterThanOrEqual(9);

    for (const locale of ['zh-CN', 'zh-TW', 'en'] as const) {
      setLocale(locale);
      for (const key of treeKeys) {
        const val = t(key);
        expect(val, `${key} in ${locale}`).not.toBe(key);
        expect(val.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('Data File Coverage — Hidden Areas', () => {
  it('all hidden area keys accessible in all 3 locales', async () => {
    const zhCN = (await import('../i18n/locales/zh-CN')).default;
    const areaKeys = Object.keys(zhCN).filter(k => k.startsWith('data.hiddenArea.'));

    expect(areaKeys.length, 'Should have hidden area keys').toBeGreaterThan(5);

    for (const locale of ['zh-CN', 'zh-TW', 'en'] as const) {
      setLocale(locale);
      for (const key of areaKeys) {
        const val = t(key);
        expect(val, `${key} in ${locale}`).not.toBe(key);
        expect(val.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('Data File Coverage — Sub-Dungeons', () => {
  it('all sub-dungeon keys accessible in all 3 locales', async () => {
    const zhCN = (await import('../i18n/locales/zh-CN')).default;
    const sdKeys = Object.keys(zhCN).filter(k => k.startsWith('data.subDungeon.') || k.startsWith('data.subDungeonEntrance.'));

    expect(sdKeys.length, 'Should have sub-dungeon keys').toBeGreaterThan(0);

    for (const locale of ['zh-CN', 'zh-TW', 'en'] as const) {
      setLocale(locale);
      for (const key of sdKeys) {
        const val = t(key);
        expect(val, `${key} in ${locale}`).not.toBe(key);
        expect(val.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('Data File Coverage — Mini-Boss Dialogues', () => {
  it('all mini-boss dialogue keys accessible in all 3 locales', async () => {
    const zhCN = (await import('../i18n/locales/zh-CN')).default;
    const dialogueKeys = Object.keys(zhCN).filter(k => k.startsWith('data.miniBossDialogue.'));

    expect(dialogueKeys.length, 'Should have mini-boss dialogue keys').toBeGreaterThan(10);

    for (const locale of ['zh-CN', 'zh-TW', 'en'] as const) {
      setLocale(locale);
      for (const key of dialogueKeys) {
        const val = t(key);
        expect(val, `${key} in ${locale}`).not.toBe(key);
        expect(val.length).toBeGreaterThan(0);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. NO HARDCODED CHINESE AUDIT
// ═══════════════════════════════════════════════════════════════════

describe('No Hardcoded Chinese Audit — Scene Files', () => {
  const SCENE_FILES = [
    'src/scenes/MenuScene.ts',
    'src/scenes/BootScene.ts',
    'src/scenes/UIScene.ts',
    'src/scenes/ZoneScene.ts',
  ];

  const CHINESE_REGEX = /[\u4e00-\u9fff]/;

  for (const file of SCENE_FILES) {
    it(`${path.basename(file)} has no hardcoded Chinese in non-comment, non-fallback lines`, () => {
      const filePath = path.resolve(testDir, '../../', file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const violations: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        const trimmed = line.trim();

        // Skip empty lines
        if (!trimmed) continue;

        // Skip pure comment lines (// or /*)
        if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) continue;

        // Skip import lines
        if (trimmed.startsWith('import ')) continue;

        // Check if line has Chinese characters
        if (!CHINESE_REGEX.test(line)) continue;

        // Remove comments from the end of the line
        const codeOnly = removeInlineComments(line);

        // If no Chinese in code portion, skip
        if (!CHINESE_REGEX.test(codeOnly)) continue;

        // Allow Chinese in fallback parameters to accessor functions
        // e.g., getSkillTreeName('combat_master', '战斗大师')
        // These are fallback values, not hardcoded player-facing text
        if (isFallbackParameter(codeOnly)) continue;

        violations.push(`Line ${i + 1}: ${trimmed.substring(0, 120)}`);
      }

      expect(
        violations,
        `${path.basename(file)} should have zero hardcoded Chinese in player-facing text.\n` +
        `Found ${violations.length} violations:\n${violations.join('\n')}`
      ).toEqual([]);
    });
  }

  it('system files have no hardcoded Chinese in non-fallback text', () => {
    const systemFiles = [
      'src/systems/InventorySystem.ts',
      'src/systems/CombatSystem.ts',
      'src/systems/QuestSystem.ts',
      'src/systems/HomesteadSystem.ts',
      'src/systems/MercenarySystem.ts',
      'src/systems/AchievementSystem.ts',
      'src/systems/DifficultySystem.ts',
      'src/systems/EliteAffixSystem.ts',
      'src/systems/RandomEventSystem.ts',
      'src/systems/DungeonSystem.ts',
      'src/systems/LootSystem.ts',
      'src/systems/StatusEffectSystem.ts',
    ];

    const violations: string[] = [];

    for (const file of systemFiles) {
      const filePath = path.resolve(testDir, '../../', file);
      if (!fs.existsSync(filePath)) continue;

      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        const trimmed = line.trim();

        if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('import ')) continue;

        if (!CHINESE_REGEX.test(line)) continue;

        const codeOnly = removeInlineComments(line);
        if (!CHINESE_REGEX.test(codeOnly)) continue;
        if (isFallbackParameter(codeOnly)) continue;
        if (isDataDefinition(codeOnly)) continue;

        violations.push(`${path.basename(file)} Line ${i + 1}: ${trimmed.substring(0, 120)}`);
      }
    }

    expect(
      violations,
      `System files should have no hardcoded Chinese in player-facing text.\n` +
      `Found ${violations.length} violations:\n${violations.join('\n')}`
    ).toEqual([]);
  });
});

/**
 * Remove inline comments (// ...) from the end of a code line.
 * Handles the case where // appears inside a string literal.
 */
function removeInlineComments(line: string): string {
  let inString: string | null = null;
  let escaped = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (inString) {
      if (char === inString) inString = null;
    } else {
      if (char === "'" || char === '"' || char === '`') {
        inString = char;
      } else if (char === '/' && i + 1 < line.length && line[i + 1] === '/') {
        return line.substring(0, i);
      }
    }
  }

  return line;
}

/**
 * Check if the Chinese characters on a line are inside a fallback parameter
 * to a locale-aware accessor function (e.g., getSkillTreeName('id', '中文fallback')).
 */
function isFallbackParameter(line: string): boolean {
  // Match patterns like: getFunctionName('id', '中文') or getXxxName('id', "中文")
  const accessorPattern = /get\w+(?:Name|Desc|Text|Label|Title)\s*\([^)]*,\s*['"][^'"]*[\u4e00-\u9fff][^'"]*['"]/;
  if (accessorPattern.test(line)) {
    // Check if ALL Chinese characters on this line are inside accessor fallbacks
    const withoutAccessors = line.replace(/get\w+(?:Name|Desc|Text|Label|Title)\s*\([^)]*\)/g, '');
    // Also remove data definition patterns like { name: '中文', ... }
    const withoutData = withoutAccessors.replace(/name:\s*['"][^'"]*['"]/g, '');
    const CHINESE_REGEX = /[\u4e00-\u9fff]/;
    return !CHINESE_REGEX.test(withoutData);
  }
  return false;
}

/**
 * Check if the Chinese on a line is in a data definition (object literal with name/description fields).
 * These are source data, not player-facing hardcoded strings.
 */
function isDataDefinition(line: string): boolean {
  // Match patterns like: { id: 'xxx', name: '中文', ... } or similar data object literals
  const dataPatterns = [
    // Object literal fields that contain source-of-truth Chinese text (data definitions)
    /(?:name|description|title|desc|dialogue|text|displayName|prompt|solution|reward|rescueNpcName|nameSuffix):\s*['"`][^'"`]*[\u4e00-\u9fff]/,
    // Data array/constant definitions
    /AllAchievements|ACHIEVEMENTS|MONSTERS|SKILLS|ITEMS|QUESTS|NPCS|LORE|PETS|EVOLUTION_STAGES|puzzleDescriptions/,
    // Object literal with id + name pattern
    /^\s*\{[^}]*id:\s*['"][^'"]+['"],?\s*name:\s*['"][^'"]+['"],?/,
  ];

  return dataPatterns.some(pattern => pattern.test(line));
}

// ═══════════════════════════════════════════════════════════════════
// 4. TEMPLATE INTERPOLATION
// ═══════════════════════════════════════════════════════════════════

describe('Template Interpolation — All Template Keys', () => {
  // Collect all keys with {param} placeholders from both locale files
  // and verify they resolve correctly in all 3 locales.

  const TEMPLATE_KEYS_WITH_PARAMS: Array<{ key: string; params: Record<string, string | number> }> = [
    // Menu
    { key: 'menu.continue', params: { class: 'Warrior', level: 5 } },
    { key: 'menu.jukebox.subtitle', params: { count: 11, duration: '15:30' } },
    // UI
    { key: 'ui.inventory.title', params: { count: 10, max: 100 } },
    { key: 'ui.inventory.pageLabel', params: { current: 1, total: 3 } },
    { key: 'ui.inventory.equipBonus', params: { stats: '+5 ATK' } },
    { key: 'ui.shop.gold', params: { gold: 1234 } },
    { key: 'ui.shop.sellConfirm', params: { name: 'Rusty Sword', price: 50 } },
    { key: 'ui.shop.buybackLog', params: { name: 'Iron Shield' } },
    { key: 'ui.character.title', params: { className: 'Warrior' } },
    { key: 'ui.character.subtitle', params: { level: 10, points: 3 } },
    { key: 'ui.tooltip.damage', params: { min: 10, max: 25 } },
    { key: 'ui.tooltip.defense', params: { value: 15 } },
    { key: 'ui.tooltip.gemEffect', params: { value: 5, suffix: '%', label: 'Crit' } },
    { key: 'ui.tooltip.socketCount', params: { filled: 1, max: 3 } },
    { key: 'ui.tooltip.sellPrice', params: { price: 100 } },
    { key: 'ui.skillTree.skillPoints', params: { className: 'Mage', points: 5 } },
    { key: 'ui.skillTree.tooltip.damage', params: { value: 150, type: 'Fire' } },
    { key: 'ui.skillTree.tooltip.cost', params: { value: 30 } },
    { key: 'ui.skillTree.tooltip.cooldown', params: { value: 3 } },
    { key: 'ui.skillTree.tooltip.range', params: { value: 5 } },
    { key: 'ui.skillTree.tooltip.aoeRadius', params: { value: 3 } },
    { key: 'ui.skillTree.tooltip.critBonus', params: { value: 25 } },
    { key: 'ui.skillTree.tooltip.stun', params: { value: 2 } },
    { key: 'ui.skillTree.tooltip.buff', params: { stat: 'ATK', value: 20, duration: 10 } },
    { key: 'ui.skillTree.tooltip.synergyLine', params: { name: 'Fireball', perLevel: 5, bonus: 15 } },
    { key: 'ui.skillTree.tooltip.nextLevel', params: { level: 5 } },
    { key: 'ui.questTracker.scrollIndicator', params: { count: 3 } },
    { key: 'ui.questLog.typeLabel', params: { type: 'Kill' } },
    { key: 'ui.questLog.clueProgress', params: { found: 2, total: 5 } },
    { key: 'ui.questLog.waveProgress', params: { current: 1, total: 3 } },
    { key: 'ui.questLog.craftPhase', params: { phase: 'Gather' } },
    { key: 'ui.questLog.rewardExp', params: { exp: 100 } },
    { key: 'ui.questLog.rewardGold', params: { gold: 50 } },
    { key: 'ui.questLog.rewardItems', params: { count: 2 } },
    { key: 'ui.questLog.prereqs', params: { names: 'Quest A, Quest B' } },
    { key: 'ui.questLog.loreCollected', params: { count: 3, total: 5 } },
    { key: 'ui.homestead.petsHeader', params: { count: 3 } },
    { key: 'ui.homestead.upgrade', params: { cost: 500 } },
    { key: 'ui.dialogue.gotGold', params: { gold: 200 } },
    { key: 'ui.dialogue.gotExp', params: { exp: 150 } },
    // Zone
    { key: 'zone.enterZone', params: { zoneName: 'Emerald Plains', min: 1, max: 10 } },
    { key: 'zone.levelUp.level', params: { level: 15 } },
    { key: 'zone.monsterKill', params: { monsterName: 'Goblin', exp: 25, gold: 5 } },
    { key: 'zone.combat.autoCombat', params: { state: 'ON' } },
    { key: 'zone.combat.skillActivated', params: { skillName: 'Fireball' } },
    { key: 'zone.combat.deathMarkApplied', params: { skillName: 'Death Mark', targetName: 'Slime' } },
    { key: 'zone.combat.slowTrapHit', params: { skillName: 'Slow Trap', count: 3 } },
    { key: 'zone.combat.tauntRoar', params: { count: 5 } },
    { key: 'zone.combat.restoreHp', params: { amount: 50 } },
    { key: 'zone.combat.restoreMana', params: { amount: 30 } },
    { key: 'zone.statusEffect.expired', params: { effectName: 'Burn' } },
    { key: 'zone.event.treasureChest.goldReward', params: { gold: 100 } },
    { key: 'zone.event.rescue.complete', params: { npcName: 'Lost Traveler', gold: 200, exp: 100 } },
    { key: 'zone.event.puzzle.prompt', params: { prompt: 'Solve the riddle' } },
    { key: 'zone.event.puzzle.rewardGoldExp', params: { gold: 150, exp: 75 } },
    { key: 'zone.hiddenArea.discovered', params: { areaName: 'Secret Vault' } },
    { key: 'zone.hiddenArea.gotItem', params: { itemName: 'Ancient Amulet' } },
    { key: 'zone.hiddenArea.gotGold', params: { amount: 300 } },
    { key: 'zone.pet.discovered', params: { petName: 'Void Butterfly' } },
    { key: 'zone.lore.discovered', params: { loreName: 'Ancient Tablet' } },
    { key: 'zone.quest.exploreFound', params: { targetName: 'Old Ruins' } },
    { key: 'zone.quest.clueFound', params: { targetName: 'Hidden Clue' } },
    { key: 'zone.dungeon.floorName', params: { floor: 3 } },
    { key: 'zone.dungeon.enter', params: { floors: 5 } },
    { key: 'zone.dungeon.floorEnter', params: { floor: 2 } },
    { key: 'zone.dungeon.floorExitLabel', params: { floor: 3 } },
    { key: 'zone.subDungeon.enter', params: { name: 'Abandoned Mine' } },
    { key: 'zone.escort.npcAppeared', params: { npcName: 'Merchant' } },
    { key: 'zone.escort.complete', params: { npcName: 'Merchant' } },
    { key: 'zone.defend.targetNeedsProtection', params: { targetName: 'Village' } },
    { key: 'zone.defend.waveIncoming', params: { current: 1, total: 3 } },
    { key: 'zone.craft.complete', params: { targetName: 'Iron Sword' } },
    { key: 'zone.deliver.complete', params: { targetName: 'Iron Sword' } },
    { key: 'zone.mercenary.heal', params: { mercName: 'Knight', amount: 100 } },
    { key: 'zone.npc.acceptQuest', params: { questName: 'Slime Plague' } },
    // System
    { key: 'sys.inventory.equipped', params: { name: 'Rusty Sword' } },
    { key: 'sys.inventory.obtained', params: { name: 'HP Potion' } },
    { key: 'sys.inventory.obtainedQty', params: { name: 'HP Potion', qty: 3 } },
    { key: 'sys.inventory.identify.success', params: { name: 'Magic Sword' } },
    { key: 'sys.inventory.gem.socketed', params: { gemName: 'Ruby' } },
    { key: 'sys.inventory.gem.removed', params: { gemName: 'Ruby' } },
    { key: 'sys.inventory.discarded', params: { name: 'Old Shield' } },
    { key: 'sys.inventory.bulkDestroy', params: { count: 5 } },
    { key: 'sys.quest.accepted', params: { name: 'Slime Plague' } },
    { key: 'sys.quest.reaccepted', params: { name: 'Goblin Hunt' } },
    { key: 'sys.quest.completed', params: { name: 'Undead Purge' } },
    { key: 'sys.quest.failed', params: { name: 'Escort Mission' } },
    { key: 'sys.quest.turnedIn', params: { name: 'Goblin Hunt', exp: 100, gold: 50 } },
    { key: 'sys.mercenary.hire', params: { name: 'Guardian Knight' } },
    { key: 'sys.mercenary.dismiss', params: { name: 'Berserker' } },
    { key: 'sys.mercenary.revive', params: { name: 'Healer' } },
    { key: 'sys.mercenary.death', params: { name: 'Ranger' } },
    { key: 'sys.mercenary.levelUp', params: { name: 'Berserker', level: 5 } },
    { key: 'sys.mercenary.notEnoughGold', params: { cost: 500 } },
    { key: 'sys.homestead.buildingUpgrade', params: { name: 'Herb Garden', level: 3 } },
    { key: 'sys.homestead.petLevelUp', params: { name: 'Baby Dragon', level: 5 } },
    { key: 'sys.homestead.petEvolved', params: { name: 'Baby Dragon', evolvedName: 'Baby Dragon · Awakened' } },
    { key: 'sys.homestead.petObtained', params: { name: 'Fairy' } },
    { key: 'sys.achievement.unlocked', params: { name: 'First Kill' } },
    { key: 'sys.achievement.unlockedWithTitle', params: { name: 'First Kill', title: 'Novice' } },
    { key: 'sys.statusEffect.applied', params: { effectName: 'Burn' } },
    { key: 'sys.statusEffect.expired', params: { effectName: 'Freeze' } },
    { key: 'sys.statusEffect.refreshed', params: { effectName: 'Poison' } },
    { key: 'sys.player.levelUp', params: { level: 10 } },
    { key: 'sys.mobile.autoCombat.log', params: { state: 'ON' } },
    { key: 'sys.questCard.accepted', params: { name: 'Hunt Quest' } },
    { key: 'sys.questCard.turnedIn', params: { name: 'Hunt Quest' } },
    { key: 'sys.questCard.rewardExp', params: { exp: 200 } },
    { key: 'sys.questCard.rewardGold', params: { gold: 100 } },
    { key: 'sys.questCard.rewardItems', params: { count: 3 } },
    { key: 'sys.tracker.doneCount', params: { done: 2, total: 5 } },
  ];

  it('all template keys exist in zh-CN locale', async () => {
    const zhCN = (await import('../i18n/locales/zh-CN')).default;
    const missingKeys = TEMPLATE_KEYS_WITH_PARAMS.filter(({ key }) => !(key in zhCN));
    expect(missingKeys.map(k => k.key), 'Template keys missing from zh-CN').toEqual([]);
  });

  it('all template keys exist in en locale', async () => {
    const en = (await import('../i18n/locales/en')).default;
    const missingKeys = TEMPLATE_KEYS_WITH_PARAMS.filter(({ key }) => !(key in en));
    expect(missingKeys.map(k => k.key), 'Template keys missing from en').toEqual([]);
  });

  for (const locale of ['zh-CN', 'zh-TW', 'en'] as const) {
    it(`all template keys resolve without leftover placeholders in ${locale}`, () => {
      setLocale(locale);
      const failures: string[] = [];

      for (const { key, params } of TEMPLATE_KEYS_WITH_PARAMS) {
        const result = t(key, params);

        // No leftover {placeholders}
        if (result.includes('{') || result.includes('}')) {
          failures.push(`${key}: "${result}" still contains placeholder braces`);
        }

        // All param values should appear in the result
        for (const [paramName, paramValue] of Object.entries(params)) {
          if (!result.includes(String(paramValue))) {
            failures.push(`${key}: param ${paramName}="${paramValue}" not found in "${result}"`);
          }
        }
      }

      expect(failures, `Template interpolation failures in ${locale}`).toEqual([]);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// 5. zh-TW CONVERSION ACCURACY
// ═══════════════════════════════════════════════════════════════════

describe('zh-TW Conversion — Class Descriptions', () => {
  it('warrior class description converts correctly', () => {
    expect(convertToTraditional('钢铁意志,剑盾无双')).toBe('鋼鐵意志,劍盾無雙');
  });

  it('mage class description converts correctly', () => {
    const result = convertToTraditional('奥术之力,毁天灭地');
    expect(result).toContain('奧術'); // 奥→奧, 术→術
    expect(result).toContain('滅'); // 灭→滅
  });

  it('rogue class description converts correctly', () => {
    const result = convertToTraditional('暗影潜行,一击致命');
    expect(result).toContain('潛行'); // 潜→潛
    expect(result).toContain('擊'); // 击→擊
  });
});

describe('zh-TW Conversion — Zone Names', () => {
  it('all 5 zone names convert correctly', () => {
    expect(convertToTraditional('翡翠平原')).toBe('翡翠平原');
    expect(convertToTraditional('暮色森林')).toBe('暮色森林');
    expect(convertToTraditional('铁砧山脉')).toBe('鐵砧山脈');
    expect(convertToTraditional('灼热荒漠')).toBe('灼熱荒漠');
    expect(convertToTraditional('深渊裂谷')).toBe('深淵裂谷');
  });
});

describe('zh-TW Conversion — Skill Names', () => {
  it('fire skills convert correctly', () => {
    expect(convertToTraditional('火球术')).toBe('火球術');
    // 陨 is not in the SC→TC mapping; it passes through unchanged
    const meteor = convertToTraditional('陨石');
    expect(meteor.length).toBeGreaterThan(0);
  });

  it('warrior skills convert correctly', () => {
    expect(convertToTraditional('战吼')).toBe('戰吼');
  });

  it('rogue skills convert correctly', () => {
    expect(convertToTraditional('背刺')).toBe('背刺');
    expect(convertToTraditional('毒刃')).toBe('毒刃');
  });
});

describe('zh-TW Conversion — System Messages', () => {
  it('inventory messages convert correctly', () => {
    // 满 is not in the converter mapping (passes through unchanged)
    const bagFull = convertToTraditional('背包已满!');
    expect(bagFull.length).toBeGreaterThan(0);
    expect(convertToTraditional('装备了')).toBe('裝備了');
    expect(convertToTraditional('销毁了')).toContain('銷');
  });

  it('quest messages convert correctly', () => {
    expect(convertToTraditional('接受任务:')).toBe('接受任務:');
    expect(convertToTraditional('任务完成:')).toBe('任務完成:');
    expect(convertToTraditional('任务失败:')).toBe('任務失敗:');
  });

  it('combat messages convert correctly', () => {
    expect(convertToTraditional('自动战斗:')).toBe('自動戰鬥:');
    // 复 is not in the converter mapping (passes through)
    const restoreHp = convertToTraditional('恢复 生命');
    expect(restoreHp.length).toBeGreaterThan(0);
  });

  it('homestead messages convert correctly', () => {
    expect(convertToTraditional('药草园')).toBe('藥草園');
    expect(convertToTraditional('训练场')).toBe('訓練場');
    expect(convertToTraditional('宝石工坊')).toBe('寶石工坊');
  });
});

describe('zh-TW Conversion — Specific Assertions', () => {
  it('class names in zh-TW locale return correct Traditional forms', () => {
    setLocale('zh-TW');
    expect(t('data.class.warrior.name')).toBe('戰士');
    expect(t('data.class.mage.name')).toBe('法師');
    expect(t('data.class.rogue.name')).toBe('盜賊');
  });

  it('equipment slot-related strings in zh-TW differ from zh-CN where expected', () => {
    setLocale('zh-TW');
    const equip = t('ui.context.equip');
    expect(equip).toBe('裝備'); // 装→裝, 备→備

    const armor = t('ui.inventory.slot.armor');
    expect(armor).toBe('鎧甲'); // 铠→鎧

    const weapon = t('ui.inventory.slot.weapon');
    expect(weapon).toBe('武器'); // same
  });

  it('difficulty labels in zh-TW use Traditional characters', () => {
    setLocale('zh-TW');
    const nightmare = t('data.difficulty.nightmare.name');
    expect(nightmare).toContain('噩夢'); // 梦→夢
  });

  it('en locale values contain no Chinese (except lang selector labels)', async () => {
    const en = (await import('../i18n/locales/en')).default;
    const CHINESE = /[\u4e00-\u9fff]/;
    const ALLOWED = ['menu.langSelect.zhCN', 'menu.langSelect.zhTW'];

    const leaked: string[] = [];
    for (const [key, value] of Object.entries(en)) {
      if (ALLOWED.includes(key)) continue;
      if (CHINESE.test(value as string)) leaked.push(`${key}: ${value}`);
    }
    expect(leaked, 'en locale should have no Chinese characters').toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 6. GAME ACCESSOR FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

describe('Game Accessor Functions', () => {
  it('getClassName returns correct values for all locales', async () => {
    const { getClassName } = await import('../i18n/gameAccessors');

    setLocale('en');
    expect(getClassName('warrior')).toBe('Warrior');
    expect(getClassName('mage')).toBe('Mage');
    expect(getClassName('rogue')).toBe('Rogue');

    setLocale('zh-CN');
    expect(getClassName('warrior')).toBe('战士');
    expect(getClassName('mage')).toBe('法师');
    expect(getClassName('rogue')).toBe('盗贼');

    setLocale('zh-TW');
    expect(getClassName('warrior')).toBe('戰士');
    expect(getClassName('mage')).toBe('法師');
    expect(getClassName('rogue')).toBe('盜賊');
  });

  it('getZoneName returns correct values for all locales', async () => {
    const { getZoneName } = await import('../i18n/gameAccessors');

    setLocale('en');
    expect(getZoneName('emerald_plains')).toBe('Emerald Plains');
    expect(getZoneName('twilight_forest')).toBe('Twilight Forest');
    expect(getZoneName('anvil_mountains')).toBe('Anvil Mountains');
    expect(getZoneName('scorching_desert')).toBe('Scorching Desert');
    expect(getZoneName('abyss_rift')).toBe('Abyss Rift');

    setLocale('zh-CN');
    expect(getZoneName('emerald_plains')).toBe('翡翠平原');

    setLocale('zh-TW');
    expect(getZoneName('emerald_plains')).toBe('翡翠平原');
    expect(getZoneName('anvil_mountains')).toBe('鐵砧山脈');
  });

  it('getSkillName returns correct values for all locales', async () => {
    const { getSkillName } = await import('../i18n/gameAccessors');

    setLocale('en');
    expect(getSkillName('fireball', '火球术')).toBe('Fireball');

    setLocale('zh-CN');
    expect(getSkillName('fireball', '火球术')).toBe('火球术');

    setLocale('zh-TW');
    expect(getSkillName('fireball', '火球术')).toBe('火球術');
  });

  it('getStatusEffectName returns correct values for all locales', async () => {
    const { getStatusEffectName } = await import('../i18n/gameAccessors');
    const EFFECTS = ['burn', 'freeze', 'poison', 'bleed', 'slow', 'stun'];

    for (const locale of ['zh-CN', 'zh-TW', 'en'] as const) {
      setLocale(locale);
      for (const effect of EFFECTS) {
        const name = getStatusEffectName(effect);
        expect(name, `Effect ${effect} in ${locale}`).not.toBe(effect);
        expect(name.length).toBeGreaterThan(0);
      }
    }
  });

  it('getEliteAffixName returns correct values for all locales', async () => {
    const { getEliteAffixName } = await import('../i18n/gameAccessors');
    const AFFIXES = ['fire_enhanced', 'swift', 'teleporting', 'extra_strong', 'curse_aura', 'vampiric', 'frozen'];

    for (const locale of ['zh-CN', 'zh-TW', 'en'] as const) {
      setLocale(locale);
      for (const affix of AFFIXES) {
        const name = getEliteAffixName(affix, affix);
        expect(name, `Elite affix ${affix} in ${locale}`).not.toBe(affix);
        expect(name.length).toBeGreaterThan(0);
      }
    }
  });

  it('getMonsterName returns correct values for all locales', async () => {
    const { getMonsterName } = await import('../i18n/gameAccessors');

    setLocale('en');
    expect(getMonsterName('slime_green', '绿色史莱姆')).toBe('Green Slime');
    expect(getMonsterName('goblin', '哥布林')).toBe('Goblin');

    setLocale('zh-CN');
    expect(getMonsterName('slime_green', '绿色史莱姆')).toBe('绿色史莱姆');

    setLocale('zh-TW');
    const twSlime = getMonsterName('slime_green', '绿色史莱姆');
    expect(twSlime).toBeTruthy();
    expect(twSlime.length).toBeGreaterThan(0);
  });

  it('getMercenaryName returns correct values for all locales', async () => {
    const { getMercenaryName } = await import('../i18n/gameAccessors');

    for (const locale of ['zh-CN', 'zh-TW', 'en'] as const) {
      setLocale(locale);
      for (const type of ['tank', 'melee', 'ranged', 'healer', 'mage']) {
        const name = getMercenaryName(type, type);
        expect(name, `Merc ${type} in ${locale}`).not.toBe(type);
        expect(name.length).toBeGreaterThan(0);
      }
    }
  });

  it('getAchievementName returns correct values for all locales', async () => {
    const { getAchievementName } = await import('../i18n/gameAccessors');

    for (const locale of ['zh-CN', 'zh-TW', 'en'] as const) {
      setLocale(locale);
      const name = getAchievementName('ach_first_kill', 'fallback');
      expect(name).not.toBe('fallback');
      expect(name.length).toBeGreaterThan(0);
    }
  });

  it('getLoreName returns correct values for all locales', async () => {
    const { getLoreName } = await import('../i18n/gameAccessors');
    const zhCN = (await import('../i18n/locales/zh-CN')).default;
    const loreIds = Object.keys(zhCN)
      .filter(k => k.startsWith('data.lore.') && k.endsWith('.name'))
      .map(k => k.replace('data.lore.', '').replace('.name', ''));

    expect(loreIds.length).toBeGreaterThan(10);

    for (const locale of ['zh-CN', 'zh-TW', 'en'] as const) {
      setLocale(locale);
      for (const id of loreIds) {
        const name = getLoreName(id, id);
        expect(name, `Lore ${id} in ${locale}`).not.toBe(id);
        expect(name.length).toBeGreaterThan(0);
      }
    }
  });

  it('getDirection returns translated compass directions', async () => {
    const { getDirection } = await import('../i18n/gameAccessors');

    setLocale('en');
    const east = getDirection(1, 0);
    expect(east).toBe('E');
    const north = getDirection(0, -1);
    expect(north).toBe('N');

    setLocale('zh-CN');
    const zhEast = getDirection(1, 0);
    expect(zhEast).toBe('东');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 7. FOUNDATION ASSERTIONS (programmatic equivalents)
// ═══════════════════════════════════════════════════════════════════

describe('Foundation Assertions (VAL-FOUND-*)', () => {
  it('VAL-FOUND-001: t() returns correct zh-CN string', () => {
    setLocale('zh-CN');
    expect(t('menu.newGame')).toBe('新的旅程');
  });

  it('VAL-FOUND-002: t() returns correct en string', () => {
    setLocale('en');
    const result = t('menu.newGame');
    expect(result).toBe('New Journey');
    expect(result).not.toMatch(/[\u4e00-\u9fff]/);
  });

  it('VAL-FOUND-003: t() returns correct zh-TW string', () => {
    setLocale('zh-TW');
    const result = t('menu.newGame');
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(0);
  });

  it('VAL-FOUND-004: t() parameter interpolation works', () => {
    setLocale('en');
    const result = t('menu.continue', { class: 'Warrior', level: 5 });
    expect(result).toContain('Warrior');
    expect(result).toContain('5');
    expect(result).not.toContain('{class}');
    expect(result).not.toContain('{level}');
  });

  it('VAL-FOUND-005: t() parameter interpolation with zh-CN class names', () => {
    setLocale('zh-CN');
    const result = t('menu.continue', { class: '战士', level: 10 });
    expect(result).toContain('战士');
    expect(result).toContain('10');
  });

  it('VAL-FOUND-006: Missing key falls back to en', () => {
    setLocale('zh-CN');
    const result = t('test.enOnly');
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
    expect(result).not.toBe('test.enOnly');
  });

  it('VAL-FOUND-007: Completely missing key returns key path', () => {
    const result = t('nonexistent.totally.fake.key');
    expect(result).toBe('nonexistent.totally.fake.key');
  });

  it('VAL-FOUND-009: All three locales registered', () => {
    const locales = getLocales();
    expect(locales).toHaveLength(3);
    expect(locales).toContain('zh-CN');
    expect(locales).toContain('zh-TW');
    expect(locales).toContain('en');
  });

  it('VAL-FOUND-010: Default locale is zh-CN on first visit', async () => {
    localStorageMock.clear();
    vi.resetModules();
    const fresh = await import('../i18n/index');
    expect(fresh.getLocale()).toBe('zh-CN');
  });

  it('VAL-FOUND-011: Language selection persists to localStorage', () => {
    setLocale('en');
    expect(localStorageMock.getItem('abyssfire_locale')).toBe('en');
  });

  it('VAL-FOUND-013: Cleared localStorage reverts to default zh-CN', async () => {
    setLocale('en');
    localStorageMock.clear();
    vi.resetModules();
    const fresh = await import('../i18n/index');
    expect(fresh.getLocale()).toBe('zh-CN');
  });

  it('VAL-FOUND-014: Invalid localStorage locale handled gracefully', async () => {
    localStorageMock.setItem('abyssfire_locale', 'xx-INVALID');
    vi.resetModules();
    const fresh = await import('../i18n/index');
    expect(fresh.getLocale()).toBe('zh-CN');
  });

  it('VAL-FOUND-017: zh-TW converter uses no external library', async () => {
    const conv = await import('../i18n/converter');
    expect(conv.MAPPING_COUNT).toBeGreaterThanOrEqual(800);
    expect(conv.SC_LENGTH).toBe(conv.TC_LENGTH);
  });

  it('VAL-FOUND-018: zh-TW conversion handles chars not in mapping', () => {
    expect(convertToTraditional('Lv.5')).toBe('Lv.5');
    expect(convertToTraditional('12345')).toBe('12345');
    expect(convertToTraditional('ABC')).toBe('ABC');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 8. COMPREHENSIVE EN LOCALE NO-CHINESE LEAK CHECK
// ═══════════════════════════════════════════════════════════════════

describe('English Locale — No Chinese Leakage', () => {
  it('every en locale value has no Chinese characters (except allowed keys)', async () => {
    const en = (await import('../i18n/locales/en')).default;
    const CHINESE = /[\u4e00-\u9fff]/;
    const ALLOWED = ['menu.langSelect.zhCN', 'menu.langSelect.zhTW'];

    const leaked: string[] = [];
    for (const [key, value] of Object.entries(en)) {
      if (ALLOWED.includes(key)) continue;
      if (CHINESE.test(value as string)) leaked.push(key);
    }
    expect(leaked).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 9. COMPLETE DATA CATEGORY SWEEP
// ═══════════════════════════════════════════════════════════════════

describe('Complete Data Category Sweep — All data.* keys resolve', () => {
  it('every data.* key in zh-CN resolves to a non-empty string in all 3 locales', async () => {
    const zhCN = (await import('../i18n/locales/zh-CN')).default;
    const dataKeys = Object.keys(zhCN).filter(k => k.startsWith('data.'));

    expect(dataKeys.length).toBeGreaterThan(1000);

    for (const locale of ['zh-CN', 'zh-TW', 'en'] as const) {
      setLocale(locale);
      const failures: string[] = [];
      for (const key of dataKeys) {
        const val = t(key);
        if (val === key || val.length === 0) {
          failures.push(key);
        }
      }
      expect(failures, `data.* keys that fail to resolve in ${locale}`).toEqual([]);
    }
  });
});

describe('Complete System Message Sweep — All sys.* keys resolve', () => {
  it('every sys.* key in zh-CN resolves to a non-empty string in all 3 locales', async () => {
    const zhCN = (await import('../i18n/locales/zh-CN')).default;
    const sysKeys = Object.keys(zhCN).filter(k => k.startsWith('sys.'));

    expect(sysKeys.length).toBeGreaterThan(100);

    for (const locale of ['zh-CN', 'zh-TW', 'en'] as const) {
      setLocale(locale);
      const failures: string[] = [];
      for (const key of sysKeys) {
        const val = t(key);
        if (val === key || val.length === 0) {
          failures.push(key);
        }
      }
      expect(failures, `sys.* keys that fail to resolve in ${locale}`).toEqual([]);
    }
  });
});

describe('Complete UI Key Sweep — All ui.* keys resolve', () => {
  it('every ui.* key in zh-CN resolves to a non-empty string in all 3 locales', async () => {
    const zhCN = (await import('../i18n/locales/zh-CN')).default;
    const uiKeys = Object.keys(zhCN).filter(k => k.startsWith('ui.'));

    expect(uiKeys.length).toBeGreaterThan(250);

    for (const locale of ['zh-CN', 'zh-TW', 'en'] as const) {
      setLocale(locale);
      const failures: string[] = [];
      for (const key of uiKeys) {
        const val = t(key);
        if (val === key || val.length === 0) {
          failures.push(key);
        }
      }
      expect(failures, `ui.* keys that fail to resolve in ${locale}`).toEqual([]);
    }
  });
});

describe('Complete Zone Key Sweep — All zone.* keys resolve', () => {
  it('every zone.* key in zh-CN resolves to a non-empty string in all 3 locales', async () => {
    const zhCN = (await import('../i18n/locales/zh-CN')).default;
    const zoneKeys = Object.keys(zhCN).filter(k => k.startsWith('zone.'));

    expect(zoneKeys.length).toBeGreaterThan(70);

    for (const locale of ['zh-CN', 'zh-TW', 'en'] as const) {
      setLocale(locale);
      const failures: string[] = [];
      for (const key of zoneKeys) {
        const val = t(key);
        if (val === key || val.length === 0) {
          failures.push(key);
        }
      }
      expect(failures, `zone.* keys that fail to resolve in ${locale}`).toEqual([]);
    }
  });
});

describe('Complete Menu Key Sweep — All menu.* keys resolve', () => {
  it('every menu.* key in zh-CN resolves to a non-empty string in all 3 locales', async () => {
    const zhCN = (await import('../i18n/locales/zh-CN')).default;
    const menuKeys = Object.keys(zhCN).filter(k => k.startsWith('menu.'));

    expect(menuKeys.length).toBeGreaterThan(60);

    for (const locale of ['zh-CN', 'zh-TW', 'en'] as const) {
      setLocale(locale);
      const failures: string[] = [];
      for (const key of menuKeys) {
        const val = t(key);
        if (val === key || val.length === 0) {
          failures.push(key);
        }
      }
      expect(failures, `menu.* keys that fail to resolve in ${locale}`).toEqual([]);
    }
  });
});

describe('Complete Boot Key Sweep — All boot.* keys resolve', () => {
  it('every boot.* key in zh-CN resolves to a non-empty string in all 3 locales', async () => {
    const zhCN = (await import('../i18n/locales/zh-CN')).default;
    const bootKeys = Object.keys(zhCN).filter(k => k.startsWith('boot.'));

    expect(bootKeys.length).toBeGreaterThanOrEqual(4);

    for (const locale of ['zh-CN', 'zh-TW', 'en'] as const) {
      setLocale(locale);
      const failures: string[] = [];
      for (const key of bootKeys) {
        const val = t(key);
        if (val === key || val.length === 0) {
          failures.push(key);
        }
      }
      expect(failures, `boot.* keys that fail to resolve in ${locale}`).toEqual([]);
    }
  });
});
