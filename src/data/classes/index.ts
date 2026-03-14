import { WarriorClass } from './warrior';
import { MageClass } from './mage';
import { RogueClass } from './rogue';
import type { ClassDefinition } from '../types';

export const AllClasses: Record<string, ClassDefinition> = {
  warrior: WarriorClass,
  mage: MageClass,
  rogue: RogueClass,
};

export { WarriorClass, MageClass, RogueClass };
