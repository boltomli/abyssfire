import { EmeraldPlainsMap } from './emerald_plains';
import { TwilightForestMap } from './twilight_forest';
import { AnvilMountainsMap } from './anvil_mountains';
import { ScorchingDesertMap } from './scorching_desert';
import { AbyssRiftMap } from './abyss_rift';
import { MapGenerator } from '../../systems/MapGenerator';
import type { MapData } from '../types';

// Build the map registry and run procedural generation on maps with empty tiles
const rawMaps: Record<string, MapData> = {
  emerald_plains: EmeraldPlainsMap,
  twilight_forest: TwilightForestMap,
  anvil_mountains: AnvilMountainsMap,
  scorching_desert: ScorchingDesertMap,
  abyss_rift: AbyssRiftMap,
};

// Generate tiles/collisions for any map that has empty tile arrays
for (const key of Object.keys(rawMaps)) {
  const map = rawMaps[key];
  if (map.tiles.length === 0 && map.theme) {
    rawMaps[key] = MapGenerator.generate(map);
  }
}

export const AllMaps: Record<string, MapData> = rawMaps;

export const MapOrder = [
  'emerald_plains',
  'twilight_forest',
  'anvil_mountains',
  'scorching_desert',
  'abyss_rift',
];

export { EmeraldPlainsMap, TwilightForestMap, AnvilMountainsMap, ScorchingDesertMap, AbyssRiftMap };
