# TreeTracker — Design Spec

Date: 2026-10-20
Status: awaiting owner review

Sources: Handoff 1 (requirements, updated), Handoff 2 (build brief, updated), Handoff 3 (visual design brief), Addendum (recalculate logs needed when supply falls short), and the owner's answers in the design conversation. Where this spec differs from those documents, this spec records the owner's later decision.

## 1. Purpose

An installable, offline Android app for two people building a log cabin from noble fir trees on their own land. It answers three questions:

1. Which trees should we cut next? (shown only as circumference at waist height)
2. How should each tree we cut be divided into logs?
3. Which logs do we have, and which do we still need?

It improves its recommendations as trees are measured, and it can propose a new wall course plan when the trees cannot supply the logs the current plan needs.

## 2. Owner decisions (settled)

- App name: **TreeTracker**.
- Every thickness is a circumference in inches. The app never asks for or shows a diameter or an "across" size.
- Tree length is entered as actually cut, used exactly, never rounded, never recommended. No screen ever shows a tree length as advice.
- Only log lengths are rounded, up to whole feet.
- The add-tree form has tree length, butt circumference, and a circumference every 6 ft. No waist-height field.
- Bark is ignored.
- Fonts: Antonio (titles, buttons, big numbers) and DM Sans (labels, entries, body), bundled with their license files.
- Palette: the Frost Slate tokens (section 9). Light theme only. Heavy neumorphic styling.
- Next 3 recommended trees on the main screen.
- Manual editing on every screen. Logs added by hand never affect tree averages.
- **Sync is by file export and import only, in both directions.** No wifi, hotspot, network discovery or native server. (This overrides the wifi sync text in Handoffs 1 and 2.)
- **No optional extras** from Handoff 3 (no trunk diagram, dials, log tray, bright-light mode, or submit animation/haptic).
- **No window openings and no interior doorways** in the wall model. Logs are cut to fit both during building.
- Stack: web UI wrapped with Capacitor (choice A).
- APK signing: a single signing key file is committed to the repository (choice B), so every update installs over the previous one without losing data. Accepted risk: anyone who can see the repository could sign an app that Android would accept as an update.
- Addendum questions, all answered with the proposed defaults:
  - Wall height target 84 in, accepted range 82 to 88.5 in (editable tolerance; widened from 88 by the owner so 11 courses of 25.2 in, 88.2 in, qualify).
  - Largest courses at the bottom; no course larger around than the one below it.
  - Course height defaults to circumference ÷ π, editable per circumference class.
  - Windows not modelled now.
  - Shortfall: the app warns with evidence and offers a "Build alternative plans" button; it never builds or changes a plan unless the owner taps it, and nothing changes until Accept.
  - Interior courses get the same recalculation.

## 3. Architecture

- **Stack:** TypeScript, Vite, Preact, wrapped with Capacitor for Android. Tests with Vitest (logic) and Playwright against the bundled Chromium (screens at phone width).
- **Layers:**
  - `src/core/` — pure TypeScript, no UI or storage: units, tree profile, need matching, cut planner, recommender, wall model, plan recalculation, hybrid logical clock, merge, sync file format, report text. Fully unit-tested.
  - `src/store/` — IndexedDB persistence of records; produces derived state by calling core.
  - `src/ui/` — Preact screens and components.
- **Derived, not stored:** "have", "still to cut", extras, recommendations, the trees-needed estimate and shortfall signals are recomputed from records after every change. Editing or deleting any record therefore reverses its effects automatically. Undo after Submit is a soft delete of the tree and its logs.
- **Storage:** IndexedDB inside the app WebView. Survives closing the app and airplane mode. Clearing the app's data in Android settings or uninstalling erases it, so Export doubles as a backup, and the Sync screen shows how long since the last export.
- **Native plugins (official Capacitor only):** Filesystem and Share for exporting files and reports; a file input for importing.

## 4. Data model

Every record has: `id` (random UUID), `updatedAt` (hybrid logical clock string), `deleted` (tombstone flag), `deviceId` (last editor).

- **Tree:** `createdAt`, `lengthFt` (as entered), `buttCirc`, `readings` (circumference at 6, 12, 18 … ft), `waistCirc` (estimated, section 5.2), `plan` (the cuts it received), `predicted` (what the model predicted for a tree of this waist size before this tree was added), `warningsOverridden`, `notes`.
- **LogCut:** `source` (`tree` | `manual`), `treeId` (if from a tree), `lengthFt` (whole feet), `smallCirc`, `quantity`.
- **NeedRow:** `lengthFt`, `minCirc`, `quantity`, `planVersionId` (version that generated it; null if added by hand), `manuallyEdited`.
- **PlanVersion:** `version` number, `exteriorCourses` and `interiorCourses` (circumference lists bottom to top), the wall-model settings used, `createdBy` (device), `createdAt`, `note`.
- **ActivePlan:** a single record pointing at the active PlanVersion.
- **Settings:** a single record (section 5.1 and 5.6 values).

Device id is generated on first launch and stored locally. Each device can be given a short name (e.g. "Jess's phone") in Settings.

## 5. Core logic

### 5.1 Settings (editable)

| Setting | Default |
| --- | --- |
| Saw kerf | 0.375 in |
| Butt trim | 2 in |
| Stump height | 1 ft |
| Waist height | 4 ft |
| Largest waist circumference to recommend | 37.7 in |
| Maximum tree length | none (learned from entered lengths) |
| Top circumference (end of usable trunk) | 12.6 in |
| Default taper (prior) | 0.59 in circumference per ft |
| Corner post width | 13 in |
| Tenon length | 3 in |
| Exterior wall height of logs | 84 in |
| Interior wall height of logs | 84 in |
| Wall height tolerance | −2 in / +4.5 in (82 to 88.5 in) |
| Course height per circumference class | circumference ÷ π |

### 5.2 Tree profile and waist circumference

- c(x), x in feet from the butt (the cut face): points at 0 (butt), 6, 12 … for each reading, and a final point (entered length, 12.6 in). Linear interpolation. Length used exactly.
- Readings shown on the form: one field for every 6 ft step strictly below the entered length (a 34 ft tree shows 6, 12, 18, 24, 30).
- Warn, but allow override, if a reading is larger than the one below it, if a reading is below 12.6 in before the top, or if a value is outside 5–80 in (circumference) or 4–120 ft (length).
- Waist circumference = c(waist height − stump height) = c(3 ft). If that position is ≤ 0, use the butt circumference.

### 5.3 Matching logs to need rows

A log fills a row if it is at least as long and at least as large around at the small end. Assignment is the addendum's greedy pass, used everywhere (on-screen totals, after plan changes, after sync):

- Rows sorted longest first, then largest circumference first.
- Each row takes, one at a time, the smallest cut log that fits it (shortest, then smallest around), until the row is full or no log fits.
- Logs that fill nothing are **extra**. They are shown on Logs needed and never deleted.
- Manual logs are matched the same way and never feed averages.

### 5.4 Cut planner

- Pieces are the need rows with remaining quantity > 0. A piece of N ft is cut exactly N ft long.
- Cutting starts after the butt trim, from the butt up, with one kerf between pieces. A piece starting at s (inches from the butt) is feasible if c(s + 12N) ≥ its minimum circumference and s + 12N ≤ the tree length.
- Search (as built): on a trunk that never gets thicker going up, any feasible set of pieces stays feasible when the pieces needing the largest circumference are cut lowest, and pieces are cut back to back. So the planner decides, class by class from the largest minimum circumference down, how many pieces of each length to take, with dynamic programming over (class, total feet, number of pieces). It is exact and is checked against exhaustive search. If the owner overrode an increasing-reading warning, the planner uses a conservative outline of the trunk that is never thicker than any point below it, so no planned log is thinner than its row needs.
- Objective: maximise the total weight of pieces that fill still-needed rows, never more than a row's remaining quantity. Weight per piece = length in ft × (min circumference ÷ 12.6) × (1 + remaining ÷ quantity), where remaining is the row's count when the tree is planned. Tie-break: least waste (more inches cut into pieces).
- Output: ordered cuts with start and end positions from the butt, length, expected small-end circumference, the row each fills, and what is left at the top (length and circumference).
- On Submit, each planned piece becomes a LogCut (source tree) whose small-end circumference is the expected value from the profile. The owner can edit any of them.

### 5.5 Recommendations and trees-needed estimate

- Candidates: waist circumferences from 22 in up to the largest-to-recommend setting, in 1 in steps (the setting itself is always included as a candidate).
- For each candidate, predict a profile and an internal length (never displayed), run the planner on the remaining needs, and score it as total weight ÷ waist².
- Pick the best, deduct its simulated yield, and repeat. The first 3 are shown as waist circumferences. Sizes may repeat.
- Trees still needed: continue the same loop until every row is met, and count the trees. Show about 10% spare separately (rounded up). If the needs cannot be met by any candidate, say so and show which rows are unfillable instead of a number.
- Prediction:
  - Prior: linear taper of 0.59 in/ft from the waist circumference (so the butt is waist + 3 × 0.59), with length running until circumference reaches 12.6 in. No length cap.
  - Measured trees (source tree only, not deleted): for each tree, ratios of c(x) ÷ waist at 0, 6, 12 … ft, and length ÷ waist.
  - Blend: for each candidate, weight each measured tree by its closeness in waist size (Gaussian kernel, σ = 3 in). The prior counts as 5 trees' worth of weight that fades linearly to zero as 5 trees are measured. The predicted profile is the weighted average of ratios × candidate waist. The predicted length is the weighted average of length ÷ waist × candidate waist.
  - Learned length cap: once trees are measured, the predicted length never exceeds 110% of the longest tree entered so far.
- Prediction error: on Submit, the model's prediction for the new tree's waist size (made before adding it) is stored. Trees cut and Reports show predicted versus actual circumference at each reading and length, and the average error.

**Benchmark gate (stage 3).** With the starting list, the 0.59 in/ft taper, perfect cutting, and the limit expressed at the butt cut face:

- Limit 39.6 in at the cut face → about 40 trees (about 17 at 39.6 and about 23 at 36.5).
- Limit 37.7 in at the cut face → about 45 trees (about 28 at 37.7 and about 17 at 34.6). As built: at exactly 37.7 in the 16 ft logs needing 28.3 in cannot be cut (their small end measures 28.16 in after the 2 in butt trim; 28.26 in even with no trim), so the test uses 37.85 in, the smallest cut face where they can be cut.
- Results as built: 39.6 → 41 trees; 39.47 → 45; 37.85 → 46; 37.7, 34.6, and 39.6 with 0.79 in/ft → cannot be finished.

The estimator is run in this configuration (prior only, candidates by butt circumference) as a test. If it lands well away from these numbers, it is investigated before building further. Also tested: the count is impossible at a 34.6 in cut-face limit or a 0.79 in/ft taper. Note: 37.7 in at waist plus 3 × 0.59 is 39.47 in at the cut face, not 39.6, so the test runs at both values.

### 5.6 Wall model and logs-needed generation (addendum)

- Exterior walls (centerline length in inches): W1 120, W2 96 (door wall, no logs), W3 192, W4 144, W5 192, W6 96, W7 120, W8 120.
- Finished piece = round(centerline − post width + 2 × tenon) to the nearest inch. Each wall with logs needs one piece per exterior course.
- Interior: every interior course uses pieces of 48, 48, 60 and 62 in. No doorways.
- Rows: round each piece up to whole feet, then group by (rounded length, course circumference).
- Course heights stack to the wall height. Course height is taken from the per-class setting (default circumference ÷ π).
- Plan version 1: exterior 4 × 28.3 then 6 × 25.2; interior 4 × 18.9, 8 × 15.8, 5 × 12.6.
- Tests: version 1 generates exactly the 17 rows and 138 logs. Exterior 11 × 25.2 gives 16 ft × 22, 12 ft × 11, 10 ft × 33, 8 ft × 11 (77 pieces). 10 × 25.2 gives 70 pieces, 9 × 28.3 gives 63 pieces.
- Exterior walls and interior pieces are stored as editable data on the Wall plan screen, so the model can be corrected without a new app version.

### 5.7 Shortfall detection and plan recalculation (addendum)

- Signals (shown with their evidence):
  - (a) Unfillable rows: the estimator cannot fill some row with any candidate up to the largest waist circumference the owner has actually entered (no signal before the first tree).
  - (b) Low large-log yield: after at least 3 measured trees, those trees gave less than 60% of the largest-class logs the model predicted for them.
  - (c) The owner taps Check supply.
- Thresholds (60%, 3 trees) are editable in Settings.
- Supplyable classes: start from classes with logs already cut or that the estimator can fill. The owner can edit the list.
- Candidate plans (separately for exterior and interior): every non-increasing sequence of allowed classes whose total height is within the tolerance. Ranked by fewest extra pieces, then fewest total linear feet. Show the top 3.
- Each candidate shows: courses bottom to top, total height and difference from the target, rows and quantities, change in total pieces and linear feet, change in trees still needed, and how many cut logs still count.
- Accept stores a new PlanVersion, makes it active, and regenerates need rows (old rows are tombstoned, not destroyed; old versions are kept). Undo makes the previous version active again and regenerates its rows. Edit lets the owner change the course list by hand and regenerate. Dismiss changes nothing.
- A recalculation never deletes a cut log and never changes tree averages.
- Manual edits to rows of the active version are allowed and marked as edited. A plan change shows a confirmation that hand edits to the old version's rows will not carry over.

## 6. Sync by file

- Export: one JSON file (`treetracker-sync-<device>-<date>.json`) with format version, device id and name, export time, and every record including tombstones, plan versions, the active plan and settings. Sent with the Android share sheet (message, email, Drive, Bluetooth, Files).
- Import: choose the file. Merge record by record by `id`: the higher hybrid logical clock wins, tombstones included. Unknown format versions are refused with a clear message.
- After import: summary ("12 added, 3 updated, 1 deleted"), a notice if the active wall plan changed, and a recompute of everything. Importing the same file twice changes nothing.
- Two phones that export to each other and import end with identical records and totals.
- Settings sync like any record (newest wins), except device id and device name, which stay local.

## 7. Screens

Everything reachable within 2 taps of Main. Portrait, 360–412 dp wide.

1. **Main** — "Next 3 trees to cut": three raised tiles, each a big waist circumference with the caption "around at waist height" (no length ever). Tree-count line: "About N more trees (+M spare)". Shortfall banner if a signal is active. Add-tree form: Tree length cut (ft), Circumference at butt (in), Circumference at 6 ft (in) … generated from the length, decimal keypad, Next moves down. Large green "Submit tree" button. Button grid: Add logs, Logs needed, Logs cut, Trees cut, Reports, Wall plan, Settings, Sync. Blue sync pill with time since last export or import.
2. **Cut plan result** — ordered cuts from the butt (length, start–end position, expected small-end circumference, row filled), leftover top, undo toast for 10 seconds, Edit and Done.
3. **Add logs** — length (ft), small-end circumference (in), quantity, Add; recent manual entries list.
4. **Logs needed** — rows of length × circumference with needed, have and still-to-cut, a done mark on complete rows, a progress bar of logs done versus needed, an Extras section, and Add row. Shows the active plan version.
5. **Logs cut** — all logs, labelled "from tree" or "by hand", each editable.
6. **Trees cut** — each tree with its measurements, waist estimate, the plan it got, and prediction error.
7. **Reports** — logs we have, logs still needed, next recommended trees, trees still needed, prediction error. Share as text or as a .txt or .csv file.
8. **Edit sheet** — bottom sheet to change or delete any record, with a confirmation step for delete.
9. **Settings** — all settings in sections 5.1 and 5.7, plus device name.
10. **Sync** — Export, Import, last export and import times, last import summary.
11. **Wall plan** — active version's courses (exterior and interior), total heights, Check supply, Build alternative plans, candidate comparison with Accept / Edit / Dismiss, version history with Undo, and editable wall and piece lengths.

## 8. Error handling

- Form validation inline with plain-language messages. Warnings (implausible readings) can be overridden. Errors (missing length, non-numbers) cannot.
- The planner returning no pieces is shown as "No needed logs fit this tree", and the tree is still saved for the averages.
- Storage failures are shown with a prompt to export a backup.
- Import of a bad or wrong file changes nothing and says why.

## 9. Visual design

| Token | Value |
| --- | --- |
| base | #E0E5EA |
| graphite | #272C32 |
| ink2 | #515960 |
| green | #5F8A79 |
| blue | #6F90B0 |
| text-on-green | #171B1F |
| text-on-blue | #171B1F |
| shadow-dark | #BABEC2 |
| shadow-light | #F7F8FA |

- Raised: 6 px offset, 12 px blur (large cards 10 / 22), dark down-right, light up-left. Inset: same pair inset, 4 / 8. Buttons go inset when pressed.
- Radii 12–26 dp. Spacing scale 4, 8, 12, 16, 24, 32 dp.
- Type: Antonio bold 38 sp titles, 30 sp big numbers. DM Sans 600 13–14 sp labels, 17 sp entries.
- Focus: 3 px graphite outline. Selected: colour and label change. Never shadow alone. Text contrast at least 4.5:1.
- Tap targets at least 48 dp, with generous gaps. Primary actions at the bottom within thumb reach.
- Fonts bundled as woff2 with their SIL Open Font License files.

## 10. Build and delivery

- GitHub Actions on every push to the working branch and to main: install, test, build the web app, sync Capacitor, build a signed release APK with the committed key, upload it as a workflow artifact, and attach it to a GitHub Release named "latest".
- The signing key file and its passwords are committed under `android-signing/` (owner choice B).
- Owner guide (`docs/INSTALL.md`): every step from opening GitHub on the phone to downloading the APK, allowing installs from the browser, installing, updating, and exporting a backup before updating.

## 11. Build stages and acceptance checks

1. **Shell and storage:** screens, navigation, theme, fonts, forms, edit sheets, IndexedDB. Check data survives a reload (automated) and app close and airplane mode (owner, on the phone).
2. **Needs and planner:** seed plan version 1. Synthetic tree (34 ft; 42.4, then 34.6, 30.2, 26.4, 22.0, 17.6 in) gets a sensible plan. Submit adds logs and deducts needs, never below zero. Edit and delete reverse it. Planner matches brute force on random small cases.
3. **Recommendations:** next 3 and the estimate change after each tree. Manual logs do not change the averages. No tree length is shown. Benchmark gate passes.
4. **Wall plans:** all addendum worked examples, never deletes logs, undo works, cut logs re-matched.
5. **File sync:** two simulated devices with different edits converge. Deletions and conflicts follow newest-wins. Importing twice is a no-op. The active plan syncs with a notice.
6. **Reports:** each report matches the on-screen lists.
7. **APK and guide:** CI builds and publishes the APK. INSTALL.md written.
8. **Field polish (owner on real phones):** glare, gloves, speed on an older phone. Fix what the owner reports.

## 12. Known limits

- The taper prior, the wall model's course heights and the benchmark are model assumptions, not measurements. The app shows estimates as estimates.
- Claude cannot test on a real phone. Stage 1's airplane-mode check and stage 8 depend on the owner.
- IndexedDB data is lost if the app's data is cleared or the app is uninstalled. Export is the backup.
