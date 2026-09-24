import { estimateWristBar, wristMetrics } from '../domain/wrist-bar';
import { exerciseById } from '../domain/exercises';
import { estimatePhases } from '../domain/lift-phases';
import type { VisionAnalysis } from '../domain/vision';
import { escapeHtml as e, icon } from './html';
export function movementPhases(a: VisionAnalysis, canSeek: boolean): string {
  const lift = a.lift ?? estimatePhases(a);
  return `<section class="real-phases" aria-label="Movement phases"><div class="section-title"><h2>Movement phases</h2><span class="micro">${lift.phases.filter((p) => p.applicable !== false).length} PHASES · ESTIMATED</span></div><div class="timeline measured-timeline">${lift.phases.map((p) => `<button data-cv-phase="${e(p.name)}" ${p.start === null ? '' : `data-cv-time="${p.start}"`} ${p.start === null || !canSeek ? 'disabled' : ''} aria-pressed="false"><span class="phase-line ${p.start === null ? 'unresolved' : ''}"></span><b>${p.applicable === false ? 'N/A' : p.start === null ? '—' : p.start.toFixed(2) + ' s'}</b><span>${e(p.name)}${p.estimated ? '<small class="phase-estimate">Timing estimate</small>' : ''}</span></button>`).join('')}</div><p class="footnote">${!a.lift && !a.frames.length ? 'This older summary has no phase data. Re-import the clip to analyze its phases.' : 'Pose-based estimates, not confirmed barbell events. A blank phase means insufficient evidence, not a missing action. Open the phase evidence below for its explanation. No demo timings or scores are used.'} Timing resolution: approximately ${(1 / a.sampleRate).toFixed(2)} s.</p><div id="cv-phase-reading" class="selected-reading" aria-live="polite">Select an available phase to inspect that moment in your video.</div><details><summary>Phase evidence and missing-phase explanations</summary><dl class="phase-evidence">${lift.phases.map((p) => `<div><dt>${e(p.name)} · ${p.applicable === false ? 'Not applicable' : p.start === null ? 'Unresolved' : p.start.toFixed(2) + ' s'}</dt><dd>${e(p.evidence)}${p.end !== null && p.start !== null ? ` Duration: ${(p.end - p.start).toFixed(2)} s.` : ''}${p.coverage !== null ? ` Usable pose frames: ${Math.round(p.coverage * 100)}%.` : ''}</dd></div>`).join('')}</dl></details></section>`;
}
export function techniqueScore(a: VisionAnalysis): string {
  const lift = a.lift ?? estimatePhases(a);
  const missing = lift.phases
    .filter((p) => p.start === null && p.applicable !== false)
    .map((p) => p.name);
  const partial =
    lift.score !== null &&
    (missing.length > 0 ||
      lift.checks.length < 5 ||
      lift.phases.some((p) => p.estimated));
  return `<aside class="measured-score" aria-label="Experimental movement check score"><div class="score" data-measured-score>${lift.score ?? '—'}${partial ? '<sup class="partial-score-mark" aria-label="Partial analysis">*</sup>' : ''}<small>/ 100</small></div><span class="micro">EXPERIMENTAL MOVEMENT SCORE</span><p class="footnote">${lift.score === null ? 'Not enough phase evidence' : `${lift.checks.filter((c) => c.passed).length} of ${lift.checks.length} measured checks met`}</p>${
    partial
      ? `<details class="partial-score-note"><summary>ⓘ Partial analysis</summary><p>${lift.phases.filter((p) => p.start !== null).length} of ${lift.phases.filter((p) => p.applicable !== false).length} phases recognized · ${lift.checks.length} of 5 checks available.</p><p>${missing.length ? `Phases not recognized: ${e(missing.join(', '))}.` : 'Some recognized phases lack enough evidence for their measurement checks.'}</p><p>${
          lift.phases.some((p) => p.estimated)
            ? `Estimated phase timing: ${e(
                lift.phases
                  .filter((p) => p.estimated)
                  .map((p) => p.name)
                  .join(', '),
              )}. `
            : ''
        }Score uses available checks only. Missing phases are not penalized. Even 100/100 is not a complete assessment or a measure of accuracy.</p></details>`
      : ''
  }</aside>`;
}
export function measuredSummary(a: VisionAnalysis): string {
  const lift = a.lift ?? estimatePhases(a);
  if (lift.score === null)
    return 'Body landmarks measured from your video. More phase evidence is needed for a movement score.';
  const review = lift.checks.filter((c) => !c.passed);
  return review.length
    ? `${review.length} measured ${review.length === 1 ? 'check needs' : 'checks need'} review. Start with ${review[0].name.toLowerCase()} (${review[0].value}${review[0].unit}).`
    : `All ${lift.checks.length} measured angle checks met their thresholds. Review the phases and bar path for the full picture.`;
}
export function techniqueFeedback(a: VisionAnalysis, canSeek: boolean): string {
  const lift = a.lift ?? estimatePhases(a);
  const checks = [...lift.checks].sort(
    (x, y) => Number(x.passed) - Number(y.passed),
  );
  return `<section aria-label="Technique observations"><div class="section-title"><h2>The details that matter</h2><span class="micro">${checks.length} MEASURED CHECKS</span></div>${checks.length ? checks.map((c, i) => `<details class="issue measured-issue" ${!c.passed ? 'open' : ''}><summary class="issue-toggle"><span class="issue-number">${String(i + 1).padStart(2, '0')}</span><span class="issue-name"><strong>${e(c.name)}</strong><small>${c.value}${e(c.unit)} measured · target ≥${c.target}${e(c.unit)}</small><span class="severity ${c.passed ? 'check-met' : 'moderate'}">${c.passed ? 'Check met' : 'Review'}</span></span><span class="expand-icon" aria-hidden="true">+</span></summary><div class="issue-body"><button class="text-link" data-cv-time="${c.time}" ${canSeek ? '' : 'disabled'}>VIEW FRAME · ${c.time.toFixed(2)} s ${icon('arrow')}</button><dl><dt>What was measured</dt><dd>${e(c.detail)}</dd><dt>Result</dt><dd>${c.value}${e(c.unit)} ${c.passed ? 'meets' : 'is below'} this prototype’s ${c.target}${e(c.unit)} threshold${c.passed ? '' : ` by ${c.target - c.value}${e(c.unit)}`}.</dd><dt>What to review</dt><dd>${c.passed ? 'Inspect the surrounding phase and estimated wrist path; this angle alone does not establish a successful lift.' : 'Replay this moment and check the joint overlay against the actual limb position. If the measurement is accurate, discuss this position with a coach before changing technique.'}</dd></dl></div></details>`).join('') : '<p class="notice">No technique score assigned. No recognized phase has enough reliable evidence for a measurement check. Try a steady side view with the whole athlete visible.</p>'}<details><summary>How the score is calculated</summary><p class="footnote">Score = checks met ÷ available checks × 100. Missing checks are excluded, not failed. Up to five visible-angle checks are assessed: pull elbow ≥160°, end-of-pull hip and knee ≥165°, ${exerciseById(a.exercise?.id ?? 'snatch')?.family === 'clean' ? 'front-rack elbow flexion ≥60°' : 'receiving elbow ≥165°'}, standing recovery knee ≥165°. These are transparent prototype rules, not validated coaching standards. Tracking coverage is separate. A 100 does not establish a good or successful lift; balance, bar path, timing and individual anatomy are not included.</p></details></section>`;
}
export function barPanel(a: VisionAnalysis): string {
  const track =
    a.wristBar ?? (a.frames.length ? estimateWristBar(a) : undefined);
  const metrics = track ? wristMetrics(track) : null;
  let path = '';
  if (track)
    track.points.forEach((p, i) => {
      path += `${i && p.time - track.points[i - 1].time <= 2.1 / a.sampleRate ? 'L' : 'M'}${p.x},${p.y} `;
    });
  const first = track?.points[0];
  return `<section class="bar-section" aria-label="Estimated bar path"><div class="section-title"><h2>Follow the bar</h2><span class="micro">WRIST-LINE ESTIMATE</span></div><div class="bar-content measured-bar-content">${metrics && track && first ? `<svg class="measured-bar-path" viewBox="0 0 ${track.width} ${track.height}" role="img" aria-label="Estimated wrist-midpoint path with vertical reference"><path d="M${first.x},0V${track.height}" stroke="#a8b09d" stroke-dasharray="4 4"/><path d="${path}" fill="none" stroke="#d4f778" stroke-width="2"/></svg>` : '<div class="bar-path-empty">Both wrists must be visible to estimate the path.</div>'}<dl class="bar-metrics"><div><dt>Horizontal deviation</dt><dd>${metrics ? metrics.horizontal.toFixed(1) : '—'}<small>% frame width</small></dd></div><div><dt>Vertical rise</dt><dd>${metrics ? metrics.rise.toFixed(1) : '—'}<small>% frame height</small></dd></div><div><dt>Peak upward velocity</dt><dd>${metrics?.velocity !== null && metrics?.velocity !== undefined ? metrics.velocity.toFixed(1) : '—'}<small>% frame height / s</small></dd></div></dl></div><p class="footnote">Automatically joins both wrists with a straight line and follows its midpoint. This estimates hand motion, not a detected barbell or physical distance. Camera movement, perspective and grip changes affect the result. Dashed line: vertical reference, not an ideal trajectory. ${track ? `Both wrists visible in ${Math.round(track.coverage * 100)}% of samples. Gaps are excluded.` : 'Re-import this older recording to generate the wrist estimate.'}</p></section>`;
}
