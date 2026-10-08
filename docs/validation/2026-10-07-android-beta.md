# Android beta validation — 7 October 2026

## Precision change

Shaft localization now uses bilinear pixel samples followed by a local 0.25-pixel / 0.5-degree refinement of an already supported, unambiguous coarse candidate. It does not smooth the chart, fill missing detections, relax support thresholds or change body/phase scoring.

On 16 independent analytic Gaussian-ridge references at known fractional offsets and angles, mean center-position error fell from 0.4483 to 0.0856 processing pixels; mean angle error fell from 1.0 to 0.2 degrees. Both versions detected 16/16. Details: `2026-10-07-shaft-benchmark.json`; regression: `tests/unit/shaft-precision.test.ts`. These synthetic results do not establish real-athlete measurement accuracy.

The original 27.44-second six-clean video was rerun through the actual local model. Six repetitions and exercise classifications remained stable, with unchanged technique-check counts (5, 5, 2, 2, 2, 1). Refined shaft coverage by repetition was approximately 57%, 58%, 77%, 76%, 74%, 72%. Compared with the original standard detector's approximately 65%, 57%, 75%, 76%, 76%, 65%, coverage changes in both directions. Neither coverage nor a smoother line is an accuracy label. Body angles remain 2D, phases can remain unresolved, and the generic side-view reference is not calibrated to oblique footage.

## Ads and Android

The Capacitor Android build integrates `@capacitor-community/admob` 8.2.0. Google demo application/banner IDs and testing mode are hard-coded deliberately; there is no monetized configuration. The APK was built with JDK 21 and installed on the existing Android emulator.

Confirmed on the native emulator:

- A real Google SDK banner visibly shows “Test Ad” below the navigation.
- Disabling ads removes the sponsor slot and native banner space.
- Disabled preference survives a WebView reload.
- Re-enabling loads the test banner again.

Unit tests cover web/disabled startup without initialization, demo-only IDs, repeated navigation, disabling during initialization, and failure containment. Browser coaching/access tests exercise the UI across desktop Chromium, mobile Chromium and mobile WebKit. Videos continue to be analyzed locally; the ad SDK makes its own network requests.

Before monetized publication, the owner must create an AdMob account and IDs, implement production consent/privacy options and applicable disclosures, and prepare a signed release. The present debug APK is suitable for beta installation, not evidence of production monetization readiness.

## Remaining limits

- No physical Android phone was connected; emulator success does not establish performance or codec support on every phone.
- The existing root-owned `src/services/comparison.ts` and `src/utils/coordinate-map.ts` fail Prettier checks. They require owner/admin write access for formatting; the code was not skipped from CI. Lint, type checks and the test suites are run separately.
- The pre-existing French movement-name test was fixed by using the existing localized catalog, consistent with the README. A transitive high-severity `source-map-js` advisory was resolved with a nonbreaking lockfile update; the subsequent npm audit reported zero vulnerabilities.

## Final checks

- 212 unit tests passed; statement coverage 92.09%, branch coverage 91.23%.
- 117 browser tests passed across desktop Chromium, mobile Chromium and mobile WebKit.
- The raw-overlay seek test now waits for video readiness; nine repeated runs also passed.
- TypeScript, ESLint, production web build, Android `assembleDebug`, and `git diff --check` passed.
- Full `npm run check` remains blocked only at the pre-existing root-owned formatting files noted above.
- Final test artifact: `android/app/build/outputs/apk/debug/app-debug.apk` (approximately 26 MB).

## Strength exercise follow-up

Added manually selected Deadlift, Romanian Deadlift and Bent-over Barbell Row with independent five-phase timing, repetition windows, exercise-specific checks, bar-path windows, localized feedback and persistent scores. Automatic classification still covers only snatch/clean variants. No real strength-exercise footage has been validated; these are experimental 2D heuristics.

Validation: 219 unit tests passed (92.38% statement / 90.96% branch coverage). The browser suite passed 123 tests, with three catalog-count assertions requiring an update from 12 to 15 options; all three then passed on rerun. The nine new upload/history tests passed across desktop Chromium, mobile Chromium and mobile WebKit. ESLint, TypeScript, production build and Android assembleDebug passed. The APK was rebuilt with the new exercises; this follow-up build was not retested on a physical phone. The same two pre-existing formatting failures remain.
