# Saved plans and Plan from my logs — Implementation Plan

> Executed inline (superpowers:executing-plans), test first. Spec: `docs/superpowers/specs/2026-10-20-treetracker-design.md` §13.

## Tasks
1. **Core: row minimums and plan from logs** — `generateRows(ext, int, wall, minimums?)`; `planFromLogs(logs, plan)` in `src/core/logsplan.ts` returning `{ ok: true, exteriorAvg, interiorAvg, exteriorCourses, interiorCourses, exteriorHeightIn, interiorHeightIn, exteriorAdded, interiorAdded, rowMinimums, rows }` or `{ ok: false, count }`. Tests: ≤40 logs refused; 20×29.0 + 21×15.0 → 9 exterior courses (83.1 in), 18 interior (85.9 in), exterior rows min 18.9, interior 12.6; 20 logs at 36.13 in → 8 courses (closest 7 gives 80.5 < 82); quantity counts.
2. **Core: plan files** — `buildPlanFile`, `parsePlanFile` (SyncError messages), `samePlan(a, b)`; `isValidRecord` accepts optional name/archived/rowMinimums/previousPlanId. Seed plan named "Starting plan". `planName(plan, n)` helper.
3. **Store: plan actions** — `savePlan(fields, name, records)` (not used), `acceptPlan` keeps the other side's minimum, `usePlan(planId)`, `switchBack`, `renamePlan`, `setArchived`, `deletePlan` (refuses the plan in use), `importPlan(plan, records)` → `{ records, duplicateOf }`; `activate` records `previousPlanId`; `rowsFor` passes `rowMinimums`. `comparePlan` generalised with `compareRows(before, after, ctx)`; `comparePlanFromLogs`.
4. **UI** — Plans screen, Plan-from-logs preview, Save-as-plan on candidates, names everywhere, Main button. e2e: plan from logs flow, plan file round trip with duplicate message, archive/delete rules, switch back.
5. **Review** — fresh reviewer on the branch diff, fix Important findings test-first, push, confirm CI.
