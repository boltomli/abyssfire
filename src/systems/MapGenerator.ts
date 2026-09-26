import type { MapData, MapTheme } from '../data/types';

// Tile constants: 0=grass, 1=dirt, 2=stone, 3=water, 4=wall, 5=camp
const TILE_GRASS = 0;
const TILE_DIRT = 1;
const TILE_STONE = 2;
const TILE_WATER = 3;
const TILE_WALL = 4;
const TILE_CAMP = 5;
const TILE_CAMP_WALL = 6;

/** Simple LCG (Linear Congruential Generator) for seeded randomness */
class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed % 2147483647;
    if (this.state <= 0) this.state += 2147483646;
  }

  /** Returns a float in [0, 1) */
  next(): number {
    this.state = (this.state * 16807) % 2147483647;
    return (this.state - 1) / 2147483646;
  }

  /** Returns an integer in [min, max] inclusive */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Returns a boolean with given probability */
  chance(probability: number): boolean {
    return this.next() < probability;
  }
}

/** Theme configuration for map generation */
interface ThemeConfig {
  primaryTile: number;
  secondaryTile: number;
  wallDensity: number;     // 0-1, probability of wall scatter
  waterLakeCount: [number, number]; // [min, max] number of lakes
  waterLakeSize: [number, number]; // [min, max] initial cells per lake seed
  decorTypes: string[];
  decorDensity: number;    // 0-1, probability of decoration at walkable tile
}

const THEME_CONFIGS: Record<MapTheme, ThemeConfig> = {
  plains: {
    primaryTile: TILE_GRASS,
    secondaryTile: TILE_DIRT,
    wallDensity: 0.03,
    waterLakeCount: [2, 4],
    waterLakeSize: [8, 16],
    decorTypes: ['tree', 'bush', 'flower', 'rock'],
    decorDensity: 0.06,
  },
  forest: {
    primaryTile: TILE_GRASS,
    secondaryTile: TILE_DIRT,
    wallDensity: 0.17,
    waterLakeCount: [2, 3],
    waterLakeSize: [6, 12],
    decorTypes: ['tree', 'bush', 'mushroom', 'rock'],
    decorDensity: 0.08,
  },
  mountain: {
    primaryTile: TILE_STONE,
    secondaryTile: TILE_DIRT,
    wallDensity: 0.12,
    waterLakeCount: [1, 3],
    waterLakeSize: [4, 10],
    decorTypes: ['rock', 'boulder', 'bush'],
    decorDensity: 0.05,
  },
  desert: {
    primaryTile: TILE_DIRT,
    secondaryTile: TILE_STONE,
    wallDensity: 0.04,
    waterLakeCount: [2, 4],
    waterLakeSize: [4, 8],
    decorTypes: ['rock', 'cactus', 'bones'],
    decorDensity: 0.04,
  },
  abyss: {
    primaryTile: TILE_STONE,
    secondaryTile: TILE_DIRT,
    wallDensity: 0.10,
    waterLakeCount: [3, 5],
    waterLakeSize: [6, 14],
    decorTypes: ['rock', 'crystal', 'bones', 'mushroom'],
    decorDensity: 0.05,
  },
};

/** Collect all key points from the map anchors */
function getKeyPoints(map: MapData): { col: number; row: number }[] {
  const points: { col: number; row: number }[] = [];
  points.push(map.playerStart);
  for (const camp of map.camps) {
    points.push({ col: camp.col, row: camp.row });
  }
  for (const spawn of map.spawns) {
    points.push({ col: spawn.col, row: spawn.row });
  }
  for (const exit of map.exits) {
    points.push({ col: exit.col, row: exit.row });
  }
  return points;
}

/** Create a 2D array filled with a value */
function create2D<T>(cols: number, rows: number, value: T): T[][] {
  const arr: T[][] = [];
  for (let r = 0; r < rows; r++) {
    arr.push(new Array(cols).fill(value));
  }
  return arr;
}

/** Bresenham-style drunk walk between two points, carving a path */
function drunkWalk(
  tiles: number[][],
  fromCol: number, fromRow: number,
  toCol: number, toRow: number,
  pathTile: number,
  rng: SeededRandom,
  cols: number, rows: number,
): void {
  let col = fromCol;
  let row = fromRow;
  const maxSteps = (cols + rows) * 3;
  let steps = 0;

  while ((col !== toCol || row !== toRow) && steps < maxSteps) {
    steps++;
    // Set current position to path tile (but not if it's a camp or border wall)
    if (col > 0 && col < cols - 1 && row > 0 && row < rows - 1) {
      if (!isCampTile(tiles[row][col])) {
        tiles[row][col] = pathTile;
      }
      // Widen the path slightly
      if (rng.chance(0.5)) {
        const adjacentCol = col + rng.nextInt(-1, 1);
        const adjacentRow = row + rng.nextInt(-1, 1);
        if (adjacentCol > 0 && adjacentCol < cols - 1 && adjacentRow > 0 && adjacentRow < rows - 1) {
          if (!isCampTile(tiles[adjacentRow][adjacentCol])) {
            tiles[adjacentRow][adjacentCol] = pathTile;
          }
        }
      }
    }

    // Move toward target with some randomness (drunk walk)
    const dx = toCol - col;
    const dy = toRow - row;

    if (rng.chance(0.7)) {
      // Move toward target
      if (Math.abs(dx) > Math.abs(dy)) {
        col += dx > 0 ? 1 : -1;
      } else {
        row += dy > 0 ? 1 : -1;
      }
    } else {
      // Random step
      const dir = rng.nextInt(0, 3);
      if (dir === 0 && col < cols - 2) col++;
      else if (dir === 1 && col > 1) col--;
      else if (dir === 2 && row < rows - 2) row++;
      else if (dir === 3 && row > 1) row--;
    }
  }

  // Ensure final position is set
  if (toCol > 0 && toCol < cols - 1 && toRow > 0 && toRow < rows - 1) {
    if (!isCampTile(tiles[toRow][toCol])) {
      tiles[toRow][toCol] = pathTile;
    }
  }
}

/** Clear area around a point to ensure walkability */
function clearArea(
  tiles: number[][],
  centerCol: number, centerRow: number,
  radius: number,
  fillTile: number,
  cols: number, rows: number,
  skipCamp = false,
): void {
  for (let dr = -radius; dr <= radius; dr++) {
    for (let dc = -radius; dc <= radius; dc++) {
      const r = centerRow + dr;
      const c = centerCol + dc;
      if (r > 0 && r < rows - 1 && c > 0 && c < cols - 1) {
        if (skipCamp && isCampTile(tiles[r][c])) continue;
        tiles[r][c] = fillTile;
      }
    }
  }
}

/** Returns true if tile is any camp tile (ground or wall) */
function isCampTile(tile: number): boolean {
  return tile === TILE_CAMP || tile === TILE_CAMP_WALL;
}

/** Run cellular automata to create organic shapes (used for water bodies) */
function cellularAutomata(
  grid: boolean[][],
  iterations: number,
  cols: number,
  rows: number,
  birthThreshold: number,
  deathThreshold: number,
): boolean[][] {
  let current = grid.map(row => [...row]);

  for (let iter = 0; iter < iterations; iter++) {
    const next = current.map(row => [...row]);
    for (let r = 1; r < rows - 1; r++) {
      for (let c = 1; c < cols - 1; c++) {
        let neighbors = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            if (current[r + dr][c + dc]) neighbors++;
          }
        }
        if (current[r][c]) {
          next[r][c] = neighbors >= deathThreshold;
        } else {
          next[r][c] = neighbors >= birthThreshold;
        }
      }
    }
    current = next;
  }
  return current;
}

/** Weighted decoration pools per theme: `grove` fills dense clusters, `open` dots the rest. */
const DECOR_POOLS: Record<MapTheme, { grove: [string, number][]; open: [string, number][]; tall: string[] }> = {
  plains: {
    grove: [['tree', 5], ['tree_round', 3], ['bush', 3], ['grass', 2]],
    open: [['grass', 6], ['flower', 4], ['rock', 1.5], ['bush', 1], ['mushroom_red', 0.6], ['boulder', 0.5], ['tree_round', 0.5]],
    tall: ['tree', 'tree_round', 'boulder'],
  },
  forest: {
    grove: [['tree_forest', 5], ['tree_forest_tall', 3], ['fern', 3], ['mushroom', 2]],
    open: [['grass_forest', 5], ['fern', 2], ['rock_moss', 2], ['mushroom', 1], ['crystal_blue', 0.3], ['tree_forest_tall', 0.6]],
    tall: ['tree_forest', 'tree_forest_tall', 'crystal_blue'],
  },
  mountain: {
    grove: [['pine', 5], ['boulder_snow', 1], ['rock_slate', 1]],
    open: [['rock_slate', 4], ['boulder_snow', 1.5], ['grass_dry', 3], ['dry_shrub', 1.5], ['dead_tree', 0.5], ['pine', 0.6]],
    tall: ['pine', 'boulder_snow', 'dead_tree'],
  },
  desert: {
    grove: [['cactus', 1.6], ['cactus_barrel', 3], ['dry_shrub', 2.5], ['rock_sand', 2], ['boulder_sand', 0.6]],
    open: [['rock_sand', 3], ['boulder_sand', 1], ['bones', 1.5], ['grass_dry', 2], ['cactus_barrel', 1], ['dead_tree', 0.4]],
    tall: ['cactus', 'boulder_sand', 'dead_tree'],
  },
  abyss: {
    grove: [['charred_tree', 4], ['crystal', 3], ['boulder_basalt', 1], ['rock_basalt', 1]],
    open: [['rock_basalt', 4], ['bones', 2], ['grass_ash', 3], ['mushroom', 1], ['crystal', 0.5]],
    tall: ['charred_tree', 'crystal', 'boulder_basalt'],
  },
};

function pickWeighted(pool: [string, number][], r: number): string {
  const total = pool.reduce((t, [, w]) => t + w, 0);
  let x = r * total;
  for (const [type, w] of pool) {
    x -= w;
    if (x <= 0) return type;
  }
  return pool[pool.length - 1][0];
}

/** Smooth value noise in [0,1] for grove clustering (independent of the tile RNG). */
function groveNoise(c: number, r: number, seed: number, scale: number): number {
  const h = (x: number, y: number) => {
    let n = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const x = c / scale;
  const y = r / scale;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = h(x0, y0) + (h(x0 + 1, y0) - h(x0, y0)) * sx;
  const b = h(x0, y0 + 1) + (h(x0 + 1, y0 + 1) - h(x0, y0 + 1)) * sx;
  return a + (b - a) * sy;
}

function scatterDecorations(
  map: MapData,
  theme: MapTheme,
  tiles: number[][],
  collisions: boolean[][],
  rng: SeededRandom,
  config: ThemeConfig,
): { col: number; row: number; type: string }[] {
  const { cols, rows } = map;
  const pool = DECOR_POOLS[theme] ?? { grove: config.decorTypes.map(t => [t, 1] as [string, number]), open: config.decorTypes.map(t => [t, 1] as [string, number]), tall: [] };
  const tallSet = new Set(pool.tall);
  const seed = map.seed ?? 42;

  // Keep-out zones for everything: exits, camps, player start, NPCs, entrances.
  const blocked = create2D(cols, rows, false);
  // Wider keep-out for tall props (they hide combat): start / camps / exits.
  const noTall = create2D(cols, rows, false);
  const block = (grid: boolean[][], col: number, row: number, rad: number) => {
    for (let r = row - rad; r <= row + rad; r++) {
      for (let c = col - rad; c <= col + rad; c++) {
        if (r >= 0 && r < rows && c >= 0 && c < cols) grid[r][c] = true;
      }
    }
  };
  for (const exit of map.exits) { block(blocked, exit.col, exit.row, 3); block(noTall, exit.col, exit.row, 5); }
  for (const camp of map.camps) { block(blocked, camp.col, camp.row, 6); block(noTall, camp.col, camp.row, 9); }
  block(blocked, map.playerStart.col, map.playerStart.row, 2);
  block(noTall, map.playerStart.col, map.playerStart.row, 5);
  for (const npc of map.fieldNpcs ?? []) { block(blocked, npc.col, npc.row, 1); block(noTall, npc.col, npc.row, 2); }
  for (const e of map.subDungeonEntrances ?? []) { block(blocked, e.col, e.row, 2); block(noTall, e.col, e.row, 3); }
  for (const d of map.storyDecorations ?? []) block(noTall, d.col, d.row, 2);
  for (const sp of map.spawns) block(noTall, sp.col, sp.row, 2);

  const dirtIsGround = config.primaryTile === TILE_DIRT;
  // Chebyshev distance (capped) to the nearest path tile and nearest obstacle.
  const distTo = (isSource: (r: number, c: number) => boolean, cap: number): number[][] => {
    const d = create2D(cols, rows, cap);
    let frontier: [number, number][] = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (isSource(r, c)) { d[r][c] = 0; frontier.push([r, c]); }
    for (let k = 1; k < cap && frontier.length; k++) {
      const next: [number, number][] = [];
      for (const [r, c] of frontier) {
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr, cc = c + dc;
          if (rr < 0 || rr >= rows || cc < 0 || cc >= cols || d[rr][cc] <= k) continue;
          d[rr][cc] = k;
          next.push([rr, cc]);
        }
      }
      frontier = next;
    }
    return d;
  };
  // Paths are carved as connected dirt runs; the secondary-tile scatter leaves
  // isolated dirt specks, which should not push trees away.
  const isPath = (r: number, c: number): boolean => {
    if (tiles[r][c] !== TILE_DIRT) return false;
    let n = 0;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if ((dr || dc) && tiles[r + dr]?.[c + dc] === TILE_DIRT) n++;
    }
    return n >= 2;
  };
  const pathDist = dirtIsGround ? create2D(cols, rows, 9) : distTo(isPath, 3);
  const obstacleDist = distTo((r, c) => tiles[r][c] === TILE_WALL || tiles[r][c] === TILE_WATER, 3);
  // Groves hug the map rim and obstacles; open ground stays clear for combat.
  const forest = theme === 'forest';
  const openTallRate = forest ? 0.04 : 0.1;
  const groveTallRate = forest ? 0.22 : 0.45;
  const rimTallRate = forest ? 0.5 : 0.8;
  const hugTallRate = forest ? 0.2 : 0.3;

  const tallAt = create2D(cols, rows, false);
  const groundPool = (list: [string, number][]) => list.filter(([t]) => !tallSet.has(t));
  // Rejected tall spots become low ground cover (not more waist-high bushes).
  const LOW = /grass|flower|rock|bones|mushroom|fern/;
  const lowCover = groundPool(pool.open).filter(([t]) => LOW.test(t) && !t.startsWith('boulder'));
  const decorations: { col: number; row: number; type: string }[] = [];
  for (let r = 2; r < rows - 2; r++) {
    for (let c = 2; c < cols - 2; c++) {
      // Dirt marks paths — except in the desert, where sand (dirt) is the ground itself.
      if (!collisions[r][c] || isCampTile(tiles[r][c]) || (tiles[r][c] === TILE_DIRT && !dirtIsGround) || blocked[r][c]) continue;
      const n = groveNoise(c, r, seed, 9);
      const inGrove = n > 0.6;
      const density = inGrove ? config.decorDensity * 3.2 : config.decorDensity * 1.3;
      if (!rng.chance(density)) continue;
      let type = pickWeighted(inGrove ? pool.grove : pool.open, rng.next());
      if (tallSet.has(type)) {
        const rim = Math.min(c, r, cols - 1 - c, rows - 1 - r) <= 6;
        const hugsObstacle = obstacleDist[r][c] <= 1;
        const rate = rim ? rimTallRate : hugsObstacle ? hugTallRate : inGrove ? groveTallRate : openTallRate;
        let ok = !noTall[r][c] && pathDist[r][c] > 2 && rng.chance(rate);
        // Canopies must not pile up: no neighbour, and nothing stacked straight
        // above/below on screen (iso dr == dc) within 2 tiles.
        for (let dr = -2; dr <= 2 && ok; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const near = Math.abs(dr) <= 1 && Math.abs(dc) <= 1;
            const stacked = dr === dc || Math.abs(dr - dc) === 1;
            if ((near || stacked) && tallAt[r + dr]?.[c + dc]) { ok = false; break; }
          }
        }
        if (ok) tallAt[r][c] = true;
        else type = pickWeighted(lowCover.length ? lowCover : pool.open, rng.next());
      }
      decorations.push({ col: c, row: r, type });
    }
  }
  return decorations;
}

export class MapGenerator {
  /**
   * Generate tiles, collisions, and decorations for a MapData
   * that has anchors (camps, spawns, exits, playerStart) but empty tiles/collisions.
   * The map must have theme and seed set.
   */
  static generate(map: MapData): MapData {
    const theme = map.theme ?? 'plains';
    const seed = map.seed ?? 42;
    const rng = new SeededRandom(seed);
    const { cols, rows } = map;
    const config = THEME_CONFIGS[theme];

    // (a) Initialize grid with primary tile
    const tiles = create2D(cols, rows, config.primaryTile);

    // (b) Place walls on all borders
    for (let c = 0; c < cols; c++) {
      tiles[0][c] = TILE_WALL;
      tiles[rows - 1][c] = TILE_WALL;
    }
    for (let r = 0; r < rows; r++) {
      tiles[r][0] = TILE_WALL;
      tiles[r][cols - 1] = TILE_WALL;
    }

    // Scatter secondary tile for variety
    for (let r = 1; r < rows - 1; r++) {
      for (let c = 1; c < cols - 1; c++) {
        if (rng.chance(0.08)) {
          tiles[r][c] = config.secondaryTile;
        }
      }
    }

    // (f-i) Theme-specific wall/obstacle scattering
    for (let r = 2; r < rows - 2; r++) {
      for (let c = 2; c < cols - 2; c++) {
        if (rng.chance(config.wallDensity)) {
          tiles[r][c] = TILE_WALL;
        }
      }
    }

    // For mountain theme: add stone clusters and wall ridges
    if (theme === 'mountain') {
      const ridgeCount = rng.nextInt(3, 6);
      for (let i = 0; i < ridgeCount; i++) {
        let rc = rng.nextInt(5, cols - 6);
        let rr = rng.nextInt(5, rows - 6);
        const length = rng.nextInt(6, 15);
        const dirCol = rng.chance(0.5) ? 1 : 0;
        const dirRow = dirCol === 1 ? 0 : 1;
        for (let s = 0; s < length; s++) {
          if (rc > 1 && rc < cols - 2 && rr > 1 && rr < rows - 2) {
            tiles[rr][rc] = TILE_WALL;
            // Add some width
            if (rng.chance(0.4)) {
              const offR = rr + (dirCol === 1 ? rng.nextInt(-1, 1) : 0);
              const offC = rc + (dirRow === 1 ? rng.nextInt(-1, 1) : 0);
              if (offR > 1 && offR < rows - 2 && offC > 1 && offC < cols - 2) {
                tiles[offR][offC] = TILE_WALL;
              }
            }
          }
          rc += dirCol + (rng.chance(0.3) ? rng.nextInt(-1, 1) : 0);
          rr += dirRow + (rng.chance(0.3) ? rng.nextInt(-1, 1) : 0);
        }
      }
    }

    // (e) Generate water bodies using cellular automata
    const lakeCount = rng.nextInt(config.waterLakeCount[0], config.waterLakeCount[1]);
    const waterGrid = create2D(cols, rows, false);

    // Seed water cells for each lake
    for (let lake = 0; lake < lakeCount; lake++) {
      const lakeCol = rng.nextInt(8, cols - 9);
      const lakeRow = rng.nextInt(8, rows - 9);
      const lakeSize = rng.nextInt(config.waterLakeSize[0], config.waterLakeSize[1]);

      for (let i = 0; i < lakeSize; i++) {
        const wc = lakeCol + rng.nextInt(-3, 3);
        const wr = lakeRow + rng.nextInt(-3, 3);
        if (wc > 2 && wc < cols - 3 && wr > 2 && wr < rows - 3) {
          waterGrid[wr][wc] = true;
        }
      }
    }

    // Run cellular automata to make water organic
    const refinedWater = cellularAutomata(waterGrid, 4, cols, rows, 5, 3);

    // Apply water to tiles
    for (let r = 2; r < rows - 2; r++) {
      for (let c = 2; c < cols - 2; c++) {
        if (refinedWater[r][c]) {
          tiles[r][c] = TILE_WATER;
        }
      }
    }

    // (c) Place camp tiles at camp positions (11x11 encampment with palisade walls)
    for (const camp of map.camps) {
      const halfSize = 5; // half of 11
      // Clear a 13x13 walkable area around camp center first
      clearArea(tiles, camp.col, camp.row, halfSize + 1, config.primaryTile, cols, rows);
      // Place 11x11 camp ground tiles
      for (let dr = -halfSize; dr <= halfSize; dr++) {
        for (let dc = -halfSize; dc <= halfSize; dc++) {
          const r = camp.row + dr;
          const c = camp.col + dc;
          if (r > 0 && r < rows - 1 && c > 0 && c < cols - 1) {
            tiles[r][c] = TILE_CAMP;
          }
        }
      }
      // Place palisade walls: top row (with 2-tile gate gap at dc=-1 and dc=0)
      for (let dc = -halfSize; dc <= halfSize; dc++) {
        if (dc === -1 || dc === 0) continue; // gate opening
        const r = camp.row - halfSize;
        const c = camp.col + dc;
        if (r > 0 && r < rows - 1 && c > 0 && c < cols - 1) {
          tiles[r][c] = TILE_CAMP_WALL;
        }
      }
      // Place palisade walls: left column from top row down, leaving bottom 2 rows open for entrance
      for (let dr = -halfSize; dr < halfSize - 1; dr++) {
        const r = camp.row + dr;
        const c = camp.col - halfSize;
        if (r > 0 && r < rows - 1 && c > 0 && c < cols - 1) {
          tiles[r][c] = TILE_CAMP_WALL;
        }
      }
      // Place palisade walls: right column from top row down, leaving bottom 2 rows open for entrance
      for (let dr = -halfSize; dr < halfSize - 1; dr++) {
        const r = camp.row + dr;
        const c = camp.col + halfSize;
        if (r > 0 && r < rows - 1 && c > 0 && c < cols - 1) {
          tiles[r][c] = TILE_CAMP_WALL;
        }
      }
    }

    // Clear areas around spawns, exits, and playerStart (skip camp tiles)
    for (const spawn of map.spawns) {
      clearArea(tiles, spawn.col, spawn.row, 2, config.primaryTile, cols, rows, true);
    }
    for (const exit of map.exits) {
      clearArea(tiles, exit.col, exit.row, 1, config.primaryTile, cols, rows, true);
    }
    clearArea(tiles, map.playerStart.col, map.playerStart.row, 2, config.primaryTile, cols, rows, true);

    // Clear areas around field NPC positions to ensure walkability
    if (map.fieldNpcs) {
      for (const npc of map.fieldNpcs) {
        clearArea(tiles, npc.col, npc.row, 1, config.primaryTile, cols, rows, true);
      }
    }

    // Clear areas around sub-dungeon entrance positions to ensure walkability
    if (map.subDungeonEntrances) {
      for (const entrance of map.subDungeonEntrances) {
        clearArea(tiles, entrance.col, entrance.row, 1, config.primaryTile, cols, rows, true);
      }
    }

    // (d) Generate paths connecting key points using drunk walk
    const keyPoints = getKeyPoints(map);
    const pathTile = TILE_DIRT;

    // Connect playerStart to first camp
    if (map.camps.length > 0) {
      drunkWalk(tiles, map.playerStart.col, map.playerStart.row,
        map.camps[0].col, map.camps[0].row, pathTile, rng, cols, rows);
    }

    // Connect camps to each other
    for (let i = 0; i < map.camps.length - 1; i++) {
      drunkWalk(tiles, map.camps[i].col, map.camps[i].row,
        map.camps[i + 1].col, map.camps[i + 1].row, pathTile, rng, cols, rows);
    }

    // Connect last camp to exits
    const lastCamp = map.camps[map.camps.length - 1];
    if (lastCamp) {
      for (const exit of map.exits) {
        drunkWalk(tiles, lastCamp.col, lastCamp.row,
          exit.col, exit.row, pathTile, rng, cols, rows);
      }
    }

    // Connect playerStart to exits
    for (const exit of map.exits) {
      drunkWalk(tiles, map.playerStart.col, map.playerStart.row,
        exit.col, exit.row, pathTile, rng, cols, rows);
    }

    // Connect spawn areas to nearest camp or playerStart
    for (const spawn of map.spawns) {
      // Find nearest key anchor
      let nearest = map.playerStart;
      let bestDist = Math.abs(spawn.col - nearest.col) + Math.abs(spawn.row - nearest.row);
      for (const camp of map.camps) {
        const d = Math.abs(spawn.col - camp.col) + Math.abs(spawn.row - camp.row);
        if (d < bestDist) {
          bestDist = d;
          nearest = camp;
        }
      }
      drunkWalk(tiles, spawn.col, spawn.row, nearest.col, nearest.row, pathTile, rng, cols, rows);
    }

    // Ensure border walls are intact after path carving
    for (let c = 0; c < cols; c++) {
      tiles[0][c] = TILE_WALL;
      tiles[rows - 1][c] = TILE_WALL;
    }
    for (let r = 0; r < rows; r++) {
      tiles[r][0] = TILE_WALL;
      tiles[r][cols - 1] = TILE_WALL;
    }

    // Re-ensure exits on border are walkable (set adjacent inner tile)
    for (const exit of map.exits) {
      // If exit is on border, make sure the tile next to it (inward) is walkable
      if (exit.col === 0 || exit.col === cols - 1 || exit.row === 0 || exit.row === rows - 1) {
        const innerCol = exit.col === 0 ? 1 : exit.col === cols - 1 ? cols - 2 : exit.col;
        const innerRow = exit.row === 0 ? 1 : exit.row === rows - 1 ? rows - 2 : exit.row;
        tiles[innerRow][innerCol] = pathTile;
        // Also clear a small area around the inner point
        clearArea(tiles, innerCol, innerRow, 1, config.primaryTile, cols, rows);
      }
    }

    // (j) Generate collisions array
    const collisions = create2D(cols, rows, true);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const tile = tiles[r][c];
        collisions[r][c] = tile !== TILE_WALL && tile !== TILE_WATER && tile !== TILE_CAMP_WALL;
      }
    }

    // (k) Place decorations — clustered groves + open-ground cover
    const decorations = scatterDecorations(map, theme, tiles, collisions, rng, config);

    return {
      ...map,
      tiles,
      collisions,
      decorations,
    };
  }
}
