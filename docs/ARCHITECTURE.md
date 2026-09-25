# Architecture

The shared application consumes a movement definition and an analysis result. It does not compute technique scores inside the UI.

```text
src/
  app.ts                         Routing and application orchestration
  data/snatch.ts                 Snatch definition, drills and demo fixture
  domain/types.ts                Movement, Analysis, Issue, Phase, LiftRecord contracts
  domain/movements.ts            Catalog and availability boundary
  domain/analysis.ts             Runtime result validation and time calculations
  services/analysis-provider.ts  Cancellable AnalysisProvider implementation
  services/history.ts            Versioned persistence, migration and recovery
  services/media.ts              File validation, metadata and object URL ownership
  services/theme.ts             Theme resolution, persistence and document application
  ui/views.ts                   Screen templates and feedback components
  ui/player.ts                  Playback lifecycle; independent of screen rendering
  ui/movement-visuals.ts         Movement-to-illustration registry
  ui/pose.ts                    SVG rendering of the constrained Snatch motion
  domain/snatch-motion.ts         Fixed-segment pose and shared bar trajectory
  ui/html.ts                    Escaping and shared icons
  style.css                     Tokens, layouts, interactions and responsive states
```

## Data flow

1. Select an available `Movement`. Validate imported media and read metadata locally.
2. Imported clips invoke `services/vision.ts`, which decodes real frames and sends them to a MediaPipe worker. The explicit demo action alone invokes the simulated `AnalysisProvider`. Both paths support cancellation.
3. Store a `VisionRecord` for measured results and a separate `LiftRecord` for demo results. The types, storage keys and routes stay separate. Video and full-body pose frames are session-only; summaries and limited wrist trajectories persist.
4. Render measured results with `ui/vision.ts` and actual footage. Demo results use their separate templates and illustrations. Old fabricated upload records are intercepted and shown as not analyzed.
5. `LiftPlayer` owns demo playback. Real replay uses native video controls and draws the closest actual landmark sample only within a bounded time gap. Missing tracking never falls back to an illustration.

Navigation uses hash routes: `#home`, `#capture`, `#history`, `#result/<id>` (demo) and `#vision/<id>` (measured). Deep-linked results reopen from local storage. Missing results recover to history. Changing screens aborts pending work and disposes playback. Imported object URLs are released on replacement or page exit. Object URLs, filenames and video bytes never enter persistent history.

## Add a movement

1. Add an exercise definition in `domain/exercises.ts` with a stable ID, family, starting position and receiving style. `domain/movements.ts` exposes supported definitions in the selector. Unimplemented families remain unavailable.
2. Implement and test its evidence rules in `domain/lift-phases.ts`, including applicable phases, receiving position, recovery and score checks. Do not silently apply Snatch overhead rules to another family.
3. Extend automatic recognition only when there is supporting evidence. Manual selection must remain available; an unresolved automatic choice must not fabricate a score. Add repetition-detection cases for the new start/receive pattern.
4. Extend persisted-data validation in `services/vision-history.ts` as needed. Validate both full session results and summaries with frames removed.
5. Test deterministic positive/negative trajectories, visibility gaps, variant corrections, reload and the actual UI. Add annotated real recordings before claiming detection accuracy.

An illustrated demo is optional and separate. To add one, supply a movement-specific `Analysis` fixture, explicit provider dispatch, a matching renderer and fixture validation. The current demo provider supports only Snatch; real Clean availability does not cause Clean uploads to receive a Snatch demo.

## Boundaries worth preserving

- Domain helpers have no browser dependencies.
- Storage accepts an explicit storage port and validates untrusted persisted data.
- Media services allocate and clean up their own temporary resources.
- The playback controller is independent of animation style and DOM templates.
- Templates escape dynamic strings; identifiers are validated before they become DOM IDs.
- Analysis and provider availability are distinct from catalog entries.

A framework, backend, account system and native wrapper are intentionally deferred. Add them when a concrete requirement makes the additional complexity useful.

## Theming

The interface ships two themes. `services/theme.ts` owns the `'dark' | 'light'` contract, the `snatchy-theme-v1` storage key, and the preference order: a stored choice wins, otherwise the operating system decides. Storage access takes an explicit port and tolerates denial or corrupted values, so a blocked or unavailable `localStorage` degrades to the system preference instead of failing.

`applyTheme` writes `data-theme` on the document element and keeps the mobile `theme-color` meta tag in step. The attribute deliberately lives on the root rather than on a re-rendered container, because `app.ts` replaces `#app` via `innerHTML` and would otherwise discard the theme on every screen change. `index.html` sets the same attribute with a small blocking script so the first paint is already correct.

`style.css` declares the dark ramp once, shared with the media surfaces, and lets `[data-theme='light']` re-hue only the page. Media surfaces (`.video-stage`, `.framing`, `.processing-visual`, `.demo-hero`, `.bar-content`, `.cv-stage`, `.bar-calibration`) are excluded from the light block, so overlay chrome stays legible over arbitrary footage. They also set `color: var(--text)` explicitly: an inherited `color` resolves from the nearest ancestor's computed value, so without it text inside a pinned surface picks up the light theme's text colour from `<body>` and disappears.

Colours that SVG presentation attributes cannot reach are expressed as `figure-*` and `chart-*` classes instead of `var()`, so figures follow the same ramp. The `theme` action is rendered by the shared shell, labelled by the theme it switches _to_, and is covered in both themes by accessibility tests that assert zero axe violations.

## Demo motion

The demo starts at setup, holds a grounded bar until the first pull, moves through extension and turnover, receives overhead in a squat, then stands with locked arms. The two-bone joint solver preserves projected arm and leg lengths. Catch/recovery constraints keep the bar above the supporting foot. Playback and the dedicated trajectory diagram sample the same geometry. The early arm bend is deliberately retained to match the demo observation.

This is a simplified side-view illustration, not motion capture. Choreography was checked against the floor-to-overhead / pull-under / stable-receive / stand sequence in [Catalyst Athletics’ Snatch exercise reference](https://catalystathletics.com/exercise/58/Snatch/).

## Measured vision modules

- `domain/exercises.ts`: exercise catalog and heuristic automatic suggestions.
- `domain/wrist-bar.ts`: bilateral wrist midpoint trajectory and relative metrics.
- `domain/body-measurements.ts`: visible landmark counts, torso-relative spans and shoulder tilt.
- `domain/score-summary.ts`: score verdicts, partial markers and recording-level averages.
- `domain/repetitions.ts`: candidate rep intervals and independent per-rep analysis.
- `domain/lift-phases.ts`: exercise-specific phase evidence and experimental checks.
- `domain/vision.ts`: measured-only contracts, visibility gates, aspect-correct angles, robust ranges, event rules and sample lookup.
- `services/vision.ts`: video decoding, sampling, worker request lifecycle, progress, timeouts and cancellation.
- `workers/pose.worker.ts`: actual MediaPipe CPU/WASM inference; returns detected landmarks, not measurements or scores.
- `services/vision-history.ts`: validates and saves summary-only real history, with explicit `simulated: false`.
- `ui/vision.ts`: actual-video overlay, live angles, confidence report, measured observations and history entries.
- `scripts/prepare-vision.mjs`: local runtime asset preparation and model checksum verification.

A future real movement implementation should supply movement-specific evidence rules over measured landmarks. Do not reuse Snatch rules for another exercise, and do not turn the tracking-coverage percentage into a technique score. See [VISION.md](VISION.md) for the current measured pipeline and limits.
