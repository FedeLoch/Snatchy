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

No result includes an overall technique score. Tracking coverage is explicitly labeled as data availability. The model is a human-pose detector, not a Snatch recognizer or barbell detector. No metric uses a wrist proxy while calling it a bar path. No physical distances or velocities are reported without camera calibration and actual object tracking.

Replay uses only the closest actual sample within roughly one sampling interval. Gaps remain gaps, and multiple-person frames display no skeleton. The diagram is positioned within the video's actual aspect ratio, not a differently letterboxed viewport.

## Storage and versioning

`VisionAnalysis` has `kind: 'measured-pose'`, `simulated: false`, and its own version. Demo results retain their original separate type. Real summaries use `snatchy-vision-history-v1` and `#vision/<id>` routes. Frame landmarks, filenames, blob URLs and video bytes are never persisted. Up to ten summaries are saved; quota errors leave the result accessible for the current session. Old fabricated upload records remain marked as not analyzed.

## Validation and remaining limits

Tests execute the real model on a positive human image encoded as a clip and a blank negative clip. Separate deterministic landmark tests validate geometry, visibility thresholds and event rules. This establishes that inference and measurement plumbing work; it does not establish sensitivity, specificity or coaching usefulness for Snatch technique.

Before stronger coaching claims, validate against consented, diverse athlete videos with expert annotations, varied viewpoints, occlusion, clothing, movement speeds and recording devices. Add actual barbell tracking/calibration before displacement or velocity metrics. A 15 Hz prototype cannot support millisecond-level timing claims without exposing sampling uncertainty. Clips longer than 30 seconds or shorter than 0.8 seconds are rejected with a clear message.

## Sources and artifacts

- [MediaPipe Web pose guide](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js) — landmark API, video inference and worker guidance.
- [MediaPipe source and license](https://github.com/google-ai-edge/mediapipe) — the runtime npm package is Apache-2.0.
- [Versioned Lite model](https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task) — local `public/models/pose_landmarker_lite.task`; SHA-256 `59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a`.
- [Public MediaPipe pose test image](https://storage.googleapis.com/mediapipe-assets/pose.jpg) — local `tests/fixtures/person.jpg`; SHA-256 `c8a830ed683c0276d713dd5aeda28f415f10cd6291972084a40d0d8b934ed62b`. The test MP4 repeats this static image, not a real lifting performance.
