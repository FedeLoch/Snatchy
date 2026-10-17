# Real on-device vision

## Inference and measurements

The pinned `@mediapipe/tasks-vision` package runs Google’s Pose Landmarker Lite float16 model in a module Web Worker using CPU/WASM. The app samples 0.8–120 second clips at 15 Hz, or at 30 Hz for clips up to 30 s when the capture screen's Timing detail is set to Precise and reduces each frame to a maximum 1920-pixel edge (native for 1080p phone video), so the pose model's athlete crop and the hand crops keep source detail. It detects up to two bodies and releases bitmaps, workers and decoding resources on completion, cancellation or failure. Assets are same-origin; frames and results never go to an external service.

When two bodies are returned, `selectAthlete` keeps the lifter instead of discarding the frame: duplicate detections of one body collapse to the more confident one, otherwise the body continuing the previous selection wins, or on the first frame a clearly larger (≥1.4×) body. Two similar people with no history remain ambiguous and the frame is excluded as before.

## Off-plane joint angles

Joint angles were previously projected 2D angles only, which fail when the camera is not side-on: a front-view squat bottom measured a 159° knee and a front rack measured 1–25° elbows. The worker now keeps the pose model's 3D world landmarks (meters, session-only). `measuredAngle` uses the 2D pixel angle while both segments lie within about 20° of the image plane (out-of-plane share ≤ 0.35), where it is more precise, the 3D angle beyond about 40° (share ≥ 0.65), and a smooth blend in between. Visibility gating still uses the 2D landmarks. On five local clips (front, oblique and side views) this moved front-view squat knees from 113–159° to 49–61° and oblique start-position hips from 115° to 58°, matching the footage. Model depth is noisy: a front-view hang position read too flexed (≈88° hip). Recordings without 3D data (older fixtures) keep the 2D behavior.

## Hand tracking

The worker also runs Hand Landmarker (float16, 21 points per hand). A hand on a barbell is often only a few dozen pixels wide, where full-frame palm detection usually fails, so `domain/hands.ts` crops a square around each pose wrist (sized from the forearm), runs the hand model on that crop at 256 px, retries once with a 1.8× wider crop when nothing matches, and maps the points back. A detected hand belongs to an arm only if its wrist is closer to that arm’s pose wrist than to the other one, lies within 0.8 projected forearm lengths of it, and its palm size is plausible; the model's handedness label is not trusted. Every matched hand is drawn, but only a hand whose wrist lies within 0.35 forearm lengths of the pose wrist may refine measurements; farther matches stay display-only so one model cannot relocate a joint on its own. Agreeing hands replace the pose model's coarse wrist, index, pinky and thumb points, which in turn refines elbow angles, the hand-based bar estimate and shaft-search region. With both palms tracked, the bar estimate uses the grip center (across the palm near the knuckles) instead of the wrist/index/pinky average. A `wrist-bend` measurement reports the median projected forearm-to-hand angle during the Catch phase when at least three hand-tracked samples exist; per-frame bends above 100° are treated as mis-fits and excluded. Hand tracking roughly triples analysis time on desktop CPU (a 103 s 1080p clip took about 220 s instead of 75 s). Hand landmarks are session-only and drawn in the replay overlay. If the hand model cannot load, the body analysis continues without it.

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

Up to ten real summaries persist locally: exercise choice, phase/check summaries, aggregate body measurements and timestamped wrist endpoints/midpoints. Video bytes, filenames and blob URLs are not saved.

The per-frame pose of each saved result is kept separately on the device in IndexedDB (`snatchy-pose-v1`, `services/pose-store.ts`): unfiltered body landmarks, 3D world landmarks, hand landmarks and bar-shaft detections as typed arrays, roughly 0.5–1 MB per 30 s recording. Reopening a result without its video replays this saved skeleton with play/scrub controls (`ui/skeleton-clock.ts` drives the same overlay as a video would), and the exercise can still be changed because the analysis is recomputed from these frames. Entries for records no longer in history are pruned at start-up and after each new analysis, so an undone removal keeps its skeleton. These landmarks describe the athlete's body and movement but contain no image data. If IndexedDB is unavailable or full, results fall back to summary-only. Quota failures leave results available for the session. Summaries saved before this change have no stored frames and still require re-importing to compute new fields.

## Progress

The history page shows score progression per exercise above the recordings list (`domain/progression.ts`, `ui/progress.ts`). Scores are only compared within one exercise, because checks and targets differ between exercises. Unscored recordings are omitted rather than drawn as zero, partial scores use hollow markers, and the card reports the latest score, the change since the first recording and the best score, plus the mean of the last three against the three before once six scored recordings exist. Old fabricated upload scores remain suppressed.

## Validation limits

Real-model browser tests execute a positive human image repeated as a clip and a blank negative clip. Deterministic Snatch/Clean pose fixtures test geometry, variant rules, manual correction, scores, wrist metrics and persistence. Two source-recording traces cover earlier missing-phase failures. These tests establish mechanics, not sensitivity, specificity or coaching usefulness across athletes or viewpoints. Clean variants currently have synthetic regression coverage, not an annotated real-athlete benchmark.

Validate with consented diverse athlete recordings, expert phase/exercise labels and manually annotated bar positions before stronger accuracy claims. Real phones need separate camera, codec, WebView/WASM, memory and performance testing. See [TESTING.md](TESTING.md).

## Sources and artifacts

- [MediaPipe Web pose guide](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js) — landmark API, video inference and worker guidance.
- [MediaPipe source and license](https://github.com/google-ai-edge/mediapipe) — the runtime npm package is Apache-2.0.
- [Versioned hand model](https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task) — local `public/models/hand_landmarker.task`; SHA-256 `fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1`.
- [Versioned Lite model](https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task) — local `public/models/pose_landmarker_lite.task`; SHA-256 `59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a`.
- [Public MediaPipe pose test image](https://storage.googleapis.com/mediapipe-assets/pose.jpg) — local `tests/fixtures/person.jpg`; SHA-256 `c8a830ed683c0276d713dd5aeda28f415f10cd6291972084a40d0d8b934ed62b`. The test MP4 repeats this static image, not a real lifting performance.

## Sampling rate

Timing detail defaults to Standard (15 Hz). Precise samples clips up to 30 s at 30 Hz; longer clips stay at 15 Hz. It is opt-in because it doubles processing time and its gains depend on the source frame rate. A second pull lasts roughly 0.1–0.25 s, one to three samples at 15 Hz. Analysis rules were tuned at 15 Hz, so every rule that means a duration ("three consecutive samples", gap bridging, minimum sample counts) counts `stride(sampleRate)` samples per 15 Hz step and keeps the same time span; at 15 Hz the stride is 1 and behavior is unchanged. Three-sample medians stay three samples at any rate, because robustness to one bad sample depends on the count, and a shorter span keeps brief hang pulls measurable. When the browser reports the presented frame's media time, a repeated source frame is skipped rather than analyzed twice, and if fewer than 75% of the planned samples remain, the clip is analyzed with the 15 Hz rules.

Measured on five local clips (desktop Chrome, Lite model, hand tracking on), 30 Hz roughly doubles processing time (27 s phone clip: 48–72 s → 97–123 s). On a 30 fps phone recording of six cleans it resolved the knee rebend (Transition) in both floor reps, which 15 Hz missed, and made the arms check available in hang reps where 15 Hz had too few samples. Screen recordings that only contain ~15 distinct frames per second gain nothing, and some threshold-adjacent checks (within ±3°) flip between rates. The 2D/3D joint angle blends between 35% and 65% out-of-plane share instead of switching at 50%, which removed 10–15° sample-to-sample knee flicker visible at 30 Hz.

## Pull end and repetition length

The end of the pull (Turnover start, and the hip/knee extension checks) is searched only while the hands are still below the shoulders. Previously a later standing pose with the bar already overhead, such as the power position before an overhead squat, could be taken as the extension, placing Turnover ~0.5 s late and measuring the pull-under's bent elbows as an "arms through the pull" fault. Within that window, when hips and knees hold a plateau for several samples while the arms start the pull-under, the pull ends where the joints stop opening (within 6° combined of the peak and gaining less than 3° on the next sample), but only if that moves the end by two or more samples; a one-sample shift is within the 15 Hz resolution. The arms check uses the samples before the extension sample, falling back to including it when a short hang pull leaves fewer than three.

A repetition window closes 20 s after the receiving position is reached, so hands held up for a long time (or non-lifting footage) cannot turn the rest of a recording into one rep. Slow-motion footage stays within this limit.

On local test clips, a front-view dowel snatch drill moved its pull end from 1.13–1.47 s to 0.93 s and its arms check from 150° (fail) to 178° (pass), matching the footage, and a hang clean's second pull moved from a 2.2 s interval to the observed dip-and-drive. At 15 Hz, hang-lift second pulls span only one or two samples, which limits timing precision and can leave the arms check unavailable; see Sampling rate.

## Phase fixes verified with recorded movement traces

The setup rule accepts a hip hinge with relatively straight knees, so a hang start does not suppress the entire pull sequence. Extension can be supported by hip or knee change, rather than requiring both to change by the same amount. Second-pull timing can use independent hip extension and hand-height cues when a knee rebend is unresolved; these timestamps are explicitly marked **Timing estimate**, and Transition stays unresolved. These rules do not establish floor contact, bar contact, or exercise variant.

Phase detection no longer discards a frame merely because an unrelated joint angle is unavailable. It can bridge one missing sample (at most 2.1 sample periods), but not a longer gap or a multiple-person interval. Measurements are never interpolated into score checks. Incomplete phase coverage is disclosed and marks the timing as estimated. Aggregate joint-range coverage remains a separate requirement.

Two recorded-video regressions reproduced the previous failures: an oblique hang-start clip (previously only Catch/Recovery), and a front-view dowel drill (previously missing Transition/Second pull). Both now expose six phase entries, including an explicitly estimated Second pull. Neither trace establishes a distinct knee-rebend Transition. This is a targeted regression result, not an all-angle accuracy benchmark.
