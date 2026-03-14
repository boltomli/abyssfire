import { EmeraldPlainsMap } from './emerald_plains';
import { TwilightForestMap } from './twilight_forest';
import { AnvilMountainsMap } from './anvil_mountains';
import { ScorchingDesertMap } from './scorching_desert';
import { AbyssRiftMap } from './abyss_rift';
import type { MapData } from '../types';

export const AllMaps: Record<string, MapData> = {
  emerald_plains: EmeraldPlainsMap,
  twilight_forest: TwilightForestMap,
  anvil_mountains: AnvilMountainsMap,
  scorching_desert: ScorchingDesertMap,
  abyss_rift: AbyssRiftMap,
};

export const MapOrder = [
  'emerald_plains',
  'twilight_forest',
  'anvil_mountains',
  'scorching_desert',
  'abyss_rift',
];

export { EmeraldPlainsMap, TwilightForestMap, AnvilMountainsMap, ScorchingDesertMap, AbyssRiftMap };
