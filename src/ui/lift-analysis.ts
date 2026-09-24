import { estimateWristBar, wristMetrics } from '../domain/wrist-bar';
import { exerciseById } from '../domain/exercises';
import { estimatePhases } from '../domain/lift-phases';
import { snatchPose, barTrace, MOTION, type Point } from '../domain/snatch-motion';
import type { VisionAnalysis } from '../domain/vision';
import { escapeHtml as e, icon } from './html';

const formatPoint = (p: Point) => p.map((n) => n.toFixed(2)).join(',');

export function movementPhases(a: VisionAnalysis, canSeek: boolean): string {
  const lift = a.lift ?? estimatePhases(a);
  return `<section class="real-phases" aria-label="Movement phases"><div class="section-title"><h2>Movement phases</h2><span class="micro">${lift.phases.filter((p) => p.applicable !== false).length} PHASES · ESTIMATED</span></div><div class="timeline measured-timeline">${lift.phases.map((p) => `<button data-cv-phase="${e(p.name)}" ${p.start === null ? '' : `data-cv-time="${p.start}"`} ${p.start === null || !canSeek ? 'disabled' : ''} aria-pressed="false"><span class="phase-line ${p.start === null ? 'unresolved' : ''}"></span><b>${p.applicable === false ? 'N/A' : p.start === null ? '—' : p.start.toFixed(2) + ' s'}</b><span>${e(p.name)}${p.estimated ? '<small class="phase-estimate">Timing estimate</small>' : ''}</span></button>`).join('')}</div><div id="cv-phase-reading" class="selected-reading" aria-live="polite">Select an available phase to inspect that moment in your video.</div><details><summary>Phase evidence and missing-phase explanations</summary><dl class="phase-evidence">${lift.phases.map((p) => `<div><dt>${e(p.name)} · ${p.applicable === false ? 'Not applicable' : p.start === null ? 'Unresolved' : p.start.toFixed(2) + ' s'}</dt><dd>${e(p.evidence)}${p.end !== null && p.start !== null ? ` Duration: ${(p.end - p.start).toFixed(2)} s.` : ''}${p.coverage !== null ? ` Usable pose frames: ${Math.round(p.coverage * 100)}%.` : ''}</dd></div>`).join('')}</dl></details></section>`;
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
      ? `<details class="partial-score-note"><summary><span class="partial-badge-text">ⓘ Partial analysis</span></summary><div class="partial-score-popover"><p>${lift.phases.filter((p) => p.start !== null).length} of ${lift.phases.filter((p) => p.applicable !== false).length} phases recognized · ${lift.checks.length} of 5 checks available.</p><p>${missing.length ? `Phases not recognized: ${e(missing.join(', '))}.` : 'Some recognized phases lack enough evidence for their measurement checks.'}</p><p>${
          lift.phases.some((p) => p.estimated)
            ? `Estimated phase timing: ${e(
                lift.phases
                  .filter((p) => p.estimated)
                  .map((p) => p.name)
                  .join(', '),
              )}. `
            : ''
        }Score uses available checks only. Missing phases are not penalized. Even 100/100 is not a complete assessment or a measure of accuracy.</p></div></details>`
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
  return `<section class="technique-section" aria-label="Technique observations"><div class="section-title"><h2>The details that matter</h2><span class="micro">${checks.length} MEASURED CHECKS</span></div>${checks.length ? checks.map((c, i) => `<details class="issue measured-issue" ${!c.passed ? 'open' : ''}><summary class="issue-toggle"><span class="issue-number">${String(i + 1).padStart(2, '0')}</span><span class="issue-name"><strong>${e(c.name)}</strong><span class="severity ${c.passed ? 'check-met' : 'moderate'}">${c.passed ? 'Check met' : 'Review'}</span></span><div class="check-score" aria-label="Measured ${c.value}${e(c.unit)}, target ${c.target}${e(c.unit)}"><span class="check-value ${c.passed ? '' : 'miss'}">${c.value}<small>${e(c.unit)}</small></span><span class="check-target">target ≥${c.target}${e(c.unit)}</span></div><span class="expand-icon" aria-hidden="true">+</span></summary><div class="issue-body"><div class="issue-action-bar"><span class="delta-badge ${c.passed ? 'delta-met' : 'delta-short'}">${c.passed ? `+${c.value - c.target}${e(c.unit)} vs target` : `${c.target - c.value}${e(c.unit)} below threshold`}</span><button class="text-link jump-frame-btn" data-cv-time="${c.time}" ${canSeek ? '' : 'disabled'}>VIEW FRAME · ${c.time.toFixed(2)} s ${icon('arrow')}</button></div><p class="issue-coaching-tip">${c.passed ? 'Position met target extension standard.' : 'Review this moment in the video overlay to inspect joint alignment.'}</p><details class="issue-sub-details"><summary>Measurement detail</summary><dl><dt>What was measured</dt><dd>${e(c.detail)}</dd><dt>Result</dt><dd>${c.value}${e(c.unit)} ${c.passed ? 'meets' : 'is below'} target threshold of ≥${c.target}${e(c.unit)}.</dd><dt>What to review</dt><dd>${c.passed ? 'Inspect surrounding phase timing and wrist path.' : 'Check the joint overlay against the actual limb position.'}</dd></dl></details></div></details>`).join('') : '<p class="notice">No technique score assigned. No recognized phase has enough reliable evidence for a measurement check. Try a steady side view with the whole athlete visible.</p>'}<details><summary>How the score is calculated</summary><p class="footnote">Score = checks met ÷ available checks × 100. Missing checks are excluded, not failed. Up to five visible-angle checks are assessed: pull elbow ≥160°, end-of-pull hip and knee ≥165°, ${exerciseById(a.exercise?.id ?? 'snatch')?.family === 'clean' ? 'front-rack elbow flexion ≥60°' : 'receiving elbow ≥165°'}, standing recovery knee ≥165°. These are transparent prototype rules, not validated coaching standards.</p></details></section>`;
}

export function barPanel(a: VisionAnalysis): string {
  const track =
    a.wristBar ?? (a.frames.length ? estimateWristBar(a) : undefined);
  const metrics = track ? wristMetrics(track) : null;
  const pose = snatchPose(MOTION.catchTime);
  const refPoints = barTrace(MOTION.duration);
  const refTracePath = refPoints
    .map((p, i) => `${i ? 'L' : 'M'}${formatPoint(p)}`)
    .join(' ');

  const corridorLeft = refPoints.map((p) => `${(p[0] - 9).toFixed(1)},${p[1].toFixed(1)}`);
  const corridorRight = [...refPoints].reverse().map((p) => `${(p[0] + 9).toFixed(1)},${p[1].toFixed(1)}`);
  const corridorPath = `M${corridorLeft.join(' L')} L${corridorRight.join(' L')} Z`;

  let measuredSvgPath = '';
  let startDot = '';
  let endDot = '';

  if (track && track.points.length >= 2) {
    const py = track.points.map((p) => p.y);
    const px = track.points.map((p) => p.x);
    const minY = Math.min(...py);
    const maxY = Math.max(...py);
    const ySpan = Math.max(1, maxY - minY);
    const firstX = track.points[0].x;
    const scale = 278 / ySpan;

    track.points.forEach((p, i) => {
      const normY = (maxY - p.y) / ySpan;
      const svgY = 324 - normY * 278;
      const svgX = Math.max(120, Math.min(260, 218 + (p.x - firstX) * scale));
      const isBreak =
        i > 0 && p.time - track.points[i - 1].time > 2.1 / a.sampleRate;
      measuredSvgPath += `${i === 0 || isBreak ? 'M' : 'L'}${svgX.toFixed(1)},${svgY.toFixed(1)} `;

      if (i === 0) {
        startDot = `<circle cx="${svgX.toFixed(1)}" cy="${svgY.toFixed(1)}" r="4.5" fill="#182014" stroke="#d4f778" stroke-width="2.5"/>`;
      }
      if (i === track.points.length - 1) {
        endDot = `<circle cx="${svgX.toFixed(1)}" cy="${svgY.toFixed(1)}" r="5.5" fill="#d4f778"/>`;
      }
    });
  }

  const hasPath = Boolean(metrics && track && track.points.length >= 2 && measuredSvgPath);

  return `<section class="bar-section" aria-label="Estimated bar path"><div class="section-title"><h2>Follow the bar</h2><span class="micro">WRIST-LINE ESTIMATE</span></div><div class="bar-content measured-bar-content">${
    hasPath
      ? `<svg class="measured-bar-path" viewBox="115 15 150 355" role="img" aria-label="Estimated wrist trajectory compared against expected trace error margin and athlete silhouette"><path d="M${formatPoint(pose.shoulder)}L${formatPoint(pose.hip)}L${formatPoint(pose.knee)}L${formatPoint(pose.ankle)}M${formatPoint(pose.shoulder)}L${formatPoint(pose.bar)}" fill="none" stroke="#2d3824" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${pose.head[0]}" cy="${pose.head[1]}" r="13" fill="#2d3824"/><path d="M194 30V354" stroke="#48573b" stroke-dasharray="3 5" stroke-width="1.2"/><path d="${corridorPath}" fill="#73c9ff" fill-opacity="0.12" stroke="#73c9ff" stroke-opacity="0.3" stroke-width="1" stroke-dasharray="2 3"/><path d="${refTracePath}" fill="none" stroke="#73c9ff" stroke-width="2.2" stroke-dasharray="4 4" stroke-linecap="round"/><circle cx="194" cy="46" r="3.5" fill="#73c9ff"/><path d="${measuredSvgPath}" fill="none" stroke="#d4f778" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>${startDot}${endDot}</svg><div class="bar-path-legend"><span class="legend-badge"><span class="legend-indicator legend-corridor-indicator"></span> Expected trace (± margin)</span><span class="legend-badge"><span class="legend-indicator legend-user-indicator"></span> Your wrist path</span></div>`
      : '<div class="bar-path-empty">Both wrists must be visible to estimate the path.</div>'
  }<dl class="bar-metrics"><div><dt>Horizontal deviation</dt><dd>${metrics ? metrics.horizontal.toFixed(1) : '—'}<small>% frame width</small></dd></div><div><dt>Vertical rise</dt><dd>${metrics ? metrics.rise.toFixed(1) : '—'}<small>% frame height</small></dd></div><div><dt>Peak upward velocity</dt><dd>${metrics?.velocity !== null && metrics?.velocity !== undefined ? metrics.velocity.toFixed(1) : '—'}<small>% frame height / s</small></dd></div></dl></div></section>`;
}
