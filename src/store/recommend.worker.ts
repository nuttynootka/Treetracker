/// <reference lib="webworker" />
import { recommend } from '../core/recommend';
import { detectShortfall } from '../core/recalc';
import { usableTrees } from '../core/predict';
import type { PlannerRow, SettingsValues, Tree } from '../core/types';

export interface WorkerRequest {
  seq: number;
  remaining: PlannerRow[];
  trees: Tree[];
  settings: SettingsValues;
}

// Recommendations take up to a second, so they run here instead of blocking taps.
self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { seq, remaining, trees, settings } = e.data;
  const rec = recommend(remaining, trees, settings);
  let shortfall = detectShortfall(null, trees, settings);
  const usable = usableTrees(trees);
  if (usable.length) {
    const maxEntered = Math.max(...usable.map((t) => t.waistCirc));
    shortfall = detectShortfall(recommend(remaining, trees, settings, { maxWaist: maxEntered }), trees, settings);
  }
  (self as unknown as Worker).postMessage({ seq, rec, shortfall });
};
