// src/graphics/sprites/types.ts
import type { DrawUtils } from '../DrawUtils';

export type MonsterAction = 'idle' | 'walk' | 'attack' | 'hurt' | 'death';
export type PlayerAction = MonsterAction | 'dodge' | 'cast';
export type NPCAction = 'working' | 'alert' | 'idle' | 'talking';
export type EntityAction = MonsterAction | PlayerAction | NPCAction;

/**
 * Canonical player-sheet layout. Keep generation and Phaser registration
 * driven by this table so adding poses cannot silently shift later actions.
 */
export const PLAYER_ACTION_ORDER = [
  'idle',
  'walk',
  'attack',
  'hurt',
  'dodge',
  'death',
  'cast',
] as const satisfies readonly PlayerAction[];

export const PLAYER_ACTION_FRAME_COUNTS: Readonly<Record<PlayerAction, number>> = {
  idle: 6,
  walk: 8,
  attack: 8,
  hurt: 4,
  dodge: 6,
  death: 6,
  cast: 8,
};

export const PLAYER_TOTAL_FRAMES = PLAYER_ACTION_ORDER.reduce(
  (total, action) => total + PLAYER_ACTION_FRAME_COUNTS[action],
  0,
);

export function getPlayerActionFrameRange(action: PlayerAction): {
  start: number;
  end: number;
} {
  let start = 0;
  for (const candidate of PLAYER_ACTION_ORDER) {
    const end = start + PLAYER_ACTION_FRAME_COUNTS[candidate] - 1;
    if (candidate === action) return { start, end };
    start = end + 1;
  }
  return { start: 0, end: 0 };
}

/**
 * Isometric 3/4 views a player sheet carries. Sheets are authored facing
 * right: `se` (front 3/4, walking toward screen right-down) and `ne` (back
 * 3/4, walking toward screen right-up); sw / nw are the same frames flipped.
 */
export type PlayerView = 'se' | 'ne';
export const PLAYER_VIEWS: readonly PlayerView[] = ['se', 'ne'];
export const DEFAULT_PLAYER_VIEW: PlayerView = 'se';

/** Frames in a full player sheet: every action, once per view (view-major). */
export const PLAYER_SHEET_FRAMES = PLAYER_TOTAL_FRAMES * PLAYER_VIEWS.length;

/** Sheet frame range of an action in one view. */
export function getPlayerViewFrameRange(view: PlayerView, action: PlayerAction): {
  start: number;
  end: number;
} {
  const base = Math.max(0, PLAYER_VIEWS.indexOf(view)) * PLAYER_TOTAL_FRAMES;
  const range = getPlayerActionFrameRange(action);
  return { start: base + range.start, end: base + range.end };
}

/**
 * Animation key for a player action in a view. The default (se) view keeps
 * the plain `<key>_<action>` name so menus, portraits and anything else that
 * plays `<key>_idle` keep working.
 */
export function playerAnimKey(key: string, view: PlayerView, action: string): string {
  return view === DEFAULT_PLAYER_VIEW ? `${key}_${action}` : `${key}_${view}_${action}`;
}

export interface EntityDrawer {
  readonly key: string;
  readonly frameW: number;       // before TEXTURE_SCALE
  readonly frameH: number;       // before TEXTURE_SCALE
  readonly totalFrames: number;
  /**
   * True when the drawer already applies the ink outline itself (rigged
   * characters). Otherwise the sheet generator runs the shared ink pass.
   */
  readonly inked?: boolean;
  /**
   * Views this drawer can paint (player heroes). When set, the sheet holds
   * every action once per view and `drawFrame` receives the view.
   */
  readonly views?: readonly PlayerView[];

  drawFrame(
    ctx: CanvasRenderingContext2D,
    frame: number,               // 0-based index within the current action
    action: EntityAction,
    w: number,                   // scaled frame width
    h: number,                   // scaled frame height
    utils: DrawUtils,
    view?: PlayerView,
  ): void;
}

/** Map of texture key → {frameWidth, frameHeight} for BootScene spritesheet loading */
export type FrameSizeRegistry = Record<string, { frameWidth: number; frameHeight: number }>;

/** Build frame-size registry from the existing configs. Used by BootScene for spritesheet loading. */
export function buildFrameSizeRegistry(): FrameSizeRegistry {
  return {
    // Players (96x96, PLAYER_TOTAL_FRAMES frames; wide for weapon reach)
    player_warrior: { frameWidth: 96, frameHeight: 96 },
    player_mage: { frameWidth: 96, frameHeight: 96 },
    player_rogue: { frameWidth: 96, frameHeight: 96 },
    // Monsters (various sizes, 20 frames)
    monster_slime: { frameWidth: 72, frameHeight: 40 },
    monster_goblin: { frameWidth: 72, frameHeight: 56 },
    monster_goblin_chief: { frameWidth: 84, frameHeight: 68 },
    monster_skeleton: { frameWidth: 76, frameHeight: 64 },
    monster_zombie: { frameWidth: 68, frameHeight: 60 },
    monster_werewolf: { frameWidth: 88, frameHeight: 64 },
    monster_werewolf_alpha: { frameWidth: 96, frameHeight: 68 },
    monster_gargoyle: { frameWidth: 84, frameHeight: 60 },
    monster_stone_golem: { frameWidth: 84, frameHeight: 68 },
    monster_mountain_troll: { frameWidth: 96, frameHeight: 72 },
    monster_fire_elemental: { frameWidth: 60, frameHeight: 60 },
    monster_desert_scorpion: { frameWidth: 72, frameHeight: 44 },
    monster_sandworm: { frameWidth: 72, frameHeight: 48 },
    monster_phoenix: { frameWidth: 72, frameHeight: 56 },
    monster_imp: { frameWidth: 64, frameHeight: 48 },
    monster_lesser_demon: { frameWidth: 72, frameHeight: 64 },
    monster_succubus: { frameWidth: 100, frameHeight: 64 },
    monster_demon_lord: { frameWidth: 120, frameHeight: 84 },
    monster_dungeon_shade: { frameWidth: 64, frameHeight: 60 },
    monster_dungeon_fiend: { frameWidth: 80, frameHeight: 68 },
    monster_dungeon_boss: { frameWidth: 128, frameHeight: 96 },
    monster_dungeon_mid_boss: { frameWidth: 100, frameHeight: 76 },
    monster_goblin_shaman: { frameWidth: 80, frameHeight: 60 },
    monster_shadow_weaver: { frameWidth: 88, frameHeight: 64 },
    monster_iron_guardian: { frameWidth: 104, frameHeight: 72 },
    monster_sand_wraith: { frameWidth: 76, frameHeight: 64 },
    monster_void_herald: { frameWidth: 96, frameHeight: 68 },
    monster_sub_mine_guardian: { frameWidth: 80, frameHeight: 68 },
    monster_sub_altar_keeper: { frameWidth: 84, frameHeight: 68 },
    // NPCs (80x120, 24 frames)
    npc_blacksmith: { frameWidth: 80, frameHeight: 120 },
    npc_blacksmith_advanced: { frameWidth: 80, frameHeight: 120 },
    npc_merchant: { frameWidth: 80, frameHeight: 120 },
    npc_merchant_desert: { frameWidth: 80, frameHeight: 120 },
    npc_stash: { frameWidth: 80, frameHeight: 120 },
    npc_quest_elder: { frameWidth: 80, frameHeight: 120 },
    npc_quest_scout: { frameWidth: 80, frameHeight: 120 },
    npc_forest_hermit: { frameWidth: 80, frameHeight: 120 },
    npc_quest_dwarf: { frameWidth: 80, frameHeight: 120 },
    npc_quest_nomad: { frameWidth: 80, frameHeight: 120 },
    npc_quest_warden: { frameWidth: 80, frameHeight: 120 },
    // Event NPCs are generated lazily when the corresponding event/quest appears.
    npc_rescue_lost_traveler: { frameWidth: 80, frameHeight: 120 },
    npc_rescue_wounded_hunter: { frameWidth: 80, frameHeight: 120 },
    npc_rescue_trapped_miner: { frameWidth: 80, frameHeight: 120 },
    npc_rescue_caravan_guard: { frameWidth: 80, frameHeight: 120 },
    npc_rescue_abyss_explorer: { frameWidth: 80, frameHeight: 120 },
    npc_escort_traveling_merchant: { frameWidth: 80, frameHeight: 120 },
    npc_escort_wounded_explorer: { frameWidth: 80, frameHeight: 120 },
    npc_mercenary_tank: { frameWidth: 80, frameHeight: 120 },
    npc_mercenary_melee: { frameWidth: 80, frameHeight: 120 },
    npc_mercenary_ranged: { frameWidth: 80, frameHeight: 120 },
    npc_mercenary_healer: { frameWidth: 80, frameHeight: 120 },
    npc_mercenary_mage: { frameWidth: 80, frameHeight: 120 },
  };
}

/**
 * Widest texture we emit. 4096 is the WebGL MAX_TEXTURE_SIZE floor on older
 * mobile / integrated GPUs; a single-row strip wider than the device limit
 * uploads as a black rectangle, so sheets wrap into a grid instead.
 */
export const MAX_SHEET_DIMENSION = 4096;

export interface SheetGrid {
  frameW: number;
  frameH: number;
  cols: number;
  rows: number;
  width: number;
  height: number;
}

export function computeSheetGrid(frameW: number, frameH: number, totalFrames: number): SheetGrid {
  const maxCols = Math.max(1, Math.min(totalFrames, Math.floor(MAX_SHEET_DIMENSION / frameW)));
  const rows = Math.max(1, Math.ceil(totalFrames / maxCols));
  // Balance the rows so a wrapped sheet doesn't carry a mostly empty last row
  // (20 frames at 18 per row used to allocate 36 cells).
  const cols = Math.max(1, Math.ceil(totalFrames / rows));
  return { frameW, frameH, cols, rows, width: cols * frameW, height: rows * frameH };
}

export function sheetFrameOrigin(grid: SheetGrid, index: number): { x: number; y: number } {
  return {
    x: (index % grid.cols) * grid.frameW,
    y: Math.floor(index / grid.cols) * grid.frameH,
  };
}
