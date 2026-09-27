import { describe, expect, it } from 'vitest';
import { AVG_DAMAGE, compareTarget, statDeltas } from '../systems/ItemCompare';
import { getItemBase } from '../data/items/bases';
import type { ItemInstance } from '../data/types';

const weaponId = 'w_rusty_sword';
const ringId = 'j_copper_ring';

function item(baseId: string, uid: string, affixes: [string, number][] = [], extra: Partial<ItemInstance> = {}): ItemInstance {
  return {
    uid, baseId, name: uid, quality: affixes.length ? 'magic' : 'normal', level: 5,
    affixes: affixes.map(([stat, value]) => ({ affixId: stat, name: stat, stat, value })),
    sockets: [], identified: true, quantity: 1, stats: {}, ...extra,
  };
}

describe('item comparison', () => {
  it('uses real bases', () => {
    expect(getItemBase(weaponId)?.slot).toBe('weapon');
    expect(getItemBase(ringId)?.slot).toBe('ring1');
  });

  it('compares a bag item with what is worn in its slot, and nothing for worn items', () => {
    const worn = item(weaponId, 'a', [['str', 3]]);
    const bag = item(weaponId, 'b', [['str', 5], ['critRate', 4]]);
    const eq = { weapon: worn };
    expect(compareTarget(bag, eq)).toEqual({ slot: 'weapon', equipped: worn });
    expect(compareTarget(worn, eq)).toBeNull();
    expect(statDeltas(bag, worn)).toEqual([{ stat: 'critRate', delta: 4 }, { stat: 'str', delta: 2 }]);
  });

  it('shows losses as negatives and skips unchanged stats', () => {
    const worn = item(weaponId, 'a', [['str', 5], ['dex', 2]]);
    const bag = item(weaponId, 'b', [['str', 2], ['dex', 2]]);
    expect(statDeltas(bag, worn)).toEqual([{ stat: 'str', delta: -3 }]);
  });

  it('against an empty slot every stat is a gain, base damage first', () => {
    const d = statDeltas(item(weaponId, 'b', [['str', 1]]));
    expect(d[0].stat).toBe(AVG_DAMAGE);
    expect(d.every(x => x.delta > 0)).toBe(true);
  });

  it('a new ring fills a free ring slot, else replaces the weaker ring', () => {
    const strong = item(ringId, 'r1', [['str', 9]]);
    const weak = item(ringId, 'r2', [['str', 1]]);
    expect(compareTarget(item(ringId, 'n'), { ring1: strong })).toEqual({ slot: 'ring2' });
    expect(compareTarget(item(ringId, 'n'), { ring1: strong, ring2: weak })).toEqual({ slot: 'ring2', equipped: weak });
  });

  it('unidentified affixes are not counted', () => {
    const worn = item(weaponId, 'a');
    const bag = item(weaponId, 'b', [['str', 9]], { identified: false });
    expect(statDeltas(bag, worn)).toEqual([]);
  });
});
