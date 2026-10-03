# Pose reliability and validation

The current milestone improves measurement reliability without replacing the pose model or claiming validated coaching accuracy.

## Processing

- Preserve raw landmark samples in memory. Reanalysis always starts from these samples; filtering is not accumulated on repeated exercise changes.
- Reject an isolated joint only when it deviates from stable adjacent samples **and** its connected segment changes length implausibly. Do not interpolate gaps, bridge multiple people, or average away rapid motion. This conservative check does not repair prolonged occlusion or systematic model errors.
- Select a coherent body side per analyzed repetition using complete measurable joint chains and visibility. This is not frame-by-frame side switching; it avoids mixing limbs mid-check.
- Score pulling-arm position from the lowest three-sample median, not the single lowest elbow angle. Receiving-arm and standing-recovery values use three-sample medians. Every selected value and timestamp belongs to a real observed sample, so the video reference guide remains aligned.
- Keep the hip/knee extension peak measurements: extension can be genuinely brief, so requiring a long plateau would discard valid fast lifts.
- Mark values within 5° of a scoring threshold as “Near threshold.” This is a review band, **not** a calibrated ±5° confidence interval. Existing numeric score thresholds remain unchanged.

“Show raw landmarks” changes only the overlay. Measurements continue using the reliability-filtered data. Raw coordinates and filtered full-body samples remain session-only and are excluded from saved history. Existing saved results keep their original values; re-import recordings for the new processing.

## Repeatable benchmark

Run:

```sh
npm run benchmark:pose
npm run benchmark:pose -- /tmp/pose-benchmark.json
POSE_REFERENCES=/absolute/path/references.json npm run benchmark:pose
```

The benchmark runs a clean synthetic trajectory, a synthetic isolated joint spike, and four existing recording traces. It reports raw/filtered angle error **only where independent reference values exist**, compared/reference sample counts, rejected landmarks, selected side, pose coverage, phase times, and checks.

The initial synthetic spike case has 1.92° average raw error across 78 angles. Filtering excludes the one affected angle (two mirrored elbow landmarks), leaving 77 comparable angles with zero error. The clean trajectory keeps all 78 angles unchanged. This demonstrates correct rejection of a constructed glitch, **not increased accuracy on real athletes**.

The four recorded traces are unannotated. Their angle and phase error fields are `null`, not zero. Their existing regression expectations cover behavior, not independent ground truth. Never use an analyzer's own outputs as accuracy labels.

Optional manual references are a JSON object keyed by benchmark case ID (`hang-start-oblique`, `dowel-front`, `expert-a`, or `expert-b`). Each entry may contain:

- `angles`: an array of `{ "time": number, "side": "left" | "right", "joint": "elbow" | "hip" | "knee", "value": number }`. Times must match source samples; values are independently annotated projected angles in degrees.
- `phases`: an object mapping the persisted phase names (`Setup`, `First pull`, `Transition`, `Second pull`, `Turnover`, `Catch`, `Recovery`) to independently annotated source timestamps.

Compare errors **and** measurement coverage: dropping more difficult measurements must not be presented as an unconditional accuracy improvement. Keep a separate held-out set when tuning thresholds. Include different camera angles, lighting, exercise variants, failed attempts and ordinary non-lifting motion. Have technique feedback reviewed independently by a qualified coach before treating the experimental score as validated.

CI produces a pose benchmark artifact. The script uses cached traces, not network requests or private video uploads. The original supplied desktop recordings are no longer available at their original paths, so this milestone cannot establish improved recognition accuracy on those original pixels.

## Subsequent work

Use independently annotated footage to compare athlete-focused cropping, higher temporal sampling near fast phases, alternative pose models and 3D estimates. These changes are not enabled by this milestone. The previous Full-model trial was inconsistent; do not replace Lite merely because a model is larger. Additional landmarks or smoother animation alone do not establish more accurate feedback.
