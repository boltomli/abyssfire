/**
 * Per-zone terrain look: ground materials for each tile type, wall outcrop
 * style and camp palisade style. Colours follow the zone palette table in
 * docs/art-direction.md — ground is the lowest-contrast layer (no outlines,
 * gentle value steps) so characters and props always read on top of it.
 */
import type { MapTheme } from '../../data/types';

/** Periodic (edge-crossing) layers painted onto every tile of a material. */
export type GroundLayer =
  | { kind: 'patch'; count: number; colors: number[]; r: [number, number]; alpha?: number }
  | { kind: 'tuft'; count: number; color: number; light: number; size: [number, number]; blades?: number }
  | { kind: 'pebble'; count: number; color: number; shade: number; light: number; size: [number, number] }
  | { kind: 'crack'; count: number; color: number; light?: number; len: [number, number]; width?: number; glow?: number; core?: number }
  | { kind: 'ripple'; count: number; dark: number; light: number; len: [number, number] }
  | { kind: 'speck'; count: number; colors: number[]; size: [number, number]; glow?: boolean }
  | { kind: 'snow'; count: number; color: number; shade: number; r: [number, number] }
  | { kind: 'leaf'; count: number; colors: number[]; size: [number, number] }
  | { kind: 'wave'; count: number; color: number; len: [number, number]; alpha?: number }
  | {
    kind: 'slabs'; cells: number; mortar: number; mortarW: number; jitter: number;
    bevelLight: number; bevelShade: number; fissure?: number; fissureCore?: number; fissureChance?: number;
  };

/** Interior-only details (never cross a tile edge); picked per tile variant. */
export type DetailKind =
  | 'flowers' | 'bigTuft' | 'stones' | 'crackStar' | 'glowSpecks' | 'mushrooms' | 'snowDrift'
  | 'bones' | 'emberVent' | 'roots' | 'shells' | 'straw' | 'lilyPads';

export interface GroundStyle {
  base: number;
  layers: GroundLayer[];
  details: DetailKind[];
  /** Accent colours used by details (flowers, glow...). */
  accents: number[];
  /** Transition spread priority: higher-ranked terrain laps over lower. */
  rank: number;
  /** Colour of the cel "lip" highlight on the higher side of a boundary. */
  lip?: number;
  /** Is this a liquid (gets shallows/foam at shores)? */
  liquid?: { shallow: number; foam: number; bank: number; glow?: boolean };
}

export type OutcropKind = 'mossBoulder' | 'forestRock' | 'crag' | 'mesa' | 'basalt';
export type PalisadeKind = 'stakes' | 'stoneWall' | 'mudbrick' | 'darkStakes';

export interface TerrainTheme {
  ground: Record<number, GroundStyle>;
  outcrop: {
    kind: OutcropKind;
    rock: number;
    cap: number;      // moss / snow / sand top colour
    accent: number;   // glow / flower / fissure colour
    extra: number;    // secondary material (hedge leaves, roots, strata)
    shadow: number;   // coloured contact shadow
  };
  palisade: { kind: PalisadeKind; wood: number; band: number; accent: number };
}

const grassLayers = (base: number, dark: number, light: number, blade: number, tip: number): GroundLayer[] => [
  { kind: 'patch', count: 4, colors: [dark, light, dark], r: [12, 24] },
  { kind: 'patch', count: 3, colors: [light, base], r: [6, 12] },
  { kind: 'tuft', count: 20, color: blade, light: tip, size: [3.2, 5.2] },
];

export const TERRAIN_THEMES: Record<MapTheme, TerrainTheme> = {
  // ── Emerald Plains: warm sunlit greens, ochre paths, golden highlights ──
  plains: {
    ground: {
      0: {
        base: 0x74a247, rank: 4, lip: 0x9cc65c,
        layers: grassLayers(0x74a247, 0x6c9a43, 0x7eab4e, 0x5a883b, 0xa9cc68),
        details: ['flowers', 'bigTuft', 'flowers', 'stones', 'bigTuft', 'flowers'],
        accents: [0xf6d65a, 0xfbf3dc, 0xe8829a, 0xf0a848],
      },
      1: {
        base: 0xc09a60, rank: 1,
        layers: [
          { kind: 'patch', count: 4, colors: [0xb8925a, 0xc8a36a], r: [10, 22] },
          { kind: 'crack', count: 2, color: 0xa88352, light: 0xd4b37c, len: [6, 12], width: 2 },
          { kind: 'pebble', count: 10, color: 0xd2b27c, shade: 0x9c7a4c, light: 0xe6cc98, size: [1.1, 2.2] },
        ],
        details: ['stones', 'straw', 'crackStar', 'stones'],
        accents: [0xe0c890],
      },
      2: {
        base: 0xa9a291, rank: 2,
        layers: [
          { kind: 'slabs', cells: 2, mortar: 0x8a8373, mortarW: 0.035, jitter: 0.06, bevelLight: 0xbdb6a3, bevelShade: 0x969080 },
          { kind: 'patch', count: 3, colors: [0x86a052], r: [3, 7] },
        ],
        details: ['bigTuft', 'crackStar', 'stones'],
        accents: [0x86a052],
      },
      3: {
        base: 0x3f93b8, rank: 0,
        layers: [
          { kind: 'patch', count: 3, colors: [0x3b8ab0, 0x459ac0], r: [14, 26] },
          { kind: 'wave', count: 5, color: 0xa9e2ee, len: [6, 11], alpha: 0.7 },
        ],
        details: ['lilyPads', 'lilyPads'],
        accents: [0x6fae4a, 0xf4d0e0],
        liquid: { shallow: 0x6cc3cf, foam: 0xeef9f2, bank: 0x8c7448 },
      },
      5: {
        base: 0xb89468, rank: 2,
        layers: [
          { kind: 'patch', count: 4, colors: [0xb08d62, 0xc09c70], r: [10, 20] },
          { kind: 'leaf', count: 4, colors: [0xd2b872, 0xc9ac64], size: [1.6, 3] },
          { kind: 'pebble', count: 6, color: 0xcaa878, shade: 0x94744c, light: 0xdcc092, size: [1, 1.8] },
        ],
        details: ['straw', 'stones', 'straw'],
        accents: [0xe2cb84],
      },
    },
    outcrop: { kind: 'mossBoulder', rock: 0x9c9888, cap: 0x7caa48, accent: 0xf6d65a, extra: 0x5f9a3e, shadow: 0x2f4a26 },
    palisade: { kind: 'stakes', wood: 0x9a6c3e, band: 0xc9a868, accent: 0x3f8a36 },
  },

  // ── Twilight Forest: cool violet-teal moss, dark roots, bioluminescence ──
  forest: {
    ground: {
      0: {
        base: 0x467a6c, rank: 4, lip: 0x66a08a,
        layers: [
          { kind: 'patch', count: 4, colors: [0x416f68, 0x4e6f70, 0x4b8072], r: [12, 24] },
          { kind: 'patch', count: 3, colors: [0x556886, 0x4c8474], r: [6, 12] },
          { kind: 'tuft', count: 14, color: 0x36615a, light: 0x6aa892, size: [3, 5], blades: 4 },
        ],
        details: ['mushrooms', 'roots', 'bigTuft', 'mushrooms', 'glowSpecks', 'bigTuft'],
        accents: [0x7ff5e6, 0xc9a2ff, 0x9ad0ff],
      },
      1: {
        base: 0x66525c, rank: 1,
        layers: [
          { kind: 'patch', count: 4, colors: [0x5f4c56, 0x6e5a64], r: [10, 22] },
          { kind: 'leaf', count: 9, colors: [0x866652, 0x74587a, 0x5d7a68], size: [2, 3.4] },
          { kind: 'pebble', count: 6, color: 0x7e6a78, shade: 0x4e3e4c, light: 0x927e8a, size: [1, 1.8] },
        ],
        details: ['roots', 'mushrooms', 'stones', 'roots'],
        accents: [0x7ff5e6, 0xc9a2ff],
      },
      2: {
        base: 0x66707e, rank: 2,
        layers: [
          { kind: 'slabs', cells: 2, mortar: 0x4e5664, mortarW: 0.04, jitter: 0.07, bevelLight: 0x7a8492, bevelShade: 0x585f6c },
          { kind: 'patch', count: 5, colors: [0x4f7e6c, 0x5a8a74], r: [4, 9] },
        ],
        details: ['glowSpecks', 'roots', 'crackStar'],
        accents: [0x7ff5e6],
      },
      3: {
        base: 0x2e6f7a, rank: 0,
        layers: [
          { kind: 'patch', count: 3, colors: [0x2b6874, 0x337880], r: [14, 26] },
          { kind: 'wave', count: 5, color: 0x8fe8e4, len: [6, 10], alpha: 0.55 },
          { kind: 'speck', count: 3, colors: [0x7ff5e6], size: [0.8, 1.2], glow: true },
        ],
        details: ['lilyPads'],
        accents: [0x4f8a60, 0xc9a2ff],
        liquid: { shallow: 0x46949a, foam: 0xbff4ee, bank: 0x4e3e48 },
      },
      5: {
        base: 0x6e6658, rank: 2,
        layers: [
          { kind: 'patch', count: 7, colors: [0x625a4e, 0x7a7262], r: [8, 18] },
          { kind: 'leaf', count: 12, colors: [0x8a6a5e, 0x5d7a68], size: [2, 3.4] },
        ],
        details: ['straw', 'stones', 'roots'],
        accents: [0xa89a70],
      },
    },
    outcrop: { kind: 'forestRock', rock: 0x5d6272, cap: 0x4f8a70, accent: 0x7ff5e6, extra: 0x4e3a3a, shadow: 0x1c2630 },
    palisade: { kind: 'stakes', wood: 0x6b5448, band: 0x8a9a6a, accent: 0x9a7ad8 },
  },

  // ── Anvil Mountains: slate blue-grey rock, snow & scree, forge accents ──
  mountain: {
    ground: {
      0: {
        base: 0x7a8a66, rank: 3, lip: 0x96a67e,
        layers: [
          { kind: 'patch', count: 6, colors: [0x6e7e5e, 0x86956e], r: [10, 20] },
          { kind: 'tuft', count: 16, color: 0x5d6c50, light: 0xa2ae86, size: [2.6, 4.2] },
          { kind: 'snow', count: 0.34, color: 0xe9f0f7, shade: 0xbccbe0, r: [5, 9] },
        ],
        details: ['stones', 'snowDrift', 'bigTuft'],
        accents: [0xe9f0f7],
      },
      1: {
        base: 0x8d8580, rank: 1,
        layers: [
          { kind: 'patch', count: 4, colors: [0x857d78, 0x958d88], r: [10, 20] },
          { kind: 'pebble', count: 16, color: 0x9f9892, shade: 0x716a65, light: 0xb2aba5, size: [1, 2] },
        ],
        details: ['stones', 'stones', 'crackStar'],
        accents: [0xe9f0f7],
      },
      2: {
        base: 0x8793a2, rank: 2, lip: 0x9eaab8,
        layers: [
          { kind: 'slabs', cells: 1.34, mortar: 0x75818f, mortarW: 0.022, jitter: 0.05, bevelLight: 0x95a1af, bevelShade: 0x7c8895 },
          { kind: 'patch', count: 2, colors: [0x818d9c, 0x8e9aa8], r: [12, 22] },
          { kind: 'pebble', count: 5, color: 0x96a1ae, shade: 0x6c7784, light: 0xa9b4c0, size: [0.9, 1.7] },
          { kind: 'snow', count: 0.23, color: 0xeef3f9, shade: 0xc9d5e5, r: [11, 18] },
        ],
        details: ['crackStar', 'stones', 'stones', 'crackStar', 'snowDrift'],
        accents: [0xff8a3a, 0xffc070],
      },
      3: {
        base: 0x4f8fb4, rank: 0,
        layers: [
          { kind: 'patch', count: 3, colors: [0x4a88ae, 0x5696ba], r: [14, 26] },
          { kind: 'wave', count: 5, color: 0xd4eef8, len: [6, 11], alpha: 0.65 },
        ],
        details: [],
        accents: [],
        liquid: { shallow: 0x88c4dc, foam: 0xf2fbff, bank: 0x6c7480 },
      },
      5: {
        base: 0x94908a, rank: 2,
        layers: [
          { kind: 'slabs', cells: 3, mortar: 0x75716c, mortarW: 0.04, jitter: 0.05, bevelLight: 0xa8a49e, bevelShade: 0x86827c },
        ],
        details: ['stones', 'crackStar'],
        accents: [0xff8a3a],
      },
    },
    outcrop: { kind: 'crag', rock: 0x7f8a9a, cap: 0xeef3f9, accent: 0xff8a3a, extra: 0x5e6878, shadow: 0x262e3c },
    palisade: { kind: 'stoneWall', wood: 0x8a8c92, band: 0x6a5446, accent: 0xff8a3a },
  },

  // ── Scorching Desert: pale sand with wind ripples, bleached sandstone ──
  desert: {
    ground: {
      0: {
        base: 0xb8aa66, rank: 3, lip: 0xcfc27e,
        layers: [
          { kind: 'patch', count: 6, colors: [0xc9b777, 0xaa9c5c], r: [8, 16] },
          { kind: 'tuft', count: 12, color: 0x8e8446, light: 0xd8cc88, size: [2.6, 4] },
        ],
        details: ['bigTuft', 'stones'],
        accents: [0xe0a060],
      },
      1: {
        base: 0xe3c489, rank: 3, lip: 0xf2dcaa,
        layers: [
          { kind: 'patch', count: 4, colors: [0xdcbc7e, 0xe9ce96], r: [14, 26] },
          { kind: 'ripple', count: 9, dark: 0xd2af72, light: 0xf2dcaa, len: [12, 22] },
          { kind: 'speck', count: 4, colors: [0xc9a46c, 0xf2e2bc], size: [0.6, 1] },
        ],
        details: ['shells', 'stones', 'bones', 'shells'],
        accents: [0x3fc8b8, 0xf2ead8],
      },
      2: {
        base: 0xd2a472, rank: 2,
        layers: [
          { kind: 'slabs', cells: 2, mortar: 0xb08058, mortarW: 0.03, jitter: 0.06, bevelLight: 0xe6be8c, bevelShade: 0xbb8c60 },
          { kind: 'patch', count: 5, colors: [0xe3c489], r: [4, 9] },
          { kind: 'crack', count: 3, color: 0xb2825a, len: [5, 10], width: 1.6 },
        ],
        details: ['crackStar', 'stones', 'bones'],
        accents: [0x3fc8b8],
      },
      3: {
        base: 0x2fb2ae, rank: 0,
        layers: [
          { kind: 'patch', count: 3, colors: [0x2aa8a8, 0x38b8b2], r: [14, 26] },
          { kind: 'wave', count: 5, color: 0xc8fff2, len: [6, 11], alpha: 0.7 },
        ],
        details: ['lilyPads'],
        accents: [0x6fae4a, 0xf4e2a0],
        liquid: { shallow: 0x74d8c8, foam: 0xf6fff8, bank: 0xb8955e },
      },
      5: {
        base: 0xd8bc8e, rank: 1,
        layers: [
          { kind: 'patch', count: 6, colors: [0xcdb080, 0xe4caa0], r: [9, 18] },
          { kind: 'ripple', count: 8, dark: 0xc6a878, light: 0xeed8b2, len: [6, 11] },
        ],
        details: ['straw', 'stones'],
        accents: [0xc05a3a, 0x3fa8b8],
      },
    },
    outcrop: { kind: 'mesa', rock: 0xcf9460, cap: 0xecce98, accent: 0x3fc8b8, extra: 0xb07048, shadow: 0x7a4e36 },
    palisade: { kind: 'mudbrick', wood: 0xcfa674, band: 0x9a6a44, accent: 0x3fa8b8 },
  },

  // ── Abyss Rift: charred black-violet basalt, crimson fissures, lava ──
  abyss: {
    ground: {
      0: {
        base: 0x564a5a, rank: 3, lip: 0x6e6072,
        layers: [
          { kind: 'patch', count: 6, colors: [0x4c4252, 0x625466], r: [9, 18] },
          { kind: 'tuft', count: 14, color: 0x3e3444, light: 0x857086, size: [2.6, 4.2] },
          { kind: 'speck', count: 3, colors: [0xff4f9a], size: [0.8, 1.2], glow: true },
        ],
        details: ['bones', 'glowSpecks', 'bigTuft'],
        accents: [0xff4f9a, 0xff6a3a],
      },
      1: {
        base: 0x5e5058, rank: 1,
        layers: [
          { kind: 'patch', count: 7, colors: [0x544850, 0x6c5e66], r: [9, 20] },
          { kind: 'pebble', count: 14, color: 0x4a3e48, shade: 0x2e2632, light: 0x6c5e68, size: [1, 2] },
          { kind: 'speck', count: 1.5, colors: [0xff6a3a, 0xffa050], size: [0.6, 1], glow: true },
        ],
        details: ['bones', 'emberVent', 'stones'],
        accents: [0xff6a3a, 0xffb060],
      },
      2: {
        base: 0x433a4a, rank: 2, lip: 0x584c60,
        layers: [
          {
            kind: 'slabs', cells: 1.34, mortar: 0x2e2634, mortarW: 0.024, jitter: 0.05, bevelLight: 0x4e4356, bevelShade: 0x3a3242,
          },
          { kind: 'crack', count: 0.12, color: 0xe8304c, core: 0xffc0a8, glow: 0xff2a4a, len: [26, 40], width: 2.4 },
          { kind: 'patch', count: 3, colors: [0x483e50, 0x3e3646], r: [8, 16] },
        ],
        details: ['emberVent', 'crackStar', 'bones', 'glowSpecks'],
        accents: [0xff3a5a, 0xff8a4a],
      },
      3: {
        base: 0xf2601e, rank: 0,
        layers: [
          { kind: 'patch', count: 3, colors: [0xe8541c, 0xff7c26], r: [14, 26] },
          { kind: 'patch', count: 1, colors: [0x6a2e24, 0x7a3624], r: [5, 9] },
          { kind: 'wave', count: 5, color: 0xffd060, len: [6, 11], alpha: 0.85 },
        ],
        details: [],
        accents: [],
        liquid: { shallow: 0xff9a36, foam: 0xffe27a, bank: 0x2a1c22, glow: true },
      },
      5: {
        base: 0x4e4450, rank: 2,
        layers: [
          { kind: 'slabs', cells: 3, mortar: 0x322a36, mortarW: 0.04, jitter: 0.05, bevelLight: 0x60546a, bevelShade: 0x40384a },
        ],
        details: ['emberVent', 'stones'],
        accents: [0xff6a3a],
      },
    },
    outcrop: { kind: 'basalt', rock: 0x3e3448, cap: 0x5a4c66, accent: 0xff3a4a, extra: 0x281f2e, shadow: 0x100a14 },
    palisade: { kind: 'darkStakes', wood: 0x4a3440, band: 0x6a6070, accent: 0xff3a3a },
  },
};

export function terrainTheme(theme: MapTheme | undefined): TerrainTheme {
  return TERRAIN_THEMES[theme ?? 'plains'] ?? TERRAIN_THEMES.plains;
}

/** Ground material used for tile type `t` (walls/camp walls stand on ground). */
export function groundStyle(theme: TerrainTheme, t: number): GroundStyle {
  return theme.ground[t] ?? theme.ground[0];
}
