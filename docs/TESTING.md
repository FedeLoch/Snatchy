# Tests and quality gates

## Local commands

Use the Node version in `.nvmrc` and install with `npm ci`.

| Command                 | What it checks                                         |
| ----------------------- | ------------------------------------------------------ |
| `npm run format:check`  | Consistent source, config and documentation formatting |
| `npm run lint`          | ESLint + TypeScript rules, zero warnings               |
| `npm run typecheck`     | Strict TypeScript and unused code                      |
| `npm test`              | Deterministic Vitest unit suite                        |
| `npm run test:coverage` | Unit suite with enforced coverage floors               |
| `npm run build`         | Type validation and production asset build             |
| `npm run test:e2e`      | Desktop Chromium, mobile Chromium, mobile WebKit       |
| `npm run check:all`     | All checks, build and browser suite                    |

Run `npx playwright install chromium webkit` once before browser tests. Linux CI installs browser system dependencies using `--with-deps`. Browser tests use the production build on port 4173; keep this port free. Reports are written to `coverage/`, `playwright-report/` and `test-results/` (all ignored by Git).

## What is tested

Unit tests cover fixture fidelity, registry availability, phase/time boundaries, loop bounds, runtime validation, unsafe identifiers, history migration/deduplication/capping, corrupt or inaccessible storage, invalid media, decoder timeout/error/abort, object URL cleanup, processing progress/cancellation, playback speed/seek/end/loop/disposal and asynchronous media playback races.

Enforced unit coverage: 90% lines/statements/functions and 85% branches across domain helpers, services and the player. These are scoped unit coverage metrics, not a claim that every UI line is covered. Screen behavior is exercised in the browser suite.

Browser tests cover the complete analysis loop, persistence/reload, native picker wiring, real MP4 metadata/playback, short clips, replacement, corrupt uploads, cancellation without stale results, upload/demo separation and suppression of historical fake scores, drill dialogs/focus return, keyboard control, speed/loop/pose controls, deep links/back navigation, storage failures, data-driven rendering, 320px overflow and 44px player controls. Axe scans the home, capture, empty history, result and drill dialog against WCAG 2 A/AA and 2.1 AA rules.

## Media fixtures

`tests/fixtures/lift.mp4` and `short.mp4` are tiny, synthetic H.264 color clips (4 seconds and 0.8 seconds). No personal recordings or external video content are used. To regenerate with FFmpeg:

```sh
ffmpeg -f lavfi -i 'color=c=0x25351a:s=320x240:r=24:d=4' -vf 'drawbox=x=140:y=70:w=30:h=130:color=0xd4f778:t=fill' -c:v libx264 -pix_fmt yuv420p -movflags +faststart tests/fixtures/lift.mp4
ffmpeg -f lavfi -i 'color=c=0x25351a:s=320x240:r=24:d=0.8' -c:v libx264 -pix_fmt yuv420p -movflags +faststart tests/fixtures/short.mp4
```

## CI

`.github/workflows/ci.yml` runs on pull requests, main pushes and manual dispatch. Static/unit/build/audit checks must pass before the browser job. The exact production build is transferred between jobs. Failures retain coverage, browser reports, screenshots and traces for diagnosis. Concurrency cancels superseded runs. Dependabot groups development-tool updates and checks workflow actions separately.

The workflow is configured locally; a hosted GitHub run is only possible after pushing it. Configure required status checks in repository settings if you want GitHub to enforce them before merging.

## Manual device checks

Automated mobile emulation does not replace testing on a real phone. Before a release, verify iOS/Android camera permissions, the native gallery/recording flow, orientation, safe-area behavior, device-specific codecs, VoiceOver/TalkBack and long-session memory use. Axe cannot prove complete accessibility or technique accuracy. The CV smoke tests verify model execution, not athlete-level biomechanical or coaching accuracy.

## Motion regression checks

The synthetic Snatch is tested throughout the 3.6-second cycle for fixed projected limb lengths, bar/hand contact, ground clearance, continuity at every keyframe, straight arms in the first pull, the 153-degree demo elbow at 1.34 seconds, an overhead squat catch, locked elbows through recovery, and a trajectory containing only elapsed frames. These geometric checks prevent rendering regressions; they are not a validation of a real athlete or a coaching model.

## Real model tests

`tests/e2e/vision.spec.ts` executes the bundled MediaPipe model without mocking it. It checks a positive human-pose fixture, a blank negative clip, real-overlay playback, confidence behavior, local-only network requests, summary persistence, cancellation, and model-load failure. These tests run on desktop Chromium, mobile Chromium and mobile WebKit alongside the application suite.

`tests/unit/vision*.test.ts` checks pixel-aspect-correct angles, missing/occluded/multiple-person data, stable side choice, non-invented output, robust ranges, event thresholds, summary validation, metadata/frame decoding, worker errors, timeouts and cleanup. Worker internals are exercised through the real-model browser tests, not the unit mocks.

The positive fixture `person.mp4` repeats Google's public MediaPipe `pose.jpg` test image for 1.2 seconds. Its purpose is to verify real human detection and a no-motion case; it is **not** a Snatch and is not used as evidence of coaching accuracy. Source and model metadata are documented in [VISION.md](VISION.md).

## Phase, score and bar regression tests

`lift-analysis.spec.ts` verifies real-result phase seeking and saved summaries using deterministic pose samples, and tracks an actual generated moving-plate video through the browser decoder. Its known displacement and velocity catch frame-boundary errors. The demo regression locks in 83/100, all seven original phase numbers and the original bar values. Unit tests cover incomplete phases, detection gaps, explicit scoring rules, template ambiguity, tracking loss, calibration, cancellation and persisted-data validation. These tests validate mechanics, not performance on a representative athlete dataset. Android packaging steps in README require a separate physical-phone verification; CI does not build an APK.

### Recorded phase regressions

`tests/fixtures/recorded-phase-traces.json` contains rounded timestamped coordinates and visibility for six limb joints from two supplied recordings: a hang-start oblique view and a front-view dowel drill. It contains no source footage, face landmarks, filenames, audio or identifying metadata. The companion helper reconstructs the minimum pose input for the estimator. Tests verify six supported/inferred phases without fabricating a rebend, ordered timestamps, score evidence, persistence, and accessible uncertainty explanations. Synthetic tests additionally distinguish a single missing sample from prolonged occlusion and multiple-person ambiguity, and cover obscured elbows without suppressing unrelated phases.
