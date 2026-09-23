# Real on-device vision

## What runs

The app uses the pinned `@mediapipe/tasks-vision` package and Google's Pose Landmarker Lite float16 model (versioned path `1`). Inference runs in a module Web Worker with the package's module WASM loader and CPU delegate. The main thread decodes a clip at 15 samples/second, resizes each frame to at most 640 px on the long edge, then transfers an `ImageBitmap` to the worker. The worker detects up to two bodies and closes every input bitmap after inference. The app terminates the worker and frees the decoding video on success, error or cancellation.

Resources are served from this app's own origin. Video frames, landmarks and measurements are never sent to Google or another service. Asset fetching is inbound only. Installation copies WASM files from the pinned npm package; the committed model's SHA-256 is checked before dev/build.

## Measurements and gates

- Select one side for the whole clip using cumulative visible-landmark evidence. Do not switch sides frame by frame.
- Exclude frames with zero or multiple detected people.
- A usable frame requires visible shoulder, elbow, wrist, hip, knee and ankle on the selected side. Visibility must be at least 0.65 and points must be inside the frame.
- Compute elbow, hip and knee angles using pixel coordinates, correcting for video aspect ratio.
- Require at least 12 usable frames and 60% usable-frame coverage before publishing aggregate ranges or events.
- Report the 5th–95th percentile range to reduce isolated outliers. Timestamps identify the actual samples associated with those endpoints.
- Report meaningful flexion/extension changes (at least 15°) as measured motion events. An arm-above-shoulder event requires three adjacent high-quality samples with elbow angle above 155° and wrist above the shoulder.
- A possible-early-bend hypothesis additionally requires substantial hip-angle excursion, later overhead evidence, and sustained elbow/hip flexion before the largest observed hip angle. It is marked experimental; it does not prove a technique fault.

The original analysis never substitutes demo scores. The new optional movement-check score is a transparent experimental checklist, not a validated overall technique score. Tracking coverage is explicitly labeled as data availability. The model is a human-pose detector, not a Snatch recognizer or barbell detector. No metric uses a wrist proxy while calling it a bar path. No physical distances or velocities are reported without camera calibration and actual object tracking.

Replay uses only the closest actual sample within roughly one sampling interval. Gaps remain gaps, and multiple-person frames display no skeleton. The diagram is positioned within the video's actual aspect ratio, not a differently letterboxed viewport.

## Storage and versioning

`VisionAnalysis` has `kind: 'measured-pose'`, `simulated: false`, and its own version. Demo results retain their original separate type. Real summaries use `snatchy-vision-history-v1` and `#vision/<id>` routes. Frame landmarks, filenames, blob URLs and video bytes are never persisted. Up to ten summaries are saved; quota errors leave the result accessible for the current session. Old fabricated upload records remain marked as not analyzed.

## Validation and remaining limits

Tests execute the real model on a positive human image encoded as a clip and a blank negative clip. Separate deterministic landmark tests validate geometry, visibility thresholds and event rules. This establishes that inference and measurement plumbing work; it does not establish sensitivity, specificity or coaching usefulness for Snatch technique.

Before stronger coaching claims, validate against consented, diverse athlete videos with expert annotations, varied viewpoints, occlusion, clothing, movement speeds and recording devices. Validate plate tracking and calibration against known displacement and velocity references. A 15 Hz prototype cannot support millisecond-level timing claims without exposing sampling uncertainty. Clips longer than 120 seconds or shorter than 0.8 seconds are rejected with a clear message.

## Sources and artifacts

- [MediaPipe Web pose guide](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js) — landmark API, video inference and worker guidance.
- [MediaPipe source and license](https://github.com/google-ai-edge/mediapipe) — the runtime npm package is Apache-2.0.
- [Versioned Lite model](https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task) — local `public/models/pose_landmarker_lite.task`; SHA-256 `59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a`.
- [Public MediaPipe pose test image](https://storage.googleapis.com/mediapipe-assets/pose.jpg) — local `tests/fixtures/person.jpg`; SHA-256 `c8a830ed683c0276d713dd5aeda28f415f10cd6291972084a40d0d8b934ed62b`. The test MP4 repeats this static image, not a real lifting performance.

## Estimated phases and movement checks

The seven-phase UI is present for real results. The `pose-heuristic` estimator uses low hands, sustained wrist rise, an extend–rebend–extend knee pattern, pre-catch extension, an overhead receiving position and recovery. It requires continuous usable evidence within each measured segment and leaves unresolved phases blank; it never assigns evenly spaced or demo timestamps. These are pose proxies for phase boundaries, not detected barbell contact events. Checks are evaluated independently from recognized phase evidence. The score is the percentage of available checks met; unknown phases never contribute zeros. A partial marker lists missing phases and available checks, including for 100/100 results. Static or unsupported footage still receives no score. All thresholds and limitations appear in the UI. No expert-annotated athlete dataset has validated these thresholds or phase accuracy.

Phase concepts are informed by [published Snatch kinematic analysis](https://pmc.ncbi.nlm.nih.gov/articles/PMC6076374/) and [pull-phase research](https://pmc.ncbi.nlm.nih.gov/articles/PMC7281229/). Those papers do not validate this implementation or its score thresholds.

## Guided plate tracking

A separate tracker uses a user-marked plate center/radius, an entered real diameter, and stationary-camera confirmation. At 15 Hz, frames are reduced to 320 pixels on the long edge. Fixed-template normalized correlation searches a local neighborhood; weak or ambiguous matches stop the track. This is seeded image tracking, not automatic barbell recognition. Plate rotation, occlusion, background matches, camera movement and scale changes can invalidate results. Users must inspect the path on actual frames and explicitly confirm it before publishing measurements.

Meters per pixel = entered diameter in meters / marked diameter in pixels. Horizontal displacement is maximum absolute deviation from the first center; vertical displacement is maximum rise from it. Peak upward velocity uses central differences over two sample intervals and does not bridge gaps beyond 0.2 seconds. It is a sampled image-plane estimate, not calibrated 3D velocity. Partial tracks are labeled and never extrapolated. Reviewed tracks, calibration and phase/check summaries persist; video and body-landmark frames do not.

Tests cover controlled joint trajectories, moving textured pixels, missing/ambiguous texture, invalid calibration, cancellation, persistence and browser interaction. `plate.mp4` is a generated textured disk moving upward at a known rate, not an athlete validation set. UI phase tests inject known pose samples; the separate vision suite continues to run the real MediaPipe model.

## Automatic recording workflow

`domain/repetitions.ts` detects candidate low-to-overhead sequences from wrist/hip/shoulder evidence (three overhead samples, at least 15% frame-height rise). A 0.6-second lead-in and 0.3-second tail retain context. Repetitions remain in original video timestamps; each is analyzed independently and playback is bounded to its interval. Missing global pose coverage during setup no longer suppresses a well-tracked rep. This heuristic does not classify exercise identity, guarantee all seven phases, or isolate every failed attempt. No video is transcoded. The original recording is retained for the session.

`domain/automatic-bar.ts` proposes round edges near visible wrists, requires consistent contrast around at least 21 of 24 radial samples, rejects similarly strong separated proposals, and tracks the image template without using wrists as path points. It requires at least six points and upward motion of half the detected radius. Tracking terminates on correlation loss, timestamp gaps, multiple people or separation from the hands. Paths are explicitly unverified candidates. Size-free displacement uses frame percentages; physical measurements still require real diameter calibration and user review. Detector and tracking are heuristic and viewpoint dependent; round clutter can be mistaken for a plate.

The analysis service performs the pixel pass after rep isolation, downscaled to a maximum 320-pixel edge. Both passes are cancellable. Two-minute videos may take substantial time on phones. No athlete-video benchmark is included; synthetic positive/negative tests check mechanics, not accuracy on real lifts. Validate with consented recordings and manually annotated rep boundaries, phases and plate centers before making accuracy claims.

Pixel reads wait for both seek completion and, where available, [video-frame presentation](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback). A 100 ms fallback prevents paused/hidden decoders from stalling if they omit callbacks. The calibrated moving-pixel browser fixture checks displacement and velocity, including WebKit; this is not a guarantee of timing accuracy on every device.

## Phase fixes verified with recorded movement traces

The setup rule accepts a hip hinge with relatively straight knees, so a hang start does not suppress the entire pull sequence. Extension can be supported by hip or knee change, rather than requiring both to change by the same amount. Second-pull timing can use independent hip extension and hand-height cues when a knee rebend is unresolved; these timestamps are explicitly marked **Timing estimate**, and Transition stays unresolved. These rules do not establish floor contact, bar contact, or exercise variant.

Phase detection no longer discards a frame merely because an unrelated joint angle is unavailable. It can bridge one missing sample (at most 2.1 sample periods), but not a longer gap or a multiple-person interval. Measurements are never interpolated into score checks. Incomplete phase coverage is disclosed and marks the timing as estimated. Aggregate joint-range coverage remains a separate requirement.

Two recorded-video regressions reproduced the previous failures: an oblique hang-start clip (previously only Catch/Recovery), and a front-view dowel drill (previously missing Transition/Second pull). Both now expose six phase entries, including an explicitly estimated Second pull. Neither trace establishes a distinct knee-rebend Transition. This is a targeted regression result, not an all-angle accuracy benchmark.
