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
3. Store a `VisionRecord` for measured results and a separate `LiftRecord` for demo results. The types, storage keys and routes stay separate. Real video/landmark data is session-only; only measurement summaries persist.
4. Render measured results with `ui/vision.ts` and actual footage. Demo results use their separate templates and illustrations. Old fabricated upload records are intercepted and shown as not analyzed.
5. `LiftPlayer` owns demo playback. Real replay uses native video controls and draws the closest actual landmark sample only within a bounded time gap. Missing tracking never falls back to an illustration.

Navigation uses hash routes: `#home`, `#capture`, `#history`, `#result/<id>` (demo) and `#vision/<id>` (measured). Deep-linked results reopen from local storage. Missing results recover to history. Changing screens aborts pending work and disposes playback. Imported object URLs are released on replacement or page exit. Object URLs, filenames and video bytes never enter persistent history.

## Add a movement

1. Create `src/data/<movement>.ts` with its `Movement`, drill definitions and an `Analysis` fixture. Use stable lowercase IDs. Phase starts must be ordered, start at zero, and lie within the result duration. Issue phase/drill references must resolve.
2. Add the definition to the registry in `domain/movements.ts`, initially unavailable. Keep the default experience Snatch until the new movement is complete.
3. Add explicit provider dispatch in `services/analysis-provider.ts`. A movement must never fall back to another movement's analysis. For a real provider, keep cancellation/progress behavior and introduce an explicitly versioned real-analysis contract; version 1 deliberately requires `simulated: true`.
4. Add a matching demo renderer in `ui/movement-visuals.ts` if an illustration is useful. The fallback clearly says no illustration is available; it never renders Snatch for an unknown movement. For tracked footage, use a separate renderer that consumes actual timestamped keypoints.
5. Validate the fixture with `isAnalysis`, test phase boundaries and issue/drill references, and add browser coverage for the new movement. Then set `available: true`. The capture selector exposes available entries automatically.

Home's featured demo remains Snatch by design. All result scores, phases, observations, metrics and drills come from the active movement/result. No new pages or player implementation are needed to support a new movement.

## Boundaries worth preserving

- Domain helpers have no browser dependencies.
- Storage accepts an explicit storage port and validates untrusted persisted data.
- Media services allocate and clean up their own temporary resources.
- The playback controller is independent of animation style and DOM templates.
- Templates escape dynamic strings; identifiers are validated before they become DOM IDs.
- Analysis and provider availability are distinct from catalog entries.

A framework, backend, account system and native wrapper are intentionally deferred. Add them when a concrete requirement makes the additional complexity useful.

## Demo motion

The demo starts at setup, holds a grounded bar until the first pull, moves through extension and turnover, receives overhead in a squat, then stands with locked arms. The two-bone joint solver preserves projected arm and leg lengths. Catch/recovery constraints keep the bar above the supporting foot. Playback and the dedicated trajectory diagram sample the same geometry. The early arm bend is deliberately retained to match the demo observation.

This is a simplified side-view illustration, not motion capture. Choreography was checked against the floor-to-overhead / pull-under / stable-receive / stand sequence in [Catalyst Athletics’ Snatch exercise reference](https://catalystathletics.com/exercise/58/Snatch/).

## Measured vision modules

- `domain/vision.ts`: measured-only contracts, visibility gates, aspect-correct angles, robust ranges, event rules and sample lookup.
- `services/vision.ts`: video decoding, sampling, worker request lifecycle, progress, timeouts and cancellation.
- `workers/pose.worker.ts`: actual MediaPipe CPU/WASM inference; returns detected landmarks, not measurements or scores.
- `services/vision-history.ts`: validates and saves summary-only real history, with explicit `simulated: false`.
- `ui/vision.ts`: actual-video overlay, live angles, confidence report, measured observations and history entries.
- `scripts/prepare-vision.mjs`: local runtime asset preparation and model checksum verification.

A future real movement implementation should supply movement-specific evidence rules over measured landmarks. Do not reuse Snatch rules for another exercise, and do not turn the tracking-coverage percentage into a technique score. See [VISION.md](VISION.md) for the current measured pipeline and limits.
