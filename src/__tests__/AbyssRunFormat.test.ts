import { describe, it, expect, afterEach } from 'vitest';
import { setLocale } from '../i18n';
import zhCN from '../i18n/locales/zh-CN';
import en from '../i18n/locales/en';
import { BOONS, CURSES, FLOOR_THEMES } from '../data/abyssRun';
import {
  formatBoonStats, boonDescLines, curseDesc, formatRunTime, recommendedLevel, BOON_STAT_PHRASES,
} from '../ui/AbyssRunFormat';

describe('Abyss run text formatting', () => {
  afterEach(() => setLocale('zh-CN'));

  it('builds boon descriptions from the boon stats', () => {
    setLocale('zh-CN');
    expect(boonDescLines('wrath')).toEqual(['+15% 伤害']);
    expect(boonDescLines('haste')).toEqual(['+12% 攻击速度', '+8% 冷却缩减']);
    setLocale('en');
    expect(boonDescLines('bulwark')).toEqual(['+20% defense', '+10% all resistances']);
  });

  it('multiplies values by held stacks', () => {
    setLocale('zh-CN');
    expect(boonDescLines('wrath', 3)).toEqual(['+45% 伤害']);
    expect(formatBoonStats({ lifeSteal: 1.5 }, 3)).toEqual(['+4.5% 生命偷取']);
  });

  it('falls back to the item stat labels for stats without a phrase', () => {
    setLocale('zh-CN');
    expect(formatBoonStats({ str: 5, fireResist: 10 })).toEqual(['+5 力量', '+10% 火焰抗性']);
    expect(formatBoonStats({ damage: 0 })).toEqual([]);
  });

  it('every boon stat has a phrase and every line is fully substituted', () => {
    for (const locale of ['zh-CN', 'en'] as const) {
      setLocale(locale);
      for (const b of BOONS) {
        for (const k of Object.keys(b.stats)) expect(BOON_STAT_PHRASES as readonly string[]).toContain(k);
        const lines = boonDescLines(b.id);
        expect(lines.length).toBeGreaterThan(0);
        for (const l of lines) expect(l).not.toMatch(/[{}]|dungeon\.stat/);
      }
      for (const c of CURSES) expect(curseDesc(c.id)).not.toMatch(/[{}]|dungeon\.curse/);
    }
  });

  it('fills curse numbers from the curse data', () => {
    setLocale('zh-CN');
    expect(curseDesc('frenzy')).toContain('35%');
    expect(curseDesc('frenzy')).toContain('+25%');
    setLocale('en');
    expect(curseDesc('volatile')).toContain('12%');
  });

  it('has names for every boon, curse and floor theme in both locales', () => {
    for (const data of [zhCN, en]) {
      for (const b of BOONS) expect(data[`dungeon.boon.${b.id}.name`]).toBeTruthy();
      for (const c of CURSES) {
        expect(data[`dungeon.curse.${c.id}.name`]).toBeTruthy();
        expect(data[`dungeon.curse.${c.id}.desc`]).toBeTruthy();
      }
      for (const th of FLOOR_THEMES) expect(data[`dungeon.theme.${th.id}`]).toBeTruthy();
    }
  });

  it('formats run time and recommended level', () => {
    expect(formatRunTime(0)).toBe('00:00');
    expect(formatRunTime(201_500)).toBe('03:21');
    expect(formatRunTime(3_725_000)).toBe('1:02:05');
    expect(recommendedLevel(1)).toBe(42);
    expect(recommendedLevel(5)).toBe(50);
  });
});
