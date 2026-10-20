# TreeTracker

An offline Android app for two people building a log cabin from noble fir trees. It plans how to cut each measured tree into logs, tracks the logs needed against the logs cut, recommends the next trees to cut by circumference at waist height, rebuilds the logs-needed list from the wall course plan when the trees can't supply the big logs, and syncs two phones by exporting and importing a file.

- **Install on a phone:** see [docs/INSTALL.md](docs/INSTALL.md).
- **Design:** [docs/superpowers/specs/2026-10-20-treetracker-design.md](docs/superpowers/specs/2026-10-20-treetracker-design.md)
- **Build plan:** [docs/superpowers/plans/2026-10-20-treetracker.md](docs/superpowers/plans/2026-10-20-treetracker.md)

## Developing

```bash
npm install
npm test        # logic tests (Vitest), including the trees-needed benchmark
npm run e2e     # screen tests at 360 px phone width (Playwright)
npm run dev     # run in a browser
npm run build   # build the web app into dist/
npx cap sync android   # copy dist/ into the Android project
```

GitHub Actions (`.github/workflows/android.yml`) runs the tests, builds a signed APK and publishes it as the **latest** release on every push.

## Folders

| Path | What it holds |
| --- | --- |
| `src/core/` | All rules and algorithms, with no UI: tree profile, cut planner, matching, predictions, recommendations, wall model, plan recalculation, sync merge, reports |
| `src/store/` | IndexedDB storage, derived totals, every edit action, background worker for recommendations |
| `src/ui/` | Screens and neumorphic components |
| `src/platform/` | Sharing and picking files on Android |
| `tests/` | Logic tests |
| `e2e/` | Screen tests |
| `android/` | Capacitor Android project |
| `android-signing/` | The signing key, committed on purpose so updates keep their data |
| `public/licenses/` | Font licenses (SIL Open Font License) |
| `tools/make-icons.mjs` | Draws the app icon and splash images (`node tools/make-icons.mjs`) |
