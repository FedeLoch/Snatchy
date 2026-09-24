# Real on-device vision

## Inference and measurements

The pinned `@mediapipe/tasks-vision` package runs Google’s Pose Landmarker Lite float16 model in a module Web Worker using CPU/WASM. The app samples 0.8–120 second clips at 15 Hz and reduces each frame to a maximum 640-pixel edge. It detects up to two bodies and releases bitmaps, workers and decoding resources on completion, cancellation or failure. Assets are same-origin; frames and results never go to an external service.

The model already provides 33 landmarks. The overlay now draws hands, fingers, feet, heels, toes and face connections as well as limbs. Visible means confidence of at least 0.65 and coordinates inside the frame. Frames with zero or multiple people are excluded. A side is selected for the recording from cumulative visibility, rather than changing side each frame. Joint angles use pixel aspect ratio. Aggregate 5th–95th percentile ranges require 12 usable frames and 60% coverage; individual phase evidence is evaluated independently. Replay uses the nearest actual sample within a bounded time gap, without drawing through missing data.

Additional body measurements use both shoulders and hips for projected torso length, wrists for hand span, toes for foot span and the shoulder line for tilt. Medians reduce isolated outliers. Edge-on or missing landmarks can make these unavailable. These image-plane measurements are review cues, not calibrated anatomy or judgments of correctness. Adding displayed landmarks does not increase the underlying model’s detection accuracy.

## Exercise recognition and repetitions

`domain/exercises.ts` defines family (Snatch/Clean), starting position (floor/hang/high-hang) and receiving style (squat/power/muscle). The catalog includes four Snatch variants and seven Clean variants. Automatic classification uses sustained wrist rise, overhead versus flexed-arm front-rack evidence, starting hand height and receiving knee angle. Muscle Clean is manually selectable but not automatically distinguished. These are heuristic suggestions; unusual angles, occlusion, partial clips and drills can be misclassified. No supported suggestion means a manual choice is needed for phase scoring.

The capture selector defaults to automatic detection. Users can choose a movement before analysis or correct it afterward without re-running inference while the full samples remain in the session. Reloaded summaries require re-importing before changing exercise.

`domain/repetitions.ts` isolates candidate low-to-receiving sequences with sustained overhead or rack evidence and at least 15% frame-height wrist rise. A 0.6-second lead-in and 0.3-second tail retain context. Each rep is analyzed independently and playback is bounded to its interval in the original recording. This does not transcode or export cropped video. Failed attempts and small-range movements may not be isolated; the full recording remains the fallback.

## Phases and experimental scores

The estimator uses setup/hinge, wrist rise, extend–rebend–extend evidence, extension, turnover, receiving position and recovery. Clean checks use front-rack arm flexion rather than Snatch overhead lockout. Power receiving and recovery have different knee thresholds; Muscle Clean allows a standing receive. High-hang starts exclude First pull and Transition from applicable phase coverage.

Unsupported phases remain blank. An inferred upper-pull timestamp is explicitly marked as a timing estimate. One missing sample can be bridged, but longer gaps and multiple-person intervals cannot. No missing joint measurement is interpolated into a check. At 15 Hz, timing is approximate, not millisecond precision.

Scores are checks met / available checks × 100, using only supported evidence. No available checks means no score. Partial markers explain missing applicable phases, estimated timings or fewer than five available checks—even for 100/100. History shows the mean of available rep scores, with a partial marker when any rep is incomplete or unscored. This checklist is not a validated overall technique rating, and differing partial evidence makes scores less directly comparable.

Phase concepts are informed by [Snatch kinematic analysis](https://pmc.ncbi.nlm.nih.gov/articles/PMC6076374/) and [pull-phase research](https://pmc.ncbi.nlm.nih.gov/articles/PMC7281229/). These papers do not validate this implementation or its thresholds.

## Automatic wrist-based bar estimate

`domain/wrist-bar.ts` connects the two visible wrists with a straight line and uses its midpoint as the estimated bar position. It runs from the existing pose samples, with no separate pixel-tracking pass, calibration or manual tracking workflow. Replay shows the wrist line and midpoint. The chart breaks at tracking gaps and includes a vertical reference through the initial midpoint; this reference is not a prescribed ideal trajectory.

Horizontal displacement is maximum absolute deviation from the initial midpoint divided by frame width. Vertical rise is maximum upward displacement divided by frame height. Peak upward velocity uses central differences, in frame-height percent per second, over intervals no longer than 0.2 seconds. At least three points are needed for metrics. Missing wrists are never replaced with one-hand estimates or extrapolated points.

This is explicitly a wrist-line estimate, not detected barbell motion. Occlusion, changing grip, perspective and camera movement affect it. There are no physical centimeter/meter/second claims. Legacy plate-tracking modules and persisted-data validation remain for compatibility and unit regression coverage, but the current upload flow and result UI do not use them.

## Storage and privacy

Real results use `kind: 'measured-pose'`, `simulated: false`, their own version, `snatchy-vision-history-v1` storage and `#vision/<id>` routes. Demo data remains separate and never fills missing measurements.

Up to ten real summaries persist locally: exercise choice, phase/check summaries, aggregate body measurements and timestamped wrist endpoints/midpoints. The persisted wrist coordinates are a limited movement trajectory; full-body/face landmark frames, video bytes, filenames and blob URLs are not saved. Quota failures leave results available for the session. Legacy summaries remain readable but require re-importing to compute new fields. Old fabricated upload scores remain suppressed.

## Validation limits

Real-model browser tests execute a positive human image repeated as a clip and a blank negative clip. Deterministic Snatch/Clean pose fixtures test geometry, variant rules, manual correction, scores, wrist metrics and persistence. Two source-recording traces cover earlier missing-phase failures. These tests establish mechanics, not sensitivity, specificity or coaching usefulness across athletes or viewpoints. Clean variants currently have synthetic regression coverage, not an annotated real-athlete benchmark.

Validate with consented diverse athlete recordings, expert phase/exercise labels and manually annotated bar positions before stronger accuracy claims. Real phones need separate camera, codec, WebView/WASM, memory and performance testing. See [TESTING.md](TESTING.md).

## Sources and artifacts

- [MediaPipe Web pose guide](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js) — landmark API, video inference and worker guidance.
- [MediaPipe source and license](https://github.com/google-ai-edge/mediapipe) — the runtime npm package is Apache-2.0.
- [Versioned Lite model](https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task) — local `public/models/pose_landmarker_lite.task`; SHA-256 `59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a`.
- [Public MediaPipe pose test image](https://storage.googleapis.com/mediapipe-assets/pose.jpg) — local `tests/fixtures/person.jpg`; SHA-256 `c8a830ed683c0276d713dd5aeda28f415f10cd6291972084a40d0d8b934ed62b`. The test MP4 repeats this static image, not a real lifting performance.

## Phase fixes verified with recorded movement traces

The setup rule accepts a hip hinge with relatively straight knees, so a hang start does not suppress the entire pull sequence. Extension can be supported by hip or knee change, rather than requiring both to change by the same amount. Second-pull timing can use independent hip extension and hand-height cues when a knee rebend is unresolved; these timestamps are explicitly marked **Timing estimate**, and Transition stays unresolved. These rules do not establish floor contact, bar contact, or exercise variant.

Phase detection no longer discards a frame merely because an unrelated joint angle is unavailable. It can bridge one missing sample (at most 2.1 sample periods), but not a longer gap or a multiple-person interval. Measurements are never interpolated into score checks. Incomplete phase coverage is disclosed and marks the timing as estimated. Aggregate joint-range coverage remains a separate requirement.

Two recorded-video regressions reproduced the previous failures: an oblique hang-start clip (previously only Catch/Recovery), and a front-view dowel drill (previously missing Transition/Second pull). Both now expose six phase entries, including an explicitly estimated Second pull. Neither trace establishes a distinct knee-rebend Transition. This is a targeted regression result, not an all-angle accuracy benchmark.
