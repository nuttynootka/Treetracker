import { buildProfile, waistCirc } from '../../src/core/profile';
import type { Tree } from '../../src/core/types';

let n = 0;
export function tree(lengthFt: number, buttCirc: number, readings: number[], extra: Partial<Tree> = {}): Tree {
  const p = buildProfile(lengthFt, buttCirc, readings, 12.6);
  return {
    id: `tree-${++n}`, type: 'tree', updatedAt: 'x', deleted: false, deviceId: 't', createdAt: n,
    lengthFt, buttCirc, readings, waistCirc: waistCirc(p, { waistHeightFt: 4, stumpHeightFt: 1 }),
    plan: { cuts: [], leftover: { startIn: 2, lengthIn: 0, topCirc: 12.6 }, wasteIn: 0 },
    predicted: null, actualLargeLogs: 0, warningsOverridden: false, notes: '', ...extra,
  };
}
export const syntheticTree = (extra: Partial<Tree> = {}) => tree(34, 42.4, [34.6, 30.2, 26.4, 22.0, 17.6], extra);
