import { describe, expect, it } from 'vitest';
import { computeDeathPenalty, SoulEchoState, SOUL_ECHO_MIN_LEVEL } from '../systems/SoulEcho';

describe('death penalty', () => {
  it('spares new heroes', () => {
    expect(computeDeathPenalty({ level: SOUL_ECHO_MIN_LEVEL - 1, gold: 1000, exp: 50, expToNext: 100, difficulty: 'hell' })).toEqual({ gold: 0, exp: 0 });
  });

  it('takes a share of gold, and exp only on nightmare and hell', () => {
    expect(computeDeathPenalty({ level: 10, gold: 1000, exp: 200, expToNext: 550, difficulty: 'normal' })).toEqual({ gold: 100, exp: 0 });
    expect(computeDeathPenalty({ level: 10, gold: 1000, exp: 200, expToNext: 550, difficulty: 'nightmare' })).toEqual({ gold: 150, exp: 27 });
    expect(computeDeathPenalty({ level: 10, gold: 1000, exp: 200, expToNext: 550, difficulty: 'hell' })).toEqual({ gold: 200, exp: 27 });
  });

  it('never takes more exp than the current level holds', () => {
    expect(computeDeathPenalty({ level: 10, gold: 0, exp: 3, expToNext: 550, difficulty: 'hell' }).exp).toBe(3);
  });
});

describe('soul echo', () => {
  it('is reclaimed only in its zone and within reach', () => {
    const s = new SoulEchoState();
    s.leave({ mapId: 'emerald_plains', col: 40, row: 40, gold: 100, exp: 0 });
    expect(s.tryClaim('twilight_forest', 40, 40)).toBeNull();
    expect(s.tryClaim('emerald_plains', 44, 40)).toBeNull();
    expect(s.tryClaim('emerald_plains', 41, 40)?.gold).toBe(100);
    expect(s.echo).toBeNull();
  });

  it('dying again lets the old echo fade', () => {
    const s = new SoulEchoState();
    s.leave({ mapId: 'a', col: 1, row: 1, gold: 100, exp: 0 });
    const lost = s.leave({ mapId: 'b', col: 2, row: 2, gold: 90, exp: 0 });
    expect(lost?.gold).toBe(100);
    expect(s.echo?.mapId).toBe('b');
  });

  it('a free death leaves nothing behind', () => {
    const s = new SoulEchoState();
    s.leave({ mapId: 'a', col: 1, row: 1, gold: 0, exp: 0 });
    expect(s.echo).toBeNull();
  });

  it('round-trips through the save and ignores junk', () => {
    const s = new SoulEchoState();
    s.leave({ mapId: 'a', col: 1, row: 2, gold: 5, exp: 1 });
    const t = new SoulEchoState();
    t.load(s.toSave());
    expect(t.echo).toEqual({ mapId: 'a', col: 1, row: 2, gold: 5, exp: 1 });
    t.load(undefined);
    expect(t.echo).toBeNull();
  });
});
