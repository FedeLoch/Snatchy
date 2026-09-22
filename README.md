# Snatchy

A mobile-first visual instrument for understanding a Snatch. This prototype covers one loop: **record → analyze → understand → improve**. All technique analysis is clearly marked as simulated.

## Start

Use Node 24 LTS (`nvm use`; Node 22.13+ is also supported).

```sh
npm ci
npm run dev
```

Open http://localhost:5173. No backend, account, or API key is required. The app uses system fonts and makes no external requests at runtime.

```sh
npm run build
npm run preview
```

## Quality checks

```sh
npm run check             # formatting, lint, types, unit coverage, production build
npx playwright install chromium webkit
npm run test:e2e          # production build must exist
npm run check:all         # complete local gate, including browser tests
```

Additional commands: `npm run test:watch`, `npm run test:e2e:ui`, `npm run format`. See [testing documentation](docs/TESTING.md) for coverage, fixtures, reports, and manual device checks.

GitHub Actions runs static checks, coverage thresholds, a production build, dependency auditing, and browser/accessibility tests on pull requests and pushes to `main`. Reports are uploaded as workflow artifacts. Dependabot keeps development packages and workflow actions reviewed through pull requests. The workflow will run once this repository is pushed to GitHub; repository branch protection must be configured separately to make it a merge requirement.

## Experience

- Responsive home and local lift history, with an interactive illustrated demo.
- Camera/gallery capture, file validation, playback review before analysis, and cancellation.
- Seven scored phases, precise scrubbing, keyboard stepping, slow motion and a bounded issue loop.
- Three expandable observations, associated demo measurements, targeted drills, and a bar-path illustration.
- Accessible navigation, focus restoration, large touch controls, reduced-motion support, and recoverable errors.

## Architecture

TypeScript + Vite, with browser-native UI components and no runtime framework dependency. Movement definitions, analysis results, storage, media, playback, and rendering are separate modules. Only Snatch is enabled; five future movements are catalogued but cannot accidentally receive Snatch analysis.

See [architecture and adding a movement](docs/ARCHITECTURE.md).

## Prototype boundaries and privacy

Scores, phase timing, joint angles, pose, trajectory, and coaching feedback are demo data. No computer vision is implemented. The SVG athlete and issue timestamps belong exclusively to the explicit demo. Imported footage has no pose overlay, score, or generated technique feedback.

Videos are read through local object URLs, never uploaded, and retained only for the current session. History stores up to 30 analysis snapshots with timestamps and source type, not video bytes, URLs, or filenames. Reopening a historical upload shows an unscored notice, never the demo illustration. Current uploads are playback-only and are not saved as analysis records. Old timestamp-only history is migrated. Denied/full/corrupt storage does not block analysis.

The camera button uses the native video picker with `capture="environment"`. Actual camera availability, gallery UI, playback codecs, and browser permissions depend on the device. MP4/H.264 is used by the automated fixture tests. This is a web prototype, not an installable native application.

## Uploaded-video scoring correction

Uploaded clips now stay in a playback-only review with slow-motion controls. They do not invoke the demo provider, create a scored result, show a skeleton, or receive demo observations. Only the explicit demo action produces simulated analysis. Historical upload records are shown as “Not analyzed”; their previous fixed scores are suppressed. Automatic technique analysis and scoring from video have not been implemented.
