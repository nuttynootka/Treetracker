import { generateRows } from '../../src/core/wall';
import { DEFAULT_WALL, PLAN_V1_COURSES } from '../../src/core/seed';
import { rowKey } from '../../src/core/types';
import type { PlannerRow } from '../../src/core/types';

export const v1PlannerRows = (): PlannerRow[] =>
  generateRows(PLAN_V1_COURSES.exterior, PLAN_V1_COURSES.interior, DEFAULT_WALL).map((r) => ({
    key: rowKey(r.lengthFt, r.minCirc), lengthFt: r.lengthFt, minCirc: r.minCirc, remaining: r.quantity, quantity: r.quantity,
  }));
