import { describe, expect, it } from 'vitest';
import { StoryProgress } from '../systems/StoryProgress';

describe('StoryProgress', () => {
  it('remembers seen beats and round-trips through the save', () => {
    const a = new StoryProgress();
    expect(a.has('prologue')).toBe(false);
    a.mark('prologue');
    a.mark('chapter_emerald_plains');
    const b = new StoryProgress();
    b.load(a.toSave());
    expect(b.has('prologue')).toBe(true);
    expect(b.has('chapter_emerald_plains')).toBe(true);
    expect(b.has('cs_ep_mark')).toBe(false);
  });

  it('treats a missing list as nothing seen', () => {
    const p = new StoryProgress();
    p.mark('x');
    p.load(undefined);
    expect(p.toSave()).toEqual([]);
  });
});
