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
- Real clips: tracked skeleton, measured joint angles and radar chart, seven estimated movement phases with frame seeking, experimental movement checks, and calibrated plate tracking for bar metrics.
- Recorded-video results reuse the demo’s large-score layout, phase timeline, feedback cards and bar-metric layout. Their values come only from that recording and its reviewed calibration. Missing evidence shows an unavailable value; the demo’s score is never a fallback.
- The separate explicit demo is preserved: **83/100**, seven phase scores (**94, 91, 86, 72, 76, 84, 92**), all feedback/drills, and illustrative bar metrics (**6.4 cm, 1.24 m, 1.82 m/s**). Demo values remain clearly labeled and are never assigned to uploaded videos.
- Saved real measurement summaries remain separate from simulated demo results.
- Accessible navigation, focus restoration, large touch controls, reduced-motion support, and recoverable errors.

## Architecture

TypeScript + Vite, with browser-native UI components and no runtime framework dependency. Movement definitions, analysis results, storage, media, playback, and rendering are separate modules. Only Snatch is enabled; five future movements are catalogued but cannot accidentally receive Snatch analysis.

See [architecture and adding a movement](docs/ARCHITECTURE.md).

## Real computer vision

Import a **0.8–120 second** clip of one athlete, review it, then choose **Analyze this video**. The bundled MediaPipe Pose Landmarker Lite model runs in a dedicated Web Worker using CPU/WASM. Frames are sampled at 15 Hz, downscaled to at most 640 pixels on the long edge, and never leave the device. The first run loads roughly 6 MB of local model data plus the WASM runtime.

Results include actual pose landmarks aligned to the video, perspective-dependent 2D joint angles, robust angle ranges, tracking coverage and timestamped motion observations. Low-confidence or multiple-person frames are excluded. Fewer than 12 usable frames or less than 60% usable coverage withholds aggregate measurements and observations. A large experimental movement-check score uses only the recognized phases with reliable measurements: checks met / available checks × 100. Missing phases are not penalized. A partial-analysis marker lists missing phases and available checks, even when the partial score is 100. Hang starts can use hip-hinge evidence even with relatively straight knees. An upper-pull timing estimate can be shown independently of a missing knee-rebend transition and is explicitly labeled. Brief tracking gaps are tolerated without inventing joint measurements. With no supported checks, the score stays blank. This is not a validated technique rating.

Recordings up to two minutes can contain multiple repetitions. A low-to-overhead motion detector isolates candidate reps and displays a rep selector. Each rep has its own phase analysis, score and bounded playback; lead-in and rest frames do not dilute its tracking coverage. This is non-destructive time selection, not an exported cropped video. Incomplete attempts without an overhead position may not be isolated; if no candidate is found, the recording evidence is shown instead.

**Follow the bar starts automatically:** a separate circular-edge detector proposes a visible plate near the hands, then template matching follows actual image pixels. The path has a blue verification marker on the replay and a dashed vertical reference through its starting point. Uncalibrated deviation and rise use percentages of frame width/height. A vertical reference is not a universal ideal Snatch trajectory. Ambiguous, static, short or lost tracks are withheld or marked partial. This experimental detector is not a trained barbell classifier: front views, occlusion, camera movement and similar round objects can defeat it. Verify its marker before using the result. Physical velocity stays unavailable until calibration.

The pose model does **not** detect the barbell or provide calibrated 3D biomechanics. The separate **Calibrate and track bar** flow prefills the automatic candidate when available, or follows a user-marked plate using pixel template matching. Enter its measured diameter, use a fixed side-view camera, and review the tracked dot before saving. It reports maximum horizontal deviation, maximum vertical rise and sampled peak upward velocity only over the tracked interval. Tracking stops on low confidence; partial intervals are clearly labeled. Wrist landmarks are never called a bar path. The early-arm-bend rule is explicitly an experimental hypothesis, not a validated coaching diagnosis. Film from the side with a steady, well-lit camera and the whole athlete visible.

See [computer-vision implementation and limitations](docs/VISION.md).

## Local assets and privacy

`npm ci` copies the pinned MediaPipe WASM runtime into ignored `public/vision/`. The versioned model is included in `public/models/`; its SHA-256 is verified on install/dev/build. Runtime model requests are same-origin. No API key, backend, CDN or upload service is needed.

Videos and per-frame body landmarks remain in memory for the current session. Phase summaries, movement checks and reviewed calibrated plate-center tracks are saved with the result. Up to ten measured summaries are stored locally, without video bytes, filenames, blob URLs or frame-level landmarks. Reloading shows the saved measurements and asks you to re-import for tracked replay; it never substitutes the demo. Old prototype upload scores are suppressed. Demo history is stored separately (up to 30 entries).

The camera button uses the native video picker with `capture="environment"`. Camera availability, gallery UI, playback codecs and permissions depend on the device. The source is a web application; the optional Android packaging steps below wrap the built app in a native Android shell. Real-model smoke tests cover Chromium and WebKit; real-phone and athlete-video validation is still needed before treating feedback as coaching-grade.

## Build an Android APK for your phone

An APK is for **Android**. An iPhone needs a separate iOS/Xcode build. No APK or Android device build has been produced or tested in this repository yet; the web checks do not establish Android WebView compatibility.

### 1. Install the Android build tools

Use Node 24 LTS and [Android Studio](https://developer.android.com/studio) (2025.2.1 or newer for Capacitor 8). In Android Studio’s SDK Manager, install Android SDK Platform **36**, SDK Build-Tools and Platform-Tools. Use Android Studio’s bundled JDK; there is no need to replace your system Java. See the official [Capacitor environment requirements](https://capacitorjs.com/docs/getting-started/environment-setup).

### 2. Create the Android wrapper once

Run from this repository:

```sh
cd /Users/fede/Documents/GitHub/Snatchy
npm ci
npm install @capacitor/core@8 @capacitor/android@8
npm install --save-dev @capacitor/cli@8
npx cap init Snatchy com.snatchy.app --web-dir dist
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

`com.snatchy.app` is a suggested local test application ID; choose an ID you control before publishing. Run `cap init` and `cap add android` only once. Keep the generated Capacitor config and `android/` source project in version control, with their generated ignore files; do not commit `android/local.properties`, signing keys or passwords.

The config’s `webDir` must be `dist`. Do **not** configure `server.url` to point at localhost: the phone should use the web bundle, pose model and WASM files copied into the APK. Verify `android/app/src/main/assets/public/models/pose_landmarker_lite.task` and `android/app/src/main/assets/public/vision/` exist after sync. See [Capacitor’s Android workflow](https://capacitorjs.com/docs/android).

### 3. Generate a test APK

Let Android Studio finish Gradle sync and install any SDK packages it requests. Choose the **debug** build variant and use **Build → Generate App Bundles or APKs → Generate APKs** (menu wording varies by Studio version).

Alternatively, from the Android Studio terminal with its bundled JDK configured:

```sh
cd android
./gradlew assembleDebug
```

The debug APK is at:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

This debug build is automatically signed for local testing. For distribution, use Android Studio’s **Generate Signed Bundle / APK** wizard and preserve the signing key for future updates. Google Play publishing normally uses an AAB. See [Android’s build documentation](https://developer.android.com/build/building-cmdline).

### 4. Install on your Android phone

Either copy `app-debug.apk` to your phone, open it in Files and allow that source to install the package, or enable Developer options / USB debugging, connect your phone, approve its USB prompt, and run:

```sh
adb devices
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Run these commands from the repository root with Android SDK Platform-Tools on your PATH. You can also select the connected device and press **Run** in Android Studio.

### 5. Update and test

After each web change, rebuild and copy the updated assets before generating another APK:

```sh
npm run build
npx cap sync android
```

On the physical phone, verify demo score/feedback, gallery import, video playback, pose overlay, phase seeking, bar calibration/review, history removal/undo and offline analysis. Update Android System WebView if model loading fails. If direct camera capture is unavailable, record with the phone’s Camera app and import the clip from the gallery. Device codecs, camera-picker behavior and worker/WASM support need real-device testing; desktop Chromium/WebKit tests are not a substitute.

Native app storage is separate from browser storage. Your browser’s saved lift history will not automatically appear in the APK. Clearing app data or uninstalling removes locally saved analyses.
