# TreeTracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An offline Android app (Capacitor-wrapped Preact) that plans log cuts from measured noble fir trees, tracks logs needed against logs cut, recommends the next trees by waist circumference, regenerates the needs list from a wall course plan, and syncs two phones by file.

**Architecture:** A pure TypeScript `src/core/` holds every rule and algorithm and is unit-tested in Node. `src/store/` persists records in IndexedDB and derives totals by calling core. Heavy recommendation work runs in a Web Worker. `src/ui/` is Preact screens styled with neumorphic CSS. Capacitor wraps the built web app into an Android project. GitHub Actions builds a signed APK.

**Tech Stack (exact pins):** Node 22, TypeScript 5.9.3, Vite 8.3.4, Preact 10.29.8, @preact/preset-vite 2.10.6, Vitest 5.0.5, @playwright/test 1.56.1 (matches the preinstalled chromium-1194), idb 8.0.4, fake-indexeddb 6.2.6, @capacitor/core, @capacitor/cli and @capacitor/android 8.5.3, @capacitor/filesystem 8.1.5, @capacitor/share 8.0.3, @fontsource/antonio 5.3.0, @fontsource/dm-sans 5.3.0, Java 21 (CI: Temurin 21).

**Spec:** `docs/superpowers/specs/2026-10-20-treetracker-design.md`. Read it before any task. Section numbers below (§) refer to it.

## Global Constraints

- App name `TreeTracker`, Android app id `com.nuttynootka.treetracker`.
- Every thickness is a circumference in inches. No UI text, label, report or export ever shows a diameter or "across" size.
- No screen, report or toast ever shows a tree length as advice. Predicted lengths stay internal.
- Tree length is stored exactly as entered. Log lengths are whole feet. Need-row lengths are whole feet.
- Logs with `source: 'manual'` never feed tree averages, predictions or shortfall yield.
- No network access at runtime. Fonts are bundled, and their OFL license files are copied to `public/licenses/`.
- Light theme only. Colour tokens are exactly as in §9. No other hues.
- Tap targets ≥ 48 px, focus outline 3 px graphite, and state is never shown by shadow alone.
- Number inputs use `inputmode="decimal"`, and parsing accepts `,` as the decimal separator.
- Records are never hard-deleted. Deletion sets `deleted: true` with a new HLC.
- Seeded records (settings, plan v1, its rows, the active plan pointer) use deterministic ids and the seed HLC `000000000000000:000000:seed`, so two phones seeded separately merge without duplicates.
- Commit after every task. Messages end with the session attribution lines from the system reminder.

## Review Focus

1. **Both phones seeded separately, then synced:** the result must have no duplicate rows and no duplicate plan v1. (Test in Task 10.)
2. **A tree too short for any piece** (for example 3 ft, or a top below every row minimum): the planner returns zero cuts, the UI says "No needed logs fit this tree", and the tree is still saved and still feeds averages. (Tests in Task 6 and Task 14.)
3. **Length an exact multiple of 6 ft** (for example 36 ft): reading fields are 6 to 30 only, with no field at 36, because the end point is the 12.6 in top. (Test in Task 2.)
4. **Have exceeding needed** after manual logs or a quantity edit: still-to-cut is clamped at 0, and surplus logs appear as extras. Nothing goes negative anywhere, including remaining rows passed to the planner. (Test in Task 5.)
5. **Import of an older file after a local delete:** the tombstone wins when its HLC is newer, so a deleted tree does not come back. Importing a file exported by the same phone is a no-op. (Tests in Task 10.)

---

## File Structure

```
package.json, tsconfig.json, vite.config.ts, vitest.config.ts, playwright.config.ts, capacitor.config.ts, index.html
public/licenses/            Antonio-OFL.txt, DMSans-OFL.txt
src/core/
  types.ts                  every record and value type (Interfaces in Task 1)
  num.ts                    parseNumber, round helpers
  hlc.ts                    hybrid logical clock
  profile.ts                tree profile, stations, waist estimate, validation
  matching.ts               greedy log-to-row matching
  planner.ts                cut planner
  predict.ts                profile prediction (prior + blend)
  recommend.ts              next trees, trees-needed estimate, unfillable rows
  wall.ts                   wall model → need rows, stack height
  recalc.ts                 shortfall detection, candidate plans, comparison
  seed.ts                   default settings, plan v1, seeded records
  sync.ts                   export file, parse, merge
  report.ts                 report text and CSV
src/store/
  db.ts                     IndexedDB repo
  local.ts                  device id/name, last export/import (localStorage)
  derive.ts                 deriveState(records)
  actions.ts                every mutation → records to put
  recommend.worker.ts       runs recommend + detectShortfall off the main thread
  app-state.tsx             Preact context: records, derived, recommendations, actions
src/platform/share.ts       share/save a file or text (Capacitor, web fallback)
src/ui/
  theme.css                 tokens, neumorphic classes, fonts
  components/               Button.tsx, NumberField.tsx, Tile.tsx, ListRow.tsx, Sheet.tsx, Toast.tsx, Pill.tsx, Progress.tsx, Banner.tsx
  screens/                  Main.tsx, CutPlan.tsx, AddLogs.tsx, LogsNeeded.tsx, LogsCut.tsx, TreesCut.tsx, Reports.tsx, Settings.tsx, Sync.tsx, WallPlan.tsx
  router.tsx                hash router
  main.tsx                  entry
tests/core/*.test.ts, tests/store/*.test.ts, e2e/*.spec.ts
android/                    generated by Capacitor (Task 17)
android-signing/            treetracker.jks, signing.properties
.github/workflows/android.yml
docs/INSTALL.md
```

---

### Task 1: Project scaffold, types, theme, and fonts

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`, `src/core/types.ts`, `src/core/num.ts`, `src/ui/theme.css`, `src/ui/main.tsx`, `public/licenses/*`, `.gitignore`
- Test: `tests/core/num.test.ts`

**Interfaces:**
- Produces, in `src/core/types.ts`:

```ts
export type Id = string;
export type Hlc = string;                       // see Task 3 format
export interface Base { id: Id; updatedAt: Hlc; deleted: boolean; deviceId: string }
export interface Cut { startIn: number; endIn: number; lengthFt: number; smallCirc: number; rowKey: string }
export interface CutPlan { cuts: Cut[]; leftover: { startIn: number; lengthIn: number; topCirc: number }; wasteIn: number }
export interface Prediction { readings: number[]; lengthFt: number; largeLogs: number }
export interface Tree extends Base { type: 'tree'; createdAt: number; lengthFt: number; buttCirc: number; readings: number[];
  waistCirc: number; plan: CutPlan; predicted: Prediction | null; actualLargeLogs: number; warningsOverridden: boolean; notes: string }
export interface LogCut extends Base { type: 'log'; source: 'tree' | 'manual'; treeId: Id | null; lengthFt: number; smallCirc: number; quantity: number; createdAt: number }
export interface NeedRow extends Base { type: 'need'; lengthFt: number; minCirc: number; quantity: number; planVersionId: Id | null; manuallyEdited: boolean }
export interface ExteriorWall { name: string; centerlineIn: number; hasLogs: boolean }
export interface WallSettings { postWidthIn: number; tenonIn: number; exteriorHeightIn: number; interiorHeightIn: number;
  toleranceBelowIn: number; toleranceAboveIn: number; courseHeightIn: Record<string, number>; // key = circ.toFixed(1)
  exteriorWalls: ExteriorWall[]; interiorPiecesIn: number[] }
export interface PlanVersion extends Base { type: 'plan'; version: number; exteriorCourses: number[]; interiorCourses: number[];
  wall: WallSettings; createdBy: string; createdAt: number; note: string }
export interface ActivePlan extends Base { type: 'active'; planVersionId: Id }
export interface SettingsValues { kerfIn: number; buttTrimIn: number; stumpHeightFt: number; waistHeightFt: number; maxWaistCirc: number;
  topCirc: number; priorTaperPerFt: number; shortfallMinTrees: number; shortfallYieldRatio: number; spareFraction: number; undoSeconds: number }
export interface Settings extends Base, SettingsValues { type: 'settings' }
export type AnyRecord = Tree | LogCut | NeedRow | PlanVersion | ActivePlan | Settings;
export interface ProfilePoint { xFt: number; circ: number }
export interface Profile { points: ProfilePoint[]; lengthFt: number }
export interface PlannerRow { key: string; lengthFt: number; minCirc: number; remaining: number; quantity: number }
export const rowKey = (lengthFt: number, minCirc: number) => `${lengthFt}|${minCirc.toFixed(1)}`;
```

- Produces, in `src/core/num.ts`: `parseNumber(s: string): number | null` (trims, accepts `,` as decimal, rejects empty and non-numeric), `round1(n: number): number`.

- [ ] **Step 1:** Create `package.json` with the exact pinned versions from the header. Add the scripts `dev: vite`, `build: tsc --noEmit && vite build`, `test: vitest run`, `e2e: playwright test`, `typecheck: tsc --noEmit`. Run `npm install`. Expected: exits 0.
- [ ] **Step 2:** Configure `tsconfig.json` (strict, `jsx: react-jsx`, `jsxImportSource: preact`), `vite.config.ts` (`@preact/preset-vite`, `base: './'` so Capacitor can load from file), `vitest.config.ts` (environment `node`, include `tests/**/*.test.ts`), and `.gitignore` (`node_modules`, `dist`, `test-results`, `android/app/build`, `android/.gradle`).
- [ ] **Step 3: Write the failing test** `tests/core/num.test.ts`: `parseNumber('12.6') === 12.6`, `parseNumber('12,6') === 12.6`, `parseNumber(' 34 ') === 34`, `parseNumber('') === null`, `parseNumber('abc') === null`, `round1(28.27) === 28.3`.
- [ ] **Step 4:** Run `npx vitest run tests/core/num.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 5:** Write `types.ts` and `num.ts` as above.
- [ ] **Step 6:** Write `theme.css`:
  - `:root` tokens exactly as in §9, plus `--raise: 6px 6px 12px var(--shadow-dark), -6px -6px 12px var(--shadow-light)`, `--raise-lg: 10px 10px 22px …, -10px -10px 22px …`, `--inset: inset 4px 4px 8px var(--shadow-dark), inset -4px -4px 8px var(--shadow-light)`.
  - Radii 12/18/26 px, spacing 4/8/12/16/24/32 px.
  - Classes `.raised`, `.raised-lg`, `.inset`, `.btn` (raised, inset on `:active`), `.btn-primary` (green background, text-on-green), `:focus-visible { outline: 3px solid var(--graphite); outline-offset: 2px }`.
  - Type: `h1` Antonio 700 38px, `.big-num` Antonio 700 30px, `label` DM Sans 600 14px, `input` DM Sans 600 17px.
  - `body` background `var(--base)`, colour graphite.
  - Import `@fontsource/antonio/700.css`, `@fontsource/dm-sans/400.css` and `@fontsource/dm-sans/600.css` from `main.tsx`.
- [ ] **Step 7:** Copy each font package's license file (`node_modules/@fontsource/antonio/LICENSE`, `node_modules/@fontsource/dm-sans/LICENSE`) to `public/licenses/Antonio-OFL.txt` and `public/licenses/DMSans-OFL.txt`. If a package ships no LICENSE file, stop and report it. Do not fetch from the internet.
- [ ] **Step 8:** Write `main.tsx`, which renders `<h1>TreeTracker</h1>`. Run `npm test && npm run build`. Expected: tests PASS, and `dist/` contains the woff2 files and `licenses/`.
- [ ] **Step 9:** Commit: `chore: scaffold TreeTracker (Vite, Preact, theme, fonts)`.

---

### Task 2: Tree profile, reading stations, waist estimate, and validation

**Files:**
- Create: `src/core/profile.ts`
- Test: `tests/core/profile.test.ts`

**Interfaces:**
- Consumes: `Profile`, `SettingsValues` from Task 1.
- Produces:
  - `readingStations(lengthFt: number): number[]`: every multiple of 6 strictly below the length.
  - `buildProfile(lengthFt: number, buttCirc: number, readings: number[], topCirc: number): Profile`
  - `circAt(p: Profile, xFt: number): number`: linear interpolation, clamped to the end points.
  - `waistCirc(p: Profile, s: Pick<SettingsValues,'waistHeightFt'|'stumpHeightFt'>): number`
  - `validateTree(lengthFt: number|null, buttCirc: number|null, readings: (number|null)[], topCirc: number): { errors: string[]; warnings: string[] }`

- [ ] **Step 1: Write failing tests:**
  - `readingStations(34)` equals `[6,12,18,24,30]`, `readingStations(36)` equals `[6,12,18,24,30]`, `readingStations(5)` equals `[]`.
  - Synthetic tree `buildProfile(34, 42.4, [34.6,30.2,26.4,22.0,17.6], 12.6)` has 7 points ending at `{xFt:34, circ:12.6}`.
  - `circAt(p, 3)` ≈ 38.5 (±0.01), `circAt(p, 33)` ≈ 13.84 (±0.01).
  - `waistCirc` of it with waist 4 and stump 1 ≈ 38.5.
  - With stump 4 and waist 4, the result equals the butt circumference 42.4.
  - `validateTree(null, …)` gives an error.
  - Readings `[30, 32]` warn that a reading increases going up the tree.
  - Butt 90 warns that the value is outside 5–80.
  - Length 130 warns that it is outside 4–120.
  - A reading of 11 before the top warns that it is below 12.6.
- [ ] **Step 2:** Run `npx vitest run tests/core/profile.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. Error and warning strings are plain English and use the word "circumference" (they appear on screen).
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(core): tree profile, stations, waist estimate, validation`.

---

### Task 3: Hybrid logical clock

**Files:**
- Create: `src/core/hlc.ts`
- Test: `tests/core/hlc.test.ts`

**Interfaces:**
- Produces:
  - Format: `` `${ms.toString().padStart(15,'0')}:${counter.toString().padStart(6,'0')}:${deviceId}` ``. This makes string comparison equal time order.
  - `SEED_HLC = '000000000000000:000000:seed'`
  - `compareHlc(a: Hlc, b: Hlc): number`
  - `class Clock { constructor(deviceId: string, now?: () => number); tick(): Hlc; receive(remote: Hlc): void; }`

- [ ] **Step 1: Write failing tests:**
  - Successive `tick()` calls with a frozen `now` strictly increase.
  - After `receive` of a remote HLC 1 hour ahead of the local clock, the next `tick()` is greater than the remote.
  - Equal ms and counter break ties by device id.
  - `compareHlc(SEED_HLC, anyTick) < 0`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement the standard HLC: `tick` sets l = max(l, now); counter++ if l is unchanged, else counter = 0. `receive` takes the max of the local, remote and now values.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(core): hybrid logical clock`.

---

### Task 4: Wall model and need-row generation, plus seed data

**Files:**
- Create: `src/core/wall.ts`, `src/core/seed.ts`
- Test: `tests/core/wall.test.ts`

**Interfaces:**
- Consumes: `WallSettings`, `PlanVersion`, `NeedRow`, `Settings`, `ActivePlan`, `SEED_HLC`, `rowKey`.
- Produces:
  - `pieceLengthIn(centerlineIn: number, w: WallSettings): number`: `Math.round(centerline − postWidth + 2 × tenon)`.
  - `courseHeight(circ: number, w: WallSettings): number`: `w.courseHeightIn[circ.toFixed(1)] ?? circ / Math.PI`.
  - `stackHeight(courses: number[], w: WallSettings): number`
  - `generateRows(exteriorCourses: number[], interiorCourses: number[], w: WallSettings): { lengthFt: number; minCirc: number; quantity: number }[]`. Each exterior wall with `hasLogs` gives one piece per course. Each interior course gives the `interiorPiecesIn` pieces. Each piece is rounded up to whole feet with `Math.ceil(in / 12)`, then grouped by (lengthFt, course circ). The result is sorted by length descending, then circumference descending.
  - In `seed.ts`:
    - `DEFAULT_SETTINGS: SettingsValues`, with the §5.1 values and `shortfallMinTrees: 3`, `shortfallYieldRatio: 0.6`, `spareFraction: 0.1`, `undoSeconds: 10`, `topCirc: 12.6`, `priorTaperPerFt: 0.59`, `maxWaistCirc: 37.7`.
    - `DEFAULT_WALL: WallSettings`, with post 13, tenon 3, heights 84/84, tolerance 2/4.5, empty `courseHeightIn`, walls W1 120, W2 96 (no logs), W3 192, W4 144, W5 192, W6 96, W7 120, W8 120, and interior pieces `[48,48,60,62]`.
    - `PLAN_V1_COURSES = { exterior: [28.3×4, 25.2×6], interior: [18.9×4, 15.8×8, 12.6×5] }`.
    - `needRowId(planId: Id, lengthFt: number, minCirc: number): Id`, returning `` `${planId}:${rowKey(lengthFt,minCirc)}` ``.
    - `seedRecords(): AnyRecord[]`: settings (id `settings`), plan (id `plan-v1`, version 1), its rows (ids from `needRowId`), and active (id `active-plan`). All carry `SEED_HLC`, `deviceId: 'seed'`, `createdBy: 'seed'` and `createdAt: 0`.

- [ ] **Step 1: Write failing tests** (exact values from the spec and addendum):
  - `pieceLengthIn(120, DEFAULT_WALL) === 113`, and likewise 192 → 185, 144 → 137, 96 → 89.
  - `generateRows(PLAN_V1 exterior, interior, DEFAULT_WALL)` equals exactly the 17 rows of the starting list in §5.6, with a quantity sum of 138:

    ```
    16|28.3:8 16|25.2:12 12|28.3:4 12|25.2:6 10|28.3:12 10|25.2:18 8|28.3:4 8|25.2:6
    6|18.9:4 6|15.8:8 6|12.6:5 5|18.9:4 5|15.8:8 5|12.6:5 4|18.9:8 4|15.8:16 4|12.6:10
    ```

  - Exterior `[25.2×11]` with no interior gives `16|25.2:22, 12|25.2:11, 10|25.2:33, 8|25.2:11`.
  - The piece counts for `[25.2×10]` and `[28.3×9]` are 70 and 63.
  - `stackHeight([25.2×11], DEFAULT_WALL)` ≈ 88.23, and the plan v1 exterior ≈ 84.16 (±0.01).
  - `seedRecords()` called twice gives deep-equal output (deterministic).
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(core): wall model, need-row generation, seed data`.

---

### Task 5: Greedy log-to-row matching

**Files:**
- Create: `src/core/matching.ts`
- Test: `tests/core/matching.test.ts`

**Interfaces:**
- Consumes: `NeedRow`, `LogCut`, `PlannerRow`, `rowKey`.
- Produces:
  - `matchLogs(rows: NeedRow[], logs: LogCut[]): { have: Map<Id, number>; extras: { logId: Id; count: number }[] }`
    - Ignores deleted records.
    - Expands each log by its quantity.
    - Rows are sorted longest first, then largest circumference first.
    - Each row repeatedly takes the smallest fitting unit (shortest, then smallest circumference) until it is full.
    - Units that are never taken are extras.
  - `remainingPlannerRows(rows: NeedRow[], have: Map<Id, number>): PlannerRow[]`: `remaining = max(0, quantity − have)`. It merges rows with the same `rowKey` (summing quantity and remaining) and drops rows whose remaining is 0.

- [ ] **Step 1: Write failing tests:**
  - A 16 ft, 30 in log fills a `16|28.3` row.
  - A 15 ft log does not fill a 16 ft row.
  - A 10 ft, 28.0 in log does not fill `10|28.3` but does fill `10|25.2`.
  - With rows `10|28.3 ×1` and `10|25.2 ×1` and logs (10 ft, 26) and (10 ft, 29), the 29 in log goes to the 28.3 row and the 26 in log to the 25.2 row.
  - A row with quantity 2 and three fitting logs gives have 2 and one extra (Review Focus 4).
  - `remainingPlannerRows` never returns a negative and omits finished rows.
  - Deleted logs are ignored.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(core): greedy log matching and remaining rows`.

---

### Task 6: Cut planner

**Files:**
- Create: `src/core/planner.ts`
- Test: `tests/core/planner.test.ts`

**Interfaces:**
- Consumes: `Profile`, `circAt`, `PlannerRow`, `CutPlan`, `SettingsValues`.
- Produces:
  - `rowWeight(r: PlannerRow, remaining: number): number`: `r.lengthFt × (r.minCirc / 12.6) × (1 + remaining / r.quantity)`.
  - `planTree(p: Profile, rows: PlannerRow[], s: Pick<SettingsValues,'kerfIn'|'buttTrimIn'>): CutPlan`
  - `planYield(plan: CutPlan): Map<string, number>`: pieces per rowKey.

Algorithm (this is the part the signature does not determine):

```
start = buttTrimIn. Each chosen piece occupies [pos, pos + 12·N], next pos = end + kerfIn.
Feasible at pos: pos + 12N ≤ 12·lengthFt AND circAt(p, (pos + 12N)/12) ≥ minCirc AND used[row] < remaining[row].
State = vector of used counts per row (position is determined by it: start + Σ(12N + kerf)).
best(state) = max over feasible rows r of weight(r, remaining_r − used_r) + best(state + r), or 0 for stopping.
Memoise on the used-count vector as a string key. Tie-break equal value by smaller waste (unused inches).
Reconstruct the sequence; order is butt → top as chosen.
```

A piece's weight uses the row's remaining count before that piece, so scarcity drops as a row fills.

- [ ] **Step 1: Write failing tests:**
  - Synthetic tree (Task 2 values) against the full plan v1 rows (all remaining):
    - The plan has ≥ 2 cuts.
    - Every cut satisfies `circAt(end) ≥ row minCirc`.
    - Every cut's `smallCirc` equals `circAt(endIn/12)` rounded to 0.1.
    - Cuts are contiguous: first start = 2, each next start = previous end + 0.375.
    - The last end ≤ 408.
  - No row is used beyond its remaining count. For example, with only `16|28.3` remaining 1, the plan uses it at most once.
  - **Brute-force agreement:** 200 seeded-random cases (seeded PRNG in the test). Profiles have 3–6 points, non-increasing, length 10–30 ft, with 1–4 random rows (lengths 4–16, circ from {12.6, 15.8, 18.9, 25.2, 28.3}, remaining 1–3). The `planTree` total weight equals an exhaustive enumeration of all sequences (written in the test) to within 1e-9.
  - Review Focus 2: a 3 ft tree, or a tree whose top is below every minimum, gives `cuts: []` and a leftover of the whole usable length.
  - Leftover: `startIn` = last end + kerf (or butt trim if there are no cuts), `lengthIn` = 12·length − startIn (≥ 0), `topCirc` = 12.6.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS. The 200 brute-force cases should finish in under 10 s total.
- [ ] **Step 5:** Commit: `feat(core): exact cut planner`.

---

### Task 7: Profile prediction (prior and blend)

**Files:**
- Create: `src/core/predict.ts`
- Test: `tests/core/predict.test.ts`

**Interfaces:**
- Consumes: `Tree`, `Profile`, `buildProfile`, `readingStations`, `SettingsValues`.
- Produces:
  - `priorProfile(waist: number, s: SettingsValues): Profile`
    - butt = waist + (waistHeightFt − stumpHeightFt) × taper
    - length = (butt − topCirc) / taper
    - points at 0, 6, 12 … below the length, plus the end point (length, topCirc)
  - `predictProfile(waist: number, trees: Tree[], s: SettingsValues): Profile`
  - `learnedMaxLengthFt(trees: Tree[]): number | null`: 1.1 × the longest non-deleted tree, or null if there are none.

Blend (decided in spec §5.5):

```
measured = non-deleted trees. n = measured.length.
priorWeight = 5 × max(0, 1 − n/5).
kernel(t) = exp(−((t.waistCirc − waist)²) / (2·3²)).
Normalise each kernel by Σkernel × n, so measured trees together weigh n, distributed by closeness.
For x in 0,6,12…: ratio_t(x) = circAt(profile_t, x)/t.waistCirc when x ≤ t.lengthFt, else no contribution.
  Prior ratio = circAt(prior, x)/waist.
  ratio(x) = (priorWeight·prior + Σ w_t·ratio_t) / (priorWeight + Σ w_t that contribute).
lengthRatio blended the same way from lengthFt/waistCirc.
Predicted length = min(lengthRatio × waist, learnedMaxLengthFt ?? ∞).
Build stations below the predicted length, with ratio × waist, then end point (length, topCirc).
Make circumferences non-increasing (running min), and clamp them ≥ topCirc before the end.
```

- [ ] **Step 1: Write failing tests:**
  - `priorProfile(37.7, DEFAULT_SETTINGS)`:
    - butt ≈ 39.47
    - c at 16 ft ≈ 39.47 − 0.59×16 ≈ 30.03
    - length ≈ (39.47 − 12.6)/0.59 ≈ 45.54
  - With no trees, `predictProfile` equals `priorProfile`.
  - With 5 identical measured trees (the synthetic tree), the prediction at waist 38.5 matches the synthetic profile's ratios (within 0.2 in at each station), because the prior weight is 0.
  - The prediction is non-increasing.
  - The predicted length is ≤ 1.1 × the longest measured tree.
  - Deleted trees are ignored.
  - The function never reads `LogCut` (the type signature enforces this).
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(core): profile prediction with fading prior`.

---

### Task 8: Recommendations, trees-needed estimate, and benchmark gate

**Files:**
- Create: `src/core/recommend.ts`
- Test: `tests/core/recommend.test.ts`, `tests/core/benchmark.test.ts`

**Interfaces:**
- Consumes: `predictProfile`, `planTree`, `planYield`, `PlannerRow`, `Tree`, `SettingsValues`.
- Produces:
  - `candidateWaists(maxWaist: number): number[]`: 22, 23 … ⌊max⌋, plus `max` if it is not an integer.
  - `interface Recommendation { next: number[]; treesNeeded: number | null; spare: number; unfillable: string[]; yieldPlan: { waist: number; rows: Map<string, number> }[] }`
  - `recommend(rows: PlannerRow[], trees: Tree[], s: SettingsValues, opts?: { maxWaist?: number; maxTrees?: number }): Recommendation`
    - Loop: for each candidate, run `planTree(predictProfile(c), remaining)` and score it as Σweight ÷ c².
    - Pick the best, deduct its yield, and repeat until remaining is empty or no candidate yields anything.
    - `next` = the first 3 waists of the loop, rounded to 0.1.
    - `treesNeeded` = loop count if all rows are met, else null. `unfillable` lists the keys still remaining.
    - `spare = ceil(treesNeeded × spareFraction)`.
    - `maxTrees` defaults to 300 as a safety stop.
  - `largestClassCount(plan: CutPlan, rows: PlannerRow[]): number`: pieces in the largest minCirc among `rows`.

- [ ] **Step 1: Write failing tests** (`recommend.test.ts`):
  - Plan v1 rows, no trees: `next.length === 3`, every value is in `candidateWaists(37.7)`, and `treesNeeded` is not null.
  - After deducting a synthetic tree's planned yield, `treesNeeded` decreases or stays the same, and `next` is recomputed.
  - With a single remaining row `4|12.6 ×1`, the next tree is the smallest candidate, 22, because of the waist² penalty.
  - Rows impossible at max 34.6 (a `16|28.3` row) give `treesNeeded === null` and `unfillable` contains `16|28.3`.
- [ ] **Step 2: Write the benchmark test** (`benchmark.test.ts`). Prior only, with plan v1 rows and `maxWaist = cutFace − 3 × 0.59`:
  - cutFace 39.6 → `treesNeeded` in [34, 46] (spec ≈ 40)
  - cutFace 39.47 → in [34, 46]
  - cutFace 37.7 → in [38, 52] (spec ≈ 45)
  - cutFace 34.6 → `null`
  - cutFace 39.6 with `priorTaperPerFt` 0.79 → `null`
  - Log the actual counts and the waist mix with `console.log` so the report can quote them.
- [ ] **Step 3:** Run both. Expected: FAIL.
- [ ] **Step 4:** Implement.
- [ ] **Step 5:** Run both tests.
  - Expected: PASS, with the whole benchmark under 30 s in Node.
  - If a count is outside its band:
    - Investigate first: check the planner on the predicted profile and print the yield per tree.
    - The only allowed tuning is the `rowWeight` formula in Task 6. Record any change in the spec §5.4 and in the commit message.
    - Do not widen the bands.
    - If no reasonable weight lands in band, stop and report the numbers to the owner.
- [ ] **Step 6:** Commit: `feat(core): recommendations and trees-needed estimate (benchmark: <actual counts>)`.

---

### Task 9: Shortfall detection, candidate plans, and comparison

**Files:**
- Create: `src/core/recalc.ts`
- Test: `tests/core/recalc.test.ts`

**Interfaces:**
- Consumes: `generateRows`, `stackHeight`, `recommend`, `matchLogs`, `PlanVersion`, `Tree`, `LogCut`, `NeedRow`, `SettingsValues`.
- Produces:
  - `interface ShortfallSignal { kind: 'unfillable' | 'lowYield'; evidence: string }`
  - `detectShortfall(rec: Recommendation | null, trees: Tree[], s: SettingsValues): ShortfallSignal[]`
    - Unfillable: there is ≥ 1 non-deleted tree, `rec` was computed with `maxWaist = max entered waist`, and `rec.unfillable` is non-empty. The evidence lists the row sizes.
    - LowYield: at least `shortfallMinTrees` trees with `predicted`, and Σ actualLargeLogs ÷ Σ predicted.largeLogs < `shortfallYieldRatio`. The evidence says, for example, "Your 4 trees gave 3 of the 9 largest logs the model expected (33%)".
  - `supplyableClasses(logs: LogCut[], rec: Recommendation, allClasses: number[]): number[]`
  - `interface CandidatePlan { side: 'exterior' | 'interior'; courses: number[]; heightIn: number; diffIn: number; rows: { lengthFt: number; minCirc: number; quantity: number }[] }`
  - `candidatePlans(side, allowed: number[], plan: PlanVersion, limit = 3): CandidatePlan[]`
    - Enumerate a count per allowed class (the courses are those counts sorted descending, so the order is non-increasing).
    - Keep candidates with height in [target − below, target + above].
    - Rank by total pieces, then total linear feet.
    - Exclude a candidate identical to the current courses.
  - `comparePlan(current: PlanVersion, cand: CandidatePlan, ctx: { logs: LogCut[]; trees: Tree[]; s: SettingsValues }): { deltaPieces: number; deltaFeet: number; treesNeededBefore: number | null; treesNeededAfter: number | null; logsStillCounting: number; logsTotal: number }`

- [ ] **Step 1: Write failing tests:**
  - With allowed `[25.2]` on the exterior of plan v1, the first candidate has courses `[25.2×11]`, height ≈ 88.23, `diffIn ≈ +4.23`, and the addendum rows `16:22, 12:11, 10:33, 8:11`.
    - With the default tolerance (+4.5) the 11-course plan qualifies. `[25.2×10]` (80.2 in) is excluded (below 82).
  - Candidates never contain a course larger than the course below it.
  - `comparePlan` for v1 → 11×25.2 gives `deltaPieces === 7`.
  - `logsStillCounting` counts the matches against the new rows. With 8 cut logs of 16 ft at 30 in, all 8 still count under 11×25.2, because a 25.2 row accepts 30 in logs.
  - The `detectShortfall` evidence strings contain no "across" or "diameter".
  - There is no signal before the first tree.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(core): shortfall signals and candidate course plans`.

---

### Task 10: Sync file (export, parse, merge)

**Files:**
- Create: `src/core/sync.ts`
- Test: `tests/core/sync.test.ts`

**Interfaces:**
- Consumes: `AnyRecord`, `compareHlc`, `seedRecords`.
- Produces:
  - `interface SyncFile { format: 'treetracker-sync'; version: 1; deviceId: string; deviceName: string; exportedAt: number; records: AnyRecord[] }`
  - `buildExport(records: AnyRecord[], device: { id: string; name: string }, now: number): SyncFile`
  - `syncFileName(deviceName: string, now: number): string`: `treetracker-sync-<slug>-<YYYY-MM-DD-HHmm>.json`
  - `class SyncError extends Error {}`
  - `parseSyncFile(text: string): SyncFile`: throws `SyncError` with plain messages for bad JSON, the wrong format, or an unknown version.
  - `mergeRecords(local: AnyRecord[], incoming: AnyRecord[]): { changed: AnyRecord[]; added: number; updated: number; deleted: number; activePlanChanged: boolean; maxHlc: Hlc | null }`
    - An incoming record wins only if it is new or `compareHlc(in.updatedAt, local.updatedAt) > 0`.
    - `deleted` counts records that changed to deleted.

- [ ] **Step 1: Write failing tests:**
  - Two devices A and B both start from `seedRecords()` (Review Focus 1). A adds a tree, B adds manual logs, and both edit the same need row (B later). After A imports B's export and B imports A's, both record sets are deep-equal, the contested row holds B's value, and there are 17 seed rows, not 34.
  - Importing the same file twice: the second merge gives `changed.length === 0`.
  - Review Focus 5: A deletes a tree after exporting, then imports an older file from B that still has that tree live. The tree stays deleted.
  - A phone importing its own export is a no-op.
  - Changing `active-plan` sets `activePlanChanged`.
  - `parseSyncFile('{')`, `parseSyncFile('{"format":"x"}')` and version 2 each throw `SyncError`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(core): sync file export, parse, and merge`.

---

### Task 11: Report text and CSV

**Files:**
- Create: `src/core/report.ts`
- Test: `tests/core/report.test.ts`

**Interfaces:**
- Consumes: `Recommendation`, `Tree`. `ReportInput` is self-contained; Task 15 builds it from `Derived`.
- Produces:
  - `interface ReportInput { rows: { lengthFt: number; minCirc: number; needed: number; have: number; toCut: number }[]; logs: { lengthFt: number; smallCirc: number; quantity: number; source: 'tree' | 'manual' }[]; extras: number; rec: Recommendation | null; trees: Tree[]; generatedAt: number; planVersion: number }`
  - `reportText(r: ReportInput): string`, with these sections in order:
    1. "TreeTracker report", date, plan version
    2. Logs we have (grouped by length × circumference)
    3. Logs still needed
    4. Next trees to cut (waist circumference "in around at waist height")
    5. Trees still needed ("About N (+M spare)" or "Cannot be finished with current trees: …")
    6. Prediction error (average absolute error in inches, once any tree has a prediction)
  - `reportCsv(r: ReportInput): string`, with columns `section,length_ft,circumference_in,needed,have,still_to_cut,quantity,source`.

- [ ] **Step 1: Write failing tests:**
  - The text contains each section heading.
  - Each row's totals appear as in the input.
  - The text never matches `/diameter|across|tree length/i`.
  - The CSV has a header plus one line per row and per log group.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(core): shareable report text and CSV`.

---

### Task 12: Store (IndexedDB repo, local device info, derive, actions, worker)

**Files:**
- Create: `src/store/db.ts`, `src/store/local.ts`, `src/store/derive.ts`, `src/store/actions.ts`, `src/store/recommend.worker.ts`, `src/store/app-state.tsx`
- Test: `tests/store/store.test.ts` (uses `fake-indexeddb/auto`)

**Interfaces:**
- Produces:
  - `db.ts`: `openRepo(name = 'treetracker'): Promise<Repo>`, where `interface Repo { all(): Promise<AnyRecord[]>; put(recs: AnyRecord[]): Promise<void> }`. It uses one object store, `records`, keyed by `id`. On first open with an empty store, it puts `seedRecords()`.
  - `local.ts`: `getDevice(): { id: string; name: string }` (generates and persists a UUID on first call), `setDeviceName(n)`, and `getSyncTimes()` / `setSyncTimes({ lastExport?, lastImport?, lastImportSummary? })`, all stored in `localStorage` under the key `treetracker.local`.
  - `derive.ts`: `deriveState(records: AnyRecord[]): Derived`, where `interface Derived { settings: Settings; plan: PlanVersion; activeRows: NeedRow[]; rowViews: { row: NeedRow; have: number; toCut: number; done: boolean }[]; extras: { log: LogCut; count: number }[]; trees: Tree[]; logs: LogCut[]; remaining: PlannerRow[]; totals: { needed: number; have: number } }`
    - Active rows are non-deleted rows with `planVersionId === active.planVersionId` or `planVersionId === null`.
    - Trees are sorted newest first, logs newest first.
  - `actions.ts`: `createActions(clock: Clock, device: { id: string }, now: () => number)`, which returns pure functions that take `records: AnyRecord[]` (and `Derived` where needed) and return `AnyRecord[]` to put:
    - `submitTree(input: { lengthFt; buttCirc; readings; warningsOverridden; notes? }, records): { tree: Tree; logs: LogCut[] }`. Before adding the tree, it computes `predicted` from `predictProfile(waist, existingTrees)`, the predicted plan's `largestClassCount`, and the predicted readings at the tree's stations. `actualLargeLogs` comes from the real plan.
    - `undoSubmit(treeId, records)`, which tombstones the tree and its tree logs.
    - `addManualLog({ lengthFt; smallCirc; quantity })`. `lengthFt` is rounded up to whole feet with `Math.ceil`.
    - `updateRecord(rec, patch)`. Editing a tree recomputes its `waistCirc` and leaves its plan and logs unchanged. Editing a generated need row sets `manuallyEdited: true`.
    - `deleteRecord(rec, records)`. Deleting a tree also tombstones its tree logs.
    - `addNeedRow({ lengthFt; minCirc; quantity })`, with `planVersionId: null`.
    - `acceptPlan(cand: CandidatePlan, records)`. It creates a `PlanVersion` (version = max + 1, other side copied from active), its rows with `needRowId` ids, tombstones the previous version's generated rows, and points `active-plan` at it.
    - `undoPlan(records)`. It activates the previous version number, regenerates its rows (same ids, `deleted: false`, new HLC), and tombstones the current version's rows.
    - `editWalls(wall: WallSettings, records)`, which creates a new version with the same courses and the new wall settings (via the `acceptPlan` path).
    - `updateSettings(patch)`.
    - Every returned record gets `updatedAt: clock.tick()` and `deviceId: device.id`.
  - `recommend.worker.ts`: receives `{ remaining, trees, settings, maxEnteredWaist }`, runs `recommend` (normal max) and, if there are trees, `recommend` with `maxWaist = maxEnteredWaist` for the shortfall check, then posts `{ rec, shortfall }`.
  - `app-state.tsx`: `AppStateProvider` and `useApp(): { records; derived; rec: Recommendation | null; shortfall: ShortfallSignal[]; busy: boolean; do(fn: (records, derived) => AnyRecord[]): Promise<void>; importText(text: string): Promise<MergeSummary> }`. `do` puts the records, reloads them, re-derives, and re-posts to the worker (debounced 150 ms). `importText` calls `clock.receive(maxHlc)` after merging.

- [ ] **Step 1: Write failing tests** (`tests/store/store.test.ts`):
  - A fresh repo has 17 active rows summing to 138.
  - Reopening the same db name returns the same records (persistence).
  - `submitTree(synthetic)` creates one tree and N logs (N = cuts) and lowers `Σ toCut` by N. `undoSubmit` restores `Σ toCut` to 138.
  - Deleting a tree also removes its logs from `have`.
  - Editing a log's circumference below its row's minimum moves it to extras or a smaller row.
  - A manual 9.2 ft log is stored as 10 ft.
  - The manual log leaves `predictProfile` output unchanged (manual logs never feed averages).
  - `acceptPlan(11×25.2 exterior)` gives active rows of 77 exterior + 68 interior pieces, and no log is deleted (the count of non-deleted logs is unchanged). `undoPlan` brings back exactly the v1 rows.
  - Review Focus 4: after 20 manual 16 ft, 30 in logs, the `16|28.3` row shows have 8 and toCut 0, and the extras include the surplus.
- [ ] **Step 2:** Run `npx vitest run tests/store`. Expected: FAIL.
- [ ] **Step 3:** Implement, using `idb` for the repo and `crypto.randomUUID()` for ids.
- [ ] **Step 4:** Run `npm test`. Expected: all core and store tests PASS.
- [ ] **Step 5:** Commit: `feat(store): IndexedDB repo, derived state, actions, worker`.

---

### Task 13: UI components and router

**Files:**
- Create: `src/ui/components/*.tsx` (Button, NumberField, Tile, ListRow, Sheet, Toast, Pill, Progress, Banner), `src/ui/router.tsx`. Modify: `src/ui/main.tsx`, `src/ui/theme.css`
- Test: covered by e2e in Task 16 (a component gallery route `#/dev/components` renders every component in every state, for the visual check)

**Interfaces:**
- Produces:
  - `useRoute(): string`, `navigate(path: string)`, with hash routes `#/`, `#/plan/:treeId`, `#/add-logs`, `#/needed`, `#/cut`, `#/trees`, `#/reports`, `#/settings`, `#/sync`, `#/wall`
  - `<Button variant="raised" | "primary" disabled? onClick>`
  - `<NumberField label value onInput error? warning? enterKeyHint="next" | "done" onEnter>`, which is an inset field with `inputmode="decimal"`
  - `<Tile value caption>`, a large raised tile showing `big-num`
  - `<ListRow title detail tag? onEdit>`
  - `<Sheet open title onClose>{children}</Sheet>`, a bottom sheet
  - `<Toast message actionLabel onAction timeoutMs>`
  - `<Pill tone="blue" | "neutral">`
  - `<Progress value max label>`, an inset track with a green fill and a numeric label
  - `<Banner tone="warn" title actionLabel onAction>`

- [ ] **Step 1:** Implement the components to the §9 rules:
  - Pressed buttons swap to `--inset`.
  - Disabled buttons have reduced opacity and the label "(unavailable)" for screen readers.
  - Error fields get a graphite 2 px border and an error text line. Warnings are shown as text with an "Ignore warning" checkbox.
- [ ] **Step 2:** Add the `#/dev/components` gallery showing every component in every state (§ Handoff 3 list).
- [ ] **Step 3:** Run `npm run build`. Expected: exits 0.
- [ ] **Step 4:** Commit: `feat(ui): neumorphic components and router`.

---

### Task 14: Main, Cut plan, Add logs, Logs needed, Logs cut, and Trees cut screens

**Files:**
- Create: `src/ui/screens/Main.tsx`, `CutPlan.tsx`, `AddLogs.tsx`, `LogsNeeded.tsx`, `LogsCut.tsx`, `TreesCut.tsx`, plus edit sheets inside each
- Test: `e2e/core-flows.spec.ts` (written in Task 16 against these screens)

**Interfaces:**
- Consumes: `useApp`, the actions from Task 12, the components from Task 13, `readingStations`, `validateTree`.

- [ ] **Step 1: Main** (§7.1):
  - Title "Next 3 trees to cut", then three `Tile`s with `` `${v.toFixed(1)} in` `` and the caption "around at waist height". While the worker is busy, show "Working…" in the tiles.
  - Below the tiles, the line "About N more trees (+M spare)" or the unfillable message.
  - A `Banner` for each shortfall signal, with the action "Review wall plan" going to `#/wall`.
  - The form:
    - "Tree length cut (ft)"
    - "Circumference at butt (in)"
    - Then one "Circumference at X ft (in)" field per `readingStations(length)`, regenerated when the length changes and keeping the values already typed.
    - The Next key moves down the fields.
  - The "Submit tree" primary button stays disabled while there are errors. When there are warnings, an "Ignore warnings" checkbox is required before submitting.
  - On submit, run the action, navigate to `#/plan/<id>`, and show the undo toast for `settings.undoSeconds`.
  - The button grid: Add logs, Logs needed, Logs cut, Trees cut, Reports, Wall plan, Settings, Sync.
  - A `Pill` showing "Last sync: <relative time>" or "Not synced yet".
- [ ] **Step 2: Cut plan** (§7.2):
  - The ordered cuts: "1. 16 ft log, 2.0–194.0 in from butt, small end 30.1 in around".
  - The leftover line.
  - "No needed logs fit this tree" when there are no cuts.
  - Buttons: Edit logs (goes to `#/cut` filtered to this tree), Done (goes to `#/`).
  - The toast's Undo calls `undoSubmit`.
- [ ] **Step 3: Add logs:** length (ft), small-end circumference (in), quantity (default 1), and an Add button. Below them, the last 10 manual logs, each editable.
- [ ] **Step 4: Logs needed:**
  - A `Progress` of logs done against needed, and the "Plan version N" label.
  - Rows: "16 ft · 28.3 in around — need 8 · have 3 · to cut 5". Done rows get a ✓ label and a green left border.
  - An Extras section.
  - An "Add row" button.
  - A tap on a row opens a `Sheet` to edit or delete it, with a confirmation for delete.
- [ ] **Step 5: Logs cut:** every log, newest first, tagged "from tree" or "by hand". A tap opens the edit and delete sheet. The `?tree=<id>` filter is supported.
- [ ] **Step 6: Trees cut:**
  - Each tree shows its date, length as entered, butt circumference, readings, estimated waist circumference, its cut plan, and, when present, prediction error ("Model expected 30.9 in at 12 ft; measured 30.2 in").
  - A tap opens the edit sheet (measurements and notes) or delete, which also removes its logs, after a confirmation.
- [ ] **Step 7:** Run `npm run build` and `npm run dev`, then open the screens in the preinstalled Chromium at 390×844. Check by eye:
  - There is no horizontal scroll at 360 px wide.
  - No text mentions diameter, across, or a recommended length.
- [ ] **Step 8:** Commit: `feat(ui): main, cut plan, logs, and trees screens`.

---

### Task 15: Reports, Settings, Sync, and Wall plan screens, plus file sharing

**Files:**
- Create: `src/ui/screens/Reports.tsx`, `Settings.tsx`, `Sync.tsx`, `WallPlan.tsx`, `src/platform/share.ts`, `capacitor.config.ts`

**Interfaces:**
- Produces, in `src/platform/share.ts`:
  - `shareFile(fileName: string, mime: string, content: string): Promise<void>`. On native (`Capacitor.isNativePlatform()`), it writes to `Directory.Cache` with `Filesystem.writeFile` (UTF-8) and then calls `Share.share({ files: [uri] })`. On the web it triggers a Blob download.
  - `shareText(title: string, text: string): Promise<void>`
  - `pickTextFile(): Promise<string | null>`, using a hidden `<input type="file" accept=".json,application/json">`.
- `capacitor.config.ts`: `appId: 'com.nuttynootka.treetracker'`, `appName: 'TreeTracker'`, `webDir: 'dist'`.

- [ ] **Step 1: Reports:** the `reportText` preview, plus "Share as text", "Share as file (.txt)" and "Share as spreadsheet (.csv)".
- [ ] **Step 2: Settings:** every `SettingsValues` field with its unit label, the device name, and a "Font licenses" link that opens `licenses/…txt`. Saving calls `updateSettings`.
- [ ] **Step 3: Sync:**
  - "Export sync file", which uses `buildExport` and `shareFile` with `syncFileName`, and records `lastExport`.
  - "Import sync file", which uses `pickTextFile` and `importText`, and shows the summary "12 added, 3 updated, 1 deleted".
  - If the active plan changed, a banner: "The wall plan was changed on the other phone. Logs needed has been updated."
  - Last export and import times.
  - The hint "Export on one phone, import on the other, then do the same the other way."
  - A reminder that export is the backup, with the days since the last export.
  - `SyncError` messages are shown as they are.
- [ ] **Step 4: Wall plan:**
  - The active version's exterior and interior course lists (bottom to top), each with its total height and target.
  - "Check supply", which shows the current shortfall signals, or "No shortfall found" with the evidence.
  - "Build alternative plans":
    - Shows the editable allowed classes (checkboxes for 28.3, 25.2, 18.9, 15.8, 12.6) prefilled from `supplyableClasses`.
    - Shows up to 3 `candidatePlans` per side as cards with the `comparePlan` numbers.
    - Each card has Accept (with a confirmation that hand edits to generated rows will not carry over), Edit (a hand course list, then regenerate the comparison), and Dismiss.
  - Version history with Undo (`undoPlan`), disabled at version 1.
  - "Edit walls": wall centerline lengths, the door wall toggle, the interior piece lengths, post and tenon, heights, tolerance, and course height per class. Saving creates a new version through `editWalls`.
- [ ] **Step 5:** Run `npm run build`. Expected: exits 0.
- [ ] **Step 6:** Commit: `feat(ui): reports, settings, sync, wall plan screens and sharing`.

---

### Task 16: End-to-end tests at phone width

**Files:**
- Create: `playwright.config.ts`, `e2e/core-flows.spec.ts`, `e2e/sync.spec.ts`, `e2e/wall.spec.ts`

**Interfaces:**
- Consumes: the built app served by `vite preview` (Playwright `webServer`, with `command: 'npm run build && npx vite preview --port 4173'`).
- Config: viewport 360×800, `use.browserName: 'chromium'`. Locally, the preinstalled browsers are found via `PLAYWRIGHT_BROWSERS_PATH`.

- [ ] **Step 1: Write `core-flows.spec.ts`:**
  - The main page shows 3 tiles that match `/^\d+\.\d in$/` and the text "around at waist height".
  - Enter the synthetic tree. Typing 34 shows exactly 5 reading fields. Then Submit.
  - The cut plan lists ≥ 2 cuts. Logs needed shows a to-cut total of 138 − cuts.
  - Undo restores 138.
  - Submit the tree again, delete it on Trees cut, and the total returns to 138.
  - Reload the page and the data persists.
  - `document.body.innerText` never matches `/diameter|across/i`.
  - On Main and Reports, no text matches `/\d+(\.\d+)?\s*ft tree|tree.*\d+\s*ft long/i`, so no tree length is shown as advice.
  - `scrollWidth ≤ 360` on every screen.
- [ ] **Step 2: Write `sync.spec.ts`:**
  - Use two browser contexts (A and B). A submits a tree, B adds a manual log.
  - Export from each: intercept the download, then feed it through the import file chooser.
  - Both show identical Logs needed totals.
  - A second import reports "0 added, 0 updated, 0 deleted".
- [ ] **Step 3: Write `wall.spec.ts`:**
  - In Wall plan, uncheck 28.3, build alternatives, and accept 11 × 25.2.
  - Logs needed shows 16 ft · 25.2 in need 22.
  - Undo returns 16 ft · 28.3 in need 8.
- [ ] **Step 4:** Run `npm run e2e`. Expected: all specs PASS. Fix any app bugs these tests reveal in the owning screen, not by loosening the test.
- [ ] **Step 5:** Commit: `test(e2e): core flows, file sync, wall plan at phone width`.

---

### Task 17: Android project, signing, CI APK build, and install guide

**Files:**
- Create: `android/` (generated), `android-signing/treetracker.jks`, `android-signing/signing.properties`, `.github/workflows/android.yml`, `docs/INSTALL.md`, `README.md`
- Modify: `android/app/build.gradle`, `package.json` (add the `cap:sync` script)

**Interfaces:**
- Consumes: `capacitor.config.ts` from Task 15.

- [ ] **Step 1:** Run `npm run build && npx cap add android && npx cap sync android`. Expected: `android/` is created. An Android SDK is not needed for this step. If `cap add` fails without an SDK, report the error rather than working around it silently.
- [ ] **Step 2:** Generate the key:

  ```bash
  keytool -genkeypair -v -keystore android-signing/treetracker.jks -alias treetracker \
    -keyalg RSA -keysize 2048 -validity 36500 -storepass treetracker-owner -keypass treetracker-owner \
    -dname "CN=TreeTracker, O=Owner"
  ```

  Write `signing.properties` with `storeFile=../../android-signing/treetracker.jks`, `storePassword`, `keyAlias` and `keyPassword`. This is committed on purpose (owner choice B).
- [ ] **Step 3:** In `android/app/build.gradle`:
  - Load `signing.properties` and add `signingConfigs.release`. Set `buildTypes.release.signingConfig signingConfigs.release` and `minifyEnabled false`.
  - Set `versionCode` from the `-PversionCode` Gradle property (default 1) and `versionName "1.0.<versionCode>"`.
- [ ] **Step 4:** Write `.github/workflows/android.yml`:
  - Triggers: `push` to `main` and `claude/**`, plus `workflow_dispatch`. `permissions: contents: write`.
  - Steps:
    1. checkout
    2. setup-node 22 with npm cache
    3. setup-java Temurin 21
    4. `npm ci`
    5. `npm test`
    6. `npx playwright install --with-deps chromium && npm run e2e`
    7. `npm run build && npx cap sync android`
    8. `cd android && ./gradlew assembleRelease -PversionCode=${{ github.run_number }}`
    9. Rename to `TreeTracker-1.0.${{ github.run_number }}.apk` and upload it as an artifact.
    10. `gh release delete latest --cleanup-tag -y || true`, then `gh release create latest <apk> --title "TreeTracker (latest build)" --notes "Built from ${{ github.sha }}" --target ${{ github.sha }}`, with `GH_TOKEN: ${{ github.token }}`.
- [ ] **Step 5:** Write `docs/INSTALL.md` for the owner. Every step, including the obvious ones:
  - Where Releases is on the repository page on a phone browser ("Releases" in the right-hand column on desktop, or under the "About" section on mobile).
  - Tapping the `.apk` file under Assets.
  - Opening the download.
  - Allowing "Install unknown apps" for the browser (Settings → Apps → Special app access → Install unknown apps → Chrome → Allow; the menu names can differ by phone maker).
  - Installing, opening TreeTracker, and giving the phone a name in Settings.
  - Updating: export a sync file first as a backup, then install the newer APK over the old one, which keeps the data because the same key signs every build.
  - Syncing both phones, step by step.
  - What erases data (uninstalling, Clear storage).
  - How to see whether a build failed (the Actions tab, red ✗) and how to re-run it (open the run → "Re-run jobs").
- [ ] **Step 6:** Write `README.md`: what the app is, a link to `docs/INSTALL.md`, `npm test`, `npm run e2e`, and the folder map.
- [ ] **Step 7:** Run `npm test && npm run e2e && npm run build`. Expected: all pass. Commit `feat: Android project, signing, CI APK release, install guide` and push. Then check the GitHub Actions run with the GitHub tools:
  - Expected: green, and a "latest" release with the APK.
  - If it is red, read the job logs, fix the cause, and push again, until the run is green.

---

### Task 18: Final review and owner hand-off

- [ ] **Step 1:** Run the full suite (`npm test`, `npm run e2e`, `npm run typecheck`) and record the output.
- [ ] **Step 2:** Run a whole-branch review with superpowers:requesting-code-review against this plan and the spec, and fix the confirmed findings.
- [ ] **Step 3:** Report to the owner:
  - The benchmark counts.
  - Any change to the weight formula.
  - The CI run link and the release link.
  - What the owner must test on the phones (spec §11 stages 1 and 8: airplane mode, closing the app, glare, gloves, speed).
