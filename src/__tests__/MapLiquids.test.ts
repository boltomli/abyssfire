import { describe, expect, it } from 'vitest';
import { AllMaps } from '../data/maps';
import { LoreByZone } from '../data/loreCollectibles';
import { MiniBossSpawns } from '../data/miniBosses';

const TILE_WATER = 3;

/** Walkable tiles reachable from the player start (4-connected). */
function reachable(collisions: boolean[][], start: { col: number; row: number }): boolean[][] {
  const seen = collisions.map(r => r.map(() => false));
  const stack: [number, number][] = [[start.col, start.row]];
  seen[start.row][start.col] = true;
  while (stack.length) {
    const [c, r] = stack.pop()!;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc, nr = r + dr;
      if (collisions[nr]?.[nc] && !seen[nr][nc]) { seen[nr][nc] = true; stack.push([nc, nr]); }
    }
  }
  return seen;
}

describe('generated water / lava', () => {
  for (const [id, map] of Object.entries(AllMaps)) {
    it(`${id} has liquid pools that block movement`, () => {
      let liquid = 0;
      map.tiles.forEach((row, r) => row.forEach((t, c) => {
        if (t === TILE_WATER) { liquid++; expect(map.collisions[r][c]).toBe(false); }
      }));
      expect(liquid).toBeGreaterThan(40);
    });

    it(`${id} keeps every point of interest reachable`, () => {
      const seen = reachable(map.collisions, map.playerStart);
      const pois = [
        ...map.camps, ...map.spawns, ...(map.fieldNpcs ?? []), ...(map.subDungeonEntrances ?? []),
        ...(map.storyDecorations ?? []), ...(LoreByZone[id] ?? []),
        ...(MiniBossSpawns[id] ? [MiniBossSpawns[id]] : []),
      ];
      for (const p of pois) expect(seen[p.row][p.col], `${id} (${p.col},${p.row})`).toBe(true);
    });
  }
});
