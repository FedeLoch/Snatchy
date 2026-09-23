# Snatchy

A mobile-first visual instrument for understanding a Snatch. This prototype covers one loop: **record → analyze → understand → improve**. Uploaded videos use real, on-device body-pose inference. A separate illustrated demo remains available.

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
- Camera/gallery capture, file validation, video review, real pose analysis and cancellation.
- Real clips: tracked skeleton on the original footage, confidence-filtered elbow/hip/knee angles, measured motion events, experimental early-bend hypotheses, and slow-motion playback.
- Explicit demo: seven scored phases, keyboard stepping and a bounded issue loop.
- Saved real measurement summaries remain separate from simulated demo results.
- Accessible navigation, focus restoration, large touch controls, reduced-motion support, and recoverable errors.

## Architecture

TypeScript + Vite, with browser-native UI components and no runtime framework dependency. Movement definitions, analysis results, storage, media, playback, and rendering are separate modules. Only Snatch is enabled; five future movements are catalogued but cannot accidentally receive Snatch analysis.

See [architecture and adding a movement](docs/ARCHITECTURE.md).

## Real computer vision

Import a **0.8–30 second** clip of one athlete, review it, then choose **Analyze this video**. The bundled MediaPipe Pose Landmarker Lite model runs in a dedicated Web Worker using CPU/WASM. Frames are sampled at 15 Hz, downscaled to at most 640 pixels on the long edge, and never leave the device. The first run loads roughly 6 MB of local model data plus the WASM runtime.

Results include actual pose landmarks aligned to the video, perspective-dependent 2D joint angles, robust angle ranges, tracking coverage and timestamped motion observations. Low-confidence or multiple-person frames are excluded. Fewer than 12 usable frames or less than 60% usable coverage withholds aggregate measurements and observations. No real overall technique score is assigned.

The pose model does **not** detect the barbell, verify that the exercise is a Snatch, or provide calibrated 3D biomechanics. It must not be used to report bar displacement/velocity from wrist landmarks. The early-arm-bend rule is explicitly an experimental hypothesis, not a validated coaching diagnosis. Film from the side with a steady, well-lit camera and the whole athlete visible.

See [computer-vision implementation and limitations](docs/VISION.md).

## Local assets and privacy

`npm ci` copies the pinned MediaPipe WASM runtime into ignored `public/vision/`. The versioned model is included in `public/models/`; its SHA-256 is verified on install/dev/build. Runtime model requests are same-origin. No API key, backend, CDN or upload service is needed.

Videos and per-frame landmarks remain in memory for the current session. Up to ten measured summaries are stored locally, without video bytes, filenames, blob URLs or frame-level landmarks. Reloading shows the saved measurements and asks you to re-import for tracked replay; it never substitutes the demo. Old prototype upload scores are suppressed. Demo history is stored separately (up to 30 entries).

The camera button uses the native video picker with `capture="environment"`. Camera availability, gallery UI, playback codecs and permissions depend on the device. This is a web application, not an installable native app. Real-model smoke tests cover Chromium and WebKit; real-phone and athlete-video validation is still needed before treating feedback as coaching-grade.
