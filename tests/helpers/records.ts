import type { LogCut, NeedRow } from '../../src/core/types';

let n = 0;
export function need(lengthFt: number, minCirc: number, quantity: number, extra: Partial<NeedRow> = {}): NeedRow {
  return { id: `need-${++n}`, type: 'need', updatedAt: 'x', deleted: false, deviceId: 't', lengthFt, minCirc, quantity, planVersionId: 'p', manuallyEdited: false, ...extra };
}
export function log(lengthFt: number, smallCirc: number, quantity = 1, extra: Partial<LogCut> = {}): LogCut {
  return { id: `log-${++n}`, type: 'log', updatedAt: 'x', deleted: false, deviceId: 't', source: 'manual', treeId: null, lengthFt, smallCirc, quantity, createdAt: n, ...extra };
}
