export interface Stats {
  str: number;
  dex: number;
  vit: number;
  int: number;
  spi: number;
  lck: number;
}

export interface SkillDefinition {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  tree: string;
  tier: number;
  maxLevel: number;
  manaCost: number;
  cooldown: number;
  range: number;
  damageMultiplier: number;
  damageType: 'physical' | 'fire' | 'ice' | 'lightning' | 'poison' | 'arcane';
  aoe?: boolean;
  aoeRadius?: number;
  buff?: {
    stat: string;
    value: number;
    duration: number;
  };
  icon: string;
}

export interface ClassDefinition {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  baseStats: Stats;
  statGrowth: Stats;
  skills: SkillDefinition[];
}

export interface MonsterDefinition {
  id: string;
  name: string;
  level: number;
  hp: number;
  damage: number;
  defense: number;
  speed: number;
  aggroRange: number;
  attackRange: number;
  attackSpeed: number;
  expReward: number;
  goldReward: [number, number];
  spriteKey: string;
  elite?: boolean;
}

export interface TileData {
  walkable: boolean;
  type: 'grass' | 'dirt' | 'stone' | 'water' | 'wall' | 'camp';
}

export interface MapData {
  id: string;
  name: string;
  cols: number;
  rows: number;
  tiles: number[][];
  collisions: boolean[][];
  spawns: { col: number; row: number; monsterId: string; count: number }[];
  camps: { col: number; row: number; npcs: string[] }[];
  playerStart: { col: number; row: number };
  exits: { col: number; row: number; targetMap: string; targetCol: number; targetRow: number }[];
}
