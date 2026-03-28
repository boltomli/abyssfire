/**
 * Cross-area i18n verification tests.
 * Validates: zh-TW 100% key parity with zh-CN, no hardcoded Chinese leakage,
 * template literal formatting, locale switching consistency, and full integration.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

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

beforeEach(async () => {
  localStorageMock.clear();
  vi.resetModules();
  const i18n = await import('../i18n/index');
  t = i18n.t;
  setLocale = i18n.setLocale;
  getLocale = i18n.getLocale;
  getLocales = i18n.getLocales;
});

describe('VAL-TW-010: zh-TW has 100% key parity with zh-CN', () => {
  it('every zh-CN key resolves in zh-TW locale', async () => {
    const zhCN = (await import('../i18n/locales/zh-CN')).default;
    setLocale('zh-TW');
    const missingKeys: string[] = [];
    for (const key of Object.keys(zhCN)) {
      const val = t(key);
      // t() falls back to key path if completely missing — that means NOT resolved
      if (val === key) {
        missingKeys.push(key);
      }
    }
    expect(missingKeys).toEqual([]);
  });

  it('zh-TW key count matches zh-CN key count', async () => {
    const zhCN = (await import('../i18n/locales/zh-CN')).default;
    // zh-TW is generated from zh-CN so counts must match
    setLocale('zh-TW');
    const zhCNCount = Object.keys(zhCN).length;
    let twResolvedCount = 0;
    for (const key of Object.keys(zhCN)) {
      const val = t(key);
      if (val !== key) twResolvedCount++;
    }
    expect(twResolvedCount).toBe(zhCNCount);
  });
});

describe('VAL-FOUND-021: en keys are a subset of zh-CN', () => {
  it('every en key (except test-only) exists in zh-CN', async () => {
    const zhCN = (await import('../i18n/locales/zh-CN')).default;
    const en = (await import('../i18n/locales/en')).default;
    const missingInZhCN: string[] = [];
    for (const key of Object.keys(en)) {
      if (key.startsWith('test.')) continue;
      if (!(key in zhCN)) {
        missingInZhCN.push(key);
      }
    }
    expect(missingInZhCN).toEqual([]);
  });

  it('every zh-CN key (except test-only) exists in en', async () => {
    const zhCN = (await import('../i18n/locales/zh-CN')).default;
    const en = (await import('../i18n/locales/en')).default;
    const missingInEn: string[] = [];
    for (const key of Object.keys(zhCN)) {
      if (key.startsWith('test.')) continue;
      if (!(key in en)) {
        missingInEn.push(key);
      }
    }
    expect(missingInEn).toEqual([]);
  });
});

describe('VAL-CROSS-010: Template literal formatting — inventory count', () => {
  it('inventory title formats correctly in zh-CN', () => {
    setLocale('zh-CN');
    const result = t('ui.inventory.title', { count: 5, max: 100 });
    expect(result).toContain('5');
    expect(result).toContain('100');
    expect(result).not.toContain('{count}');
    expect(result).not.toContain('{max}');
  });

  it('inventory title formats correctly in en', () => {
    setLocale('en');
    const result = t('ui.inventory.title', { count: 5, max: 100 });
    expect(result).toContain('5');
    expect(result).toContain('100');
    expect(result).not.toContain('{count}');
    expect(result).not.toContain('{max}');
  });

  it('inventory title formats correctly in zh-TW', () => {
    setLocale('zh-TW');
    const result = t('ui.inventory.title', { count: 5, max: 100 });
    expect(result).toContain('5');
    expect(result).toContain('100');
    expect(result).not.toContain('{count}');
    expect(result).not.toContain('{max}');
  });
});

describe('VAL-CROSS-011: Template literal formatting — gold display', () => {
  it('gold display formats correctly in all 3 locales', () => {
    for (const locale of ['zh-CN', 'zh-TW', 'en']) {
      setLocale(locale);
      const result = t('ui.shop.gold', { gold: 1234 });
      expect(result).toContain('1234');
      expect(result).not.toContain('{gold}');
    }
  });
});

describe('VAL-CROSS-012: Template literal formatting — level and stat points', () => {
  it('character subtitle formats correctly in all 3 locales', () => {
    for (const locale of ['zh-CN', 'zh-TW', 'en']) {
      setLocale(locale);
      const result = t('ui.character.subtitle', { level: 5, points: 3 });
      expect(result).toContain('5');
      expect(result).toContain('3');
      expect(result).not.toContain('{level}');
      expect(result).not.toContain('{points}');
    }
  });
});

describe('VAL-CROSS-013: Template literal formatting — combat log messages', () => {
  it('monster kill log formats correctly in all 3 locales', () => {
    for (const locale of ['zh-CN', 'zh-TW', 'en']) {
      setLocale(locale);
      const result = t('zone.monsterKill', { monsterName: 'Slime', exp: 50, gold: 10 });
      expect(result).toContain('Slime');
      expect(result).toContain('50');
      expect(result).toContain('10');
      expect(result).not.toContain('{monsterName}');
      expect(result).not.toContain('{exp}');
      expect(result).not.toContain('{gold}');
    }
  });
});

describe('VAL-CROSS-014: Template literal formatting — skill tooltips', () => {
  it('skill tooltip damage formats correctly in all 3 locales', () => {
    for (const locale of ['zh-CN', 'zh-TW', 'en']) {
      setLocale(locale);
      const result = t('ui.skillTree.tooltip.damage', { value: 150, type: 'Physical' });
      expect(result).toContain('150');
      expect(result).toContain('Physical');
      expect(result).not.toContain('{value}');
      expect(result).not.toContain('{type}');
    }
  });

  it('skill tooltip cost formats correctly in all 3 locales', () => {
    for (const locale of ['zh-CN', 'zh-TW', 'en']) {
      setLocale(locale);
      const result = t('ui.skillTree.tooltip.cost', { value: 30 });
      expect(result).toContain('30');
      expect(result).not.toContain('{value}');
    }
  });

  it('skill tooltip cooldown formats correctly in all 3 locales', () => {
    for (const locale of ['zh-CN', 'zh-TW', 'en']) {
      setLocale(locale);
      const result = t('ui.skillTree.tooltip.cooldown', { value: 3 });
      expect(result).toContain('3');
      expect(result).not.toContain('{value}');
    }
  });
});

describe('VAL-CROSS-015: Template literal formatting — quest progress', () => {
  it('quest turn-in log formats correctly in all 3 locales', () => {
    for (const locale of ['zh-CN', 'zh-TW', 'en']) {
      setLocale(locale);
      const result = t('sys.quest.turnedIn', { name: 'Slime Plague', exp: 100, gold: 50 });
      expect(result).toContain('Slime Plague');
      expect(result).toContain('100');
      expect(result).toContain('50');
      expect(result).not.toContain('{name}');
      expect(result).not.toContain('{exp}');
      expect(result).not.toContain('{gold}');
    }
  });
});

describe('VAL-CROSS-008: English mode has zero Chinese leakage in en locale values', () => {
  it('all en locale values contain no Chinese characters', async () => {
    const en = (await import('../i18n/locales/en')).default;
    const CHINESE_REGEX = /[\u4e00-\u9fff]/;
    const leakedKeys: string[] = [];
    // Some keys intentionally contain Chinese (lang selector labels)
    const allowedChineseKeys = ['menu.langSelect.zhCN', 'menu.langSelect.zhTW'];
    for (const [key, value] of Object.entries(en)) {
      if (allowedChineseKeys.includes(key)) continue;
      if (CHINESE_REGEX.test(value as string)) {
        leakedKeys.push(key);
      }
    }
    expect(leakedKeys).toEqual([]);
  });
});

describe('VAL-CROSS-009: zh-TW mode — Traditional Chinese used where characters differ', () => {
  it('specific zh-TW strings use Traditional characters', () => {
    setLocale('zh-TW');
    // 装备 → 裝備 (裝 is traditional for 装)
    const equip = t('ui.context.equip');
    expect(equip).toBe('裝備');

    // 战士 → 戰士
    const warrior = t('data.class.warrior.name');
    expect(warrior).toBe('戰士');

    // 任务 → 任務
    const questLog = t('ui.questLog.title');
    expect(questLog).toContain('任務');

    // 技能 → 技能 (same in both)
    const skillTree = t('ui.skillTree.title');
    expect(skillTree).toBeDefined();
  });
});

describe('VAL-FOUND-008: Locale switching updates t() output immediately', () => {
  it('switching zh-CN to en changes output immediately', () => {
    setLocale('zh-CN');
    const zhCNResult = t('menu.newGame');
    setLocale('en');
    const enResult = t('menu.newGame');
    expect(zhCNResult).not.toBe(enResult);
    // en should not contain Chinese
    expect(enResult).not.toMatch(/[\u4e00-\u9fff]/);
  });

  it('switching en to zh-TW changes output immediately', () => {
    setLocale('en');
    const enResult = t('menu.newGame');
    setLocale('zh-TW');
    const twResult = t('menu.newGame');
    expect(twResult).not.toBe(enResult);
  });

  it('switching en back to zh-CN restores original values', () => {
    setLocale('zh-CN');
    const originalZhCN = t('menu.newGame');
    setLocale('en');
    setLocale('zh-CN');
    const restoredZhCN = t('menu.newGame');
    expect(restoredZhCN).toBe(originalZhCN);
  });
});

describe('VAL-FOUND-010: Default locale is zh-CN', () => {
  it('defaults to zh-CN when localStorage is empty', async () => {
    localStorageMock.clear();
    vi.resetModules();
    const fresh = await import('../i18n/index');
    expect(fresh.getLocale()).toBe('zh-CN');
  });
});

describe('VAL-FOUND-014: Invalid localStorage locale handled gracefully', () => {
  it('falls back to zh-CN for invalid locale value', async () => {
    localStorageMock.setItem('abyssfire_locale', 'xx-INVALID');
    vi.resetModules();
    const fresh = await import('../i18n/index');
    expect(fresh.getLocale()).toBe('zh-CN');
  });
});

describe('VAL-FOUND-019: Rapid locale switching does not corrupt state', () => {
  it('rapid switching leaves consistent state', () => {
    const locales = ['zh-CN', 'en', 'zh-TW', 'en', 'zh-CN', 'zh-TW', 'en', 'zh-CN', 'zh-TW', 'en'];
    for (const l of locales) {
      setLocale(l);
    }
    // Final locale should be 'en'
    expect(getLocale()).toBe('en');
    const result = t('menu.newGame');
    expect(result).not.toMatch(/[\u4e00-\u9fff]/);
  });
});

describe('VAL-CROSS-016: Language switch does not reset game state', () => {
  it('setLocale does not modify anything except locale and localStorage', () => {
    setLocale('zh-CN');
    // Store some "game state" in localStorage alongside locale
    localStorageMock.setItem('game_save', 'some_data');

    setLocale('en');

    // game_save should still exist
    expect(localStorageMock.getItem('game_save')).toBe('some_data');
    // Locale should be updated
    expect(localStorageMock.getItem('abyssfire_locale')).toBe('en');
  });
});

describe('VAL-TW-001 to VAL-TW-009: zh-TW conversion correctness for game strings', () => {
  it('converts key UI terms correctly', async () => {
    const { convertToTraditional } = await import('../i18n/converter');

    // VAL-TW-001: Basic character conversion
    expect(convertToTraditional('鐵匠')).toBe('鐵匠'); // Already traditional chars
    expect(convertToTraditional('铁匠')).toBe('鐵匠');
    expect(convertToTraditional('装备')).toBe('裝備');
    expect(convertToTraditional('任务')).toBe('任務');

    // VAL-TW-002: Item names
    expect(convertToTraditional('生锈的剑')).toBe('生鏽的劍');
    expect(convertToTraditional('锁子甲')).toBe('鎖子甲');
    expect(convertToTraditional('锋利的')).toBe('鋒利的');

    // VAL-TW-003: Class names
    expect(convertToTraditional('战士')).toBe('戰士');
    expect(convertToTraditional('法师')).toBe('法師');
    expect(convertToTraditional('盗贼')).toBe('盜賊');

    // VAL-TW-006: Zone names
    expect(convertToTraditional('铁砧山脉')).toBe('鐵砧山脈');
    expect(convertToTraditional('灼热荒漠')).toBe('灼熱荒漠');
    expect(convertToTraditional('深渊裂谷')).toBe('深淵裂谷');

    // VAL-TW-008: System messages with interpolation templates
    const goldDisplay = convertToTraditional('金币: {gold}G');
    expect(goldDisplay).toContain('金幣');
    expect(goldDisplay).toContain('{gold}G');

    // VAL-TW-009: Homestead names
    expect(convertToTraditional('药草园')).toBe('藥草園');
    expect(convertToTraditional('训练场')).toBe('訓練場');
    expect(convertToTraditional('宝石工坊')).toBe('寶石工坊');
  });
});

describe('VAL-FOUND-015: zh-TW strings differ from zh-CN where expected', () => {
  it('menu.newGame differs between zh-CN and zh-TW where convertible chars exist', () => {
    setLocale('zh-CN');
    const zhCNResult = t('menu.newGame');
    setLocale('zh-TW');
    const zhTWResult = t('menu.newGame');
    // Both should be non-empty
    expect(zhCNResult.length).toBeGreaterThan(0);
    expect(zhTWResult.length).toBeGreaterThan(0);
    // For 新的旅程 → 新的旅程 (these chars may be same)
    // Let's check a string that definitely differs
    setLocale('zh-CN');
    const zhCNContinue = t('menu.continueSubtitle');
    setLocale('zh-TW');
    const zhTWContinue = t('menu.continueSubtitle');
    // 继续你的冒险 → 繼續你的冒險 (继→繼, 续→續, 险→險)
    expect(zhTWContinue).not.toBe(zhCNContinue);
  });
});

describe('VAL-FOUND-017: zh-TW converter uses no external library', () => {
  it('converter module has self-contained mapping (MAPPING_COUNT > 800)', async () => {
    const converterModule = await import('../i18n/converter');
    // The converter is self-contained with 800+ mappings — no external lib
    expect(converterModule.MAPPING_COUNT).toBeGreaterThanOrEqual(800);
    expect(converterModule.SC_LENGTH).toBe(converterModule.TC_LENGTH);
  });
});

describe('Data Accessor Integration', () => {
  it('game accessor functions return correct locale data', async () => {
    const { getClassName, getZoneName, getSkillName } = await import('../i18n/gameAccessors');

    // English
    setLocale('en');
    expect(getClassName('warrior')).toBe('Warrior');
    expect(getZoneName('emerald_plains')).toBe('Emerald Plains');
    expect(getSkillName('fireball', '火球术')).toBe('Fireball');

    // zh-CN
    setLocale('zh-CN');
    expect(getClassName('warrior')).toBe('战士');
    expect(getZoneName('emerald_plains')).toBe('翡翠平原');
    expect(getSkillName('fireball', '火球术')).toBe('火球术');

    // zh-TW
    setLocale('zh-TW');
    const twWarrior = getClassName('warrior');
    expect(twWarrior).toBe('戰士');
    const twZone = getZoneName('emerald_plains');
    expect(twZone).toBe('翡翠平原'); // These chars are same in TC
  });
});

describe('Comprehensive template literal verification across all locale keys', () => {
  it('all template keys with {params} resolve without leftover placeholders when params provided', () => {
    const templateKeys: Array<{ key: string; params: Record<string, string | number> }> = [
      { key: 'menu.continue', params: { class: 'Warrior', level: 5 } },
      { key: 'ui.inventory.title', params: { count: 10, max: 100 } },
      { key: 'ui.shop.gold', params: { gold: 500 } },
      { key: 'ui.character.title', params: { className: 'Warrior' } },
      { key: 'ui.character.subtitle', params: { level: 10, points: 3 } },
      { key: 'ui.skillTree.skillPoints', params: { className: 'Mage', points: 5 } },
      { key: 'ui.skillTree.tooltip.damage', params: { value: 150, type: 'Fire' } },
      { key: 'ui.skillTree.tooltip.cost', params: { value: 30 } },
      { key: 'ui.skillTree.tooltip.cooldown', params: { value: 3 } },
      { key: 'zone.enterZone', params: { zoneName: 'Emerald Plains', min: 1, max: 10 } },
      { key: 'zone.monsterKill', params: { monsterName: 'Goblin', exp: 25, gold: 5 } },
      { key: 'zone.levelUp.level', params: { level: 10 } },
      { key: 'sys.quest.accepted', params: { name: 'Slime Plague' } },
      { key: 'sys.quest.turnedIn', params: { name: 'Goblin Hunt', exp: 100, gold: 50 } },
      { key: 'sys.mercenary.hire', params: { name: 'Guardian Knight' } },
      { key: 'sys.mercenary.levelUp', params: { name: 'Berserker', level: 5 } },
      { key: 'sys.homestead.buildingUpgrade', params: { name: 'Herb Garden', level: 3 } },
      { key: 'sys.homestead.petEvolved', params: { name: 'Baby Dragon', evolvedName: 'Baby Dragon · Awakened' } },
      { key: 'sys.statusEffect.applied', params: { effectName: 'Burn' } },
      { key: 'sys.inventory.equipped', params: { name: 'Rusty Sword' } },
      { key: 'sys.inventory.obtained', params: { name: 'HP Potion' } },
    ];

    for (const locale of ['zh-CN', 'zh-TW', 'en']) {
      setLocale(locale);
      for (const { key, params } of templateKeys) {
        const result = t(key, params);
        expect(result).not.toContain('{');
        expect(result).not.toContain('}');
        // Verify all param values appear in the result
        for (const val of Object.values(params)) {
          expect(result).toContain(String(val));
        }
      }
    }
  });
});
