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
2. Imported clips stay in playback-only review. Only the explicit demo action starts the `AnalysisProvider`, which reports progress and accepts an `AbortSignal`.
3. Store a versioned `LiftRecord` for demo results only. Uploaded videos remain temporary review sources and never pass through the demo provider.
4. Render demo result components from the snapshot and movement. Historical upload records are intercepted and shown as not analyzed.
5. `LiftPlayer` owns demo playback, seeking, speed, loops and animation cleanup. Upload review uses the actual HTML video and separate speed controls.

Navigation uses hash routes: `#home`, `#capture`, `#history`, `#result/<id>`. Deep-linked results reopen from local storage. Missing results recover to history. Changing screens aborts pending work and disposes playback. Imported object URLs are released on replacement or page exit. Object URLs, filenames and video bytes never enter persistent history.

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

## Uploaded-video scoring correction

Uploaded clips now stay in a playback-only review with slow-motion controls. They do not invoke the demo provider, create a scored result, show a skeleton, or receive demo observations. Only the explicit demo action produces simulated analysis. Historical upload records are shown as “Not analyzed”; their previous fixed scores are suppressed. Automatic technique analysis and scoring from video have not been implemented.
