# Validation: six-clean recording, 4 October 2026

## Verdict

The current analysis does **not** pass accuracy validation on this recording. Rep counting works, but phase timing, automatic classification, bar measurements and resulting feedback cannot yet be trusted as a whole. A completed timeline or 100 score is not evidence of correctness.

Input: `video_2026-10-02_20-02-01.mp4`, 27.440989 seconds, 720 × 1280. Processed locally in Chromium through the production app with the real bundled pose model, without mocked detections or external uploads. Captured 412 sampled frame responses at nominal 15 Hz. Reviewed the entire video at 0.5-second intervals, with additional video/pose/shaft comparisons at 2.13, 2.67, 2.80, 3.40, 7.50, 11.27, 18.00, 22.60 and 23.60 seconds.

This is a diagnostic visual review, not coach-certified technique grading or a calibrated joint-angle/3D ground-truth benchmark. Visual times below are approximate; no millisecond timing accuracy is claimed.

## Repetition review

| Rep | App interval  | Visible movement                                     | Automatic result      | Score and checks          | Finding                                                                                                                                                                                                                            |
| --- | ------------- | ---------------------------------------------------- | --------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 0.00–4.93 s   | Floor clean with deep receiving position             | Clean                 | 80; 4/5 passed            | Family correct. First pull at 0.40 s and transition at 0.53 s describe setup changes, well before the main ascent around 2.5–3.0 s. Second pull at 2.13 s is also too early. Catch at 3.33 s is broadly consistent with receiving. |
| 2   | 4.93–9.67 s   | Another floor clean with deep receiving position     | Unresolved            | No score/checks           | Failed classification despite a visible clean. All phases blank.                                                                                                                                                                   |
| 3   | 9.67–13.33 s  | Hang/high-hang clean with shallow receiving position | High-hang power clean | 100; 5/5 passed           | Family broadly plausible. Claimed hip/knee extension at 11.27 s is preparation, not the explosive extension near the subsequent pull.                                                                                              |
| 4   | 13.33–15.80 s | Hang/high-hang clean with shallow receiving position | High-hang power clean | 100; 2/2 available passed | Turnover unresolved. The score omits three of five checks and cannot mean perfect technique.                                                                                                                                       |
| 5   | 15.80–20.93 s | Hang/high-hang clean with deep receiving position    | High-hang clean       | 100; 2/2 available passed | Turnover unresolved. Receiving around 18.67 s is plausible; preparation remains inside the selected interval.                                                                                                                      |
| 6   | 20.93–26.27 s | Hang/high-hang clean with deep receiving position    | High-hang clean       | 100; 4/4 available passed | Second pull 22.13 s and turnover/extension 22.60 s occur during preparation before the visible pull around 23 s. Recovery marked at 24.00 s while the athlete remains in the squat; standing is around 25.5 s.                     |

Six detected intervals correspond to six visible lifts. Their boundaries include lowering/resetting from the previous repetition and waiting before the next lift. They are candidate windows, not accurately cropped exercise-only segments. Exact hang versus high-hang labels need confirmation from the actual starting height, not just standing frames.

## Bar path

All six results selected the experimental pixel-shaft track. Detection coverage was 65.3%, 56.9%, 75.0%, 76.3%, 75.6%, and 65.4%, respectively. Coverage indicates availability, **not accuracy**.

The candidate line approximately follows the shaft in several inspected frames (for example 2.67, 2.80 and 23.60 s). Correction after exact-timestamp review: the original 7.50 s comparison mistakenly used the 7.533333 s detection. At the matching video timestamp, the candidate is substantially better aligned. That example does not establish a false shaft detection. This still does not validate every bar sample or the derived trajectory.

The current midpoint is based on a shaft segment near the estimated grip; it is not a tracked fixed material point on the bar. Changes in grip localization or the detected segment can move the midpoint without equivalent bar movement. The chart also includes setup/lowering portions inside the selected rep window.

The oblique video projection cannot be directly compared with the static side-view reference as if their axes were equivalent. Camera motion is not compensated. The chart's expected corridor is illustrative, not a validated acceptable-error band for this recording.

Rep 1 reports horizontal deviation 16.5% of frame width, vertical rise 39.0% of frame height and peak upward velocity 76.8% of frame height per second. These are derived image measurements, not validated physical bar distances or speeds. They should not be accepted as accurate from this run.

## Body measurements, feedback and score

Pose coverage is approximately 93–100% across reps, but visible landmarks can still be misplaced. The near-oblique view produces overlapping limbs and severely foreshortened segments, especially at the front rack.

Rep 1's saved elbow range is 4–175 degrees. Its front-rack check uses 169 degrees of flexion (11-degree projected elbow angle). These values require inspection and do not validate anatomical joint angles. The app's 153-degree pulling-arm observation at 2.67 s is insufficient on its own to establish early arm bending in this view.

Scoring is pass-count divided by available-check count. This produces 100 on reps 4 and 5 from only two checks, and uses incorrectly located extension frames on reps 3 and 6. Consequently neither these scores nor the derived coaching recommendations are validated. No replacement expert score was invented in this review.

## Required fixes, in priority order

1. Locate movement onset after the final setup/reset and constrain phase ordering to that active movement. Standing preparation must not satisfy explosive extension or turnover. Recovery must follow receiving and sustained standing.
2. Fix exercise classification on rep 2 and test floor versus hang starting-position evidence separately from standing preparation and previous-rep lowering.
3. Require shaft candidates to retain pixel support on the actual bar across time. Track a consistent bar feature; reject clothing/hand edges. Use manually annotated video samples for precision and coverage evaluation.
4. Exclude release/lowering and idle setup from the comparison trajectory, and handle viewpoint/camera motion before comparing against a side-view reference.
5. Gate feedback on joint geometry and phase-event reliability, not landmark visibility alone. Distinguish partial check pass rate from a validated technique score.

Keep this recording as a local regression case, with independently marked phase intervals and shaft locations before tuning thresholds. Do not make the six traces pass by filling missing phases or forcing the path into the reference corridor.

## Scope

This task validated the current implementation. No analysis thresholds or application behavior were changed during the validation. Diagnostic output and contact sheets were saved locally under `/tmp/snatchy-*`; the original video was not copied into the repository. The previous build and synthetic tests passing did not establish accuracy on this real footage.

## Tuning follow-up

The subsequent tuning fixes classification of rep 2 as Clean, moves rep 1 first pull from 0.40 to 2.47 seconds, rep 3 upper pull from 10.60 to 11.60 seconds, and rep 6 upper pull from 22.13 to 22.87 seconds. Recovery requires rising hip position as well as receiving/joint evidence. Rep 1 recovery moves from 4.00 to 4.27 seconds; rep 5 moves from 19.53 to 19.80 seconds. Recovery denotes the ascent out of receiving, not necessarily the instant standing is complete.

Earlier unsupported extension checks on reps 3 and 6 are no longer scored. Rep 6 recovery is withheld because the available pose sequence cannot meet the recovery evidence checks; it is not filled using expected timing. Rep 1's transition and second-pull boundaries also remain unresolved. More blank fields here mean previously false evidence was removed, not that the algorithm now measures every phase.

Partial results retain the requested numeric score, but the heading now says Partial analysis instead of a positive whole-lift verdict, with available checks shown explicitly out of five. Scores remain experimental pass rates, not coach-validated grades. Current check counts are 5, 5, 2, 2, 2, 1 across the six reps; scores are 80, 100, 100, 100, 100, 100 respectively.

A stricter two-sided shaft-support experiment reduced first-rep coverage from 65% to 35% and removed a useful detection, without establishing better accuracy. It was rejected; the existing shaft detector is retained. The chart design remains unchanged in this tuning pass.

Numeric pose samples from this video are stored in `tests/fixtures/six-clean-trace.json`, without video pixels. Regression tests require six clean-family repetitions, correct classification of the two floor lifts, pull timestamps within broad visually reviewed intervals, no extension checks during preparation, and no recovery during the final squat descent. This video is now tuning data, not an independent held-out accuracy benchmark.
