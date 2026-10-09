import { coachingCard } from './coaching';
import { estimateWristBar, wristMetrics } from '../domain/wrist-bar';
import {
  exerciseById,
  expectedChecks,
  strengthExercise,
} from '../domain/exercises';
import { estimatePhases } from '../domain/lift-phases';
import { getBarPathModel } from '../domain/bar-models';
import { barMetrics } from '../domain/bar-track';
import type { VisionAnalysis } from '../domain/vision';
import type { ExerciseComparison } from '../services/comparison';
import { escapeHtml as e, icon } from './html';
import { formatNumber, t } from '../i18n';
import {
  checkDetail,
  checkName,
  movementName,
  phaseEvidence,
  phaseName,
} from './labels';

export function movementPhases(a: VisionAnalysis, canSeek: boolean): string {
  const lift = a.lift ?? estimatePhases(a);
  return `<section class="real-phases analysis-card" aria-label="${e(t('phasesPanel.title'))}"><div class="section-title"><h2>${e(t('phasesPanel.title'))}</h2><span class="micro">${e(t('phasesPanel.coverageCount', { resolved: formatNumber(lift.phases.filter((p) => p.applicable !== false && p.start !== null).length), total: formatNumber(lift.phases.filter((p) => p.applicable !== false).length) }))}</span></div><div class="timeline measured-timeline">${lift.phases.map((p) => `<button data-cv-phase="${e(p.name)}" ${p.start === null ? '' : `data-cv-time="${p.start}"`} ${p.start === null || !canSeek ? 'disabled' : ''} aria-pressed="false"><span class="phase-line ${p.start === null ? 'unresolved' : ''}"></span><b>${p.applicable === false ? e(t('phasesPanel.notApplicable')) : p.start === null ? '—' : `${e(formatNumber(p.start, 2))} s`}</b><span>${e(phaseName(p.name))}${p.estimated ? `<small class="phase-estimate">${e(t('phasesPanel.timingEstimate'))}</small>` : ''}</span></button>`).join('')}</div><p class="footnote">${e(t(strengthExercise(a.exercise?.id ?? undefined) ? 'strength.phaseNote' : 'coaching.phaseNote'))}</p><details><summary>${e(t('phasesPanel.evidenceSummary'))}</summary><dl class="phase-evidence">${lift.phases.map((p) => `<div><dt>${e(phaseName(p.name))} · ${p.applicable === false ? e(t('phasesPanel.notApplicableLong')) : p.start === null ? e(t('phasesPanel.unresolved')) : `${e(formatNumber(p.start, 2))} s`}</dt><dd>${e(phaseEvidence(p))}${p.end !== null && p.start !== null ? ` ${e(t('phasesPanel.duration', { time: formatNumber(p.end - p.start, 2) }))}` : ''}${p.coverage !== null ? ` ${e(t('phasesPanel.usablePoseFrames', { percent: formatNumber(p.coverage * 100, 0) }))}` : ''}</dd></div>`).join('')}</dl></details></section>`;
}

export function techniqueScore(
  a: VisionAnalysis,
  comparison?: ExerciseComparison,
): string {
  const lift = a.lift ?? estimatePhases(a);
  const missing = lift.phases
    .filter((p) => p.start === null && p.applicable !== false)
    .map((p) => p.name);
  const partial =
    lift.score !== null &&
    lift.checks.length < expectedChecks(a.exercise?.id ?? undefined);
  const deltaHtml = comparison
    ? comparison.isFirstRecord
      ? ''
      : comparison.overallDeltaPct !== null
        ? `<div class="score-comparison"><span class="improvement-delta ${comparison.overallDeltaPct > 0 ? 'up' : 'down'}" title="${comparison.overallDeltaPct > 0 ? '+' : ''}${comparison.overallDeltaPct.toFixed(1)}%">${icon(comparison.overallDeltaPct > 0 ? 'arrowUp' : 'arrowDown')}${comparison.overallDeltaPct > 0 ? '+' : ''}${comparison.overallDeltaPct.toFixed(1)}%</span></div>`
        : ''
    : '';
  return `<aside class="measured-score" aria-label="${e(t('checksPanel.experimentalAria'))}"><div class="score" data-measured-score>${lift.score === null || lift.score === undefined ? '—' : formatNumber(lift.score)}${partial ? '<sup class="partial-score-mark" aria-hidden="true">*</sup>' : ''}<small>/ 100</small></div><span class="micro">${e(t('checksPanel.experimentalTitle'))}</span>${partial ? `<p class="footnote">${e(t('vision.partialAnalysis'))} · ${lift.checks.length}/${expectedChecks(a.exercise?.id ?? undefined)}</p>` : ''}<p class="footnote">${lift.score === null || lift.score === undefined ? e(t('checksPanel.notEnoughEvidence')) : e(t('checksPanel.metCount', { met: formatNumber(lift.checks.filter((c) => c.passed).length), total: formatNumber(lift.checks.length) }))}</p>${deltaHtml}${
    partial || missing.length > 0 || lift.phases.some((p) => p.estimated)
      ? `<details class="partial-score-note"><summary aria-label="${e(t('checksPanel.coverageAria'))}" title="${e(t('checksPanel.coverageAria'))}"><span class="partial-badge-text" aria-hidden="true">ⓘ</span></summary><div class="partial-score-popover"><p>${e(
          t('checksPanel.partialCounts', {
            resolved: formatNumber(
              lift.phases.filter((p) => p.start !== null).length,
            ),
            applicable: formatNumber(
              lift.phases.filter((p) => p.applicable !== false).length,
            ),
            available: formatNumber(lift.checks.length),
          }),
        )}</p><p>${missing.length ? e(t('checksPanel.partialMissing', { phases: missing.map(phaseName).join(', ') })) : e(t('checksPanel.partialNoMissing'))}</p><p>${
          lift.phases.some((p) => p.estimated)
            ? e(
                t('checksPanel.partialEstimated', {
                  phases: lift.phases
                    .filter((p) => p.estimated)
                    .map((p) => phaseName(p.name))
                    .join(', '),
                }),
              )
            : ''
        }${e(t('checksPanel.partialDisclaimer'))}</p></div></details>`
      : ''
  }</aside>`;
}

export function measuredSummary(a: VisionAnalysis): string {
  const lift = a.lift ?? estimatePhases(a);
  if (lift.score === null) return t('checksPanel.summaryNoScore');
  const review = lift.checks.filter((c) => !c.passed);
  return review.length
    ? t(
        review.length === 1
          ? 'checksPanel.summaryOne'
          : 'checksPanel.summaryMany',
        {
          count: formatNumber(review.length),
          check: checkName(review[0].name),
          value: formatNumber(review[0].value),
          unit: review[0].unit,
        },
      )
    : t('checksPanel.summaryAll', { count: formatNumber(lift.checks.length) });
}

export function techniqueFeedback(
  a: VisionAnalysis,
  canSeek: boolean,
  comparison?: ExerciseComparison,
): string {
  const lift = a.lift ?? estimatePhases(a);
  const checks = [...lift.checks].sort(
    (x, y) => Number(x.passed) - Number(y.passed),
  );
  return `<section class="technique-section analysis-card" aria-label="${e(t('checksPanel.techniqueAria'))}"><div class="section-title"><h2>${e(t('checksPanel.title'))}</h2><span class="micro">${e(t('checksPanel.measuredCount', { count: formatNumber(checks.length) }))}</span></div>${
    checks.length
      ? checks
          .map((c, i) => {
            const checkDelta = comparison
              ? (comparison.checkDeltas.find((d) => d.name === c.name)
                  ?.deltaPct ?? null)
              : null;
            const deltaHtml =
              checkDelta !== null
                ? `<span class="check-delta ${checkDelta > 0 ? 'up' : 'down'}" title="${checkDelta > 0 ? '+' : ''}${checkDelta.toFixed(1)}%">${icon(checkDelta > 0 ? 'arrowUp' : 'arrowDown')}${checkDelta > 0 ? '+' : ''}${checkDelta.toFixed(1)}%</span>`
                : '';
            return `<details class="issue measured-issue" ${!c.passed ? 'open' : ''}><summary class="issue-toggle"><span class="issue-number">${String(i + 1).padStart(2, '0')}</span><span class="issue-name"><strong>${e(checkName(c.name))}</strong><span class="severity ${c.passed ? 'check-met' : 'moderate'}">${e(t(Math.abs(c.value - c.target) <= 5 ? 'checksPanel.nearThreshold' : c.passed ? 'checksPanel.checkMet' : 'checksPanel.review'))}</span></span><div class="check-score" aria-label="${e(t('checksPanel.scoreAria', { value: formatNumber(c.value), unit: c.unit, target: formatNumber(c.target) }))}"><span class="check-value ${c.passed ? '' : 'miss'}">${e(formatNumber(c.value))}<small>${e(c.unit)}</small>${deltaHtml}</span><span class="check-target">${e(t('checksPanel.target', { target: formatNumber(c.target), unit: c.unit }))}</span></div><span class="expand-icon" aria-hidden="true">+</span></summary><div class="issue-body"><div class="issue-action-bar"><span class="delta-badge ${c.passed ? 'delta-met' : 'delta-short'}">${e(t(c.passed ? 'checksPanel.metDelta' : 'checksPanel.shortDelta', { delta: formatNumber(c.passed ? c.value - c.target : c.target - c.value), unit: c.unit }))}</span><button class="text-link jump-frame-btn" data-cv-time="${c.time}" ${canSeek ? '' : 'disabled'}>${e(t('checksPanel.viewFrame', { time: formatNumber(c.time, 2) }))} ${icon('arrow')}</button></div><p class="issue-coaching-tip">${e(t(Math.abs(c.value - c.target) <= 5 ? 'checksPanel.nearThresholdNote' : c.passed ? 'checksPanel.tipMet' : 'checksPanel.tipReview'))}</p>${coachingCard(a, c, canSeek)}<details class="issue-sub-details"><summary>${e(t('checksPanel.measurementDetail'))}</summary><dl><dt>${e(t('checksPanel.whatMeasured'))}</dt><dd>${e(checkDetail(c.name, c.detail))}</dd><dt>${e(t('checksPanel.result'))}</dt><dd>${e(t(c.passed ? 'checksPanel.meetsTarget' : 'checksPanel.belowTarget', { value: formatNumber(c.value), unit: c.unit, target: formatNumber(c.target) }))}</dd><dt>${e(t('checksPanel.whatToReview'))}</dt><dd>${e(t(c.passed ? 'checksPanel.reviewTiming' : 'checksPanel.reviewAlignment'))}</dd></dl></details></div></details>`;
          })
          .join('')
      : `<p class="notice">${e(t('checksPanel.noneScored'))}</p>`
  }<details><summary>${e(t('checksPanel.howScored'))}</summary><p class="footnote">${e(t('checksPanel.formulaHead'))} ${e(t(exerciseById(a.exercise?.id ?? 'snatch')?.family === 'clean' ? 'checksPanel.formulaRack' : 'checksPanel.formulaReceiving'))}${e(t('checksPanel.formulaStanding'))} ${e(t('checksPanel.formulaDisclaimer'))}</p></details></section>`;
}

export function barPanel(a: VisionAnalysis): string {
  if (['pull-up', 'chin-up', 'back-squat'].includes(a.exercise?.id ?? ''))
    return `<section class="bar-section"><h2>${e(t('barPanel.title'))}</h2><p class="footnote">${e(t('strength.bodyOnly'))}</p></section>`;
  const phases = a.lift?.phases ?? [];
  const pullStart =
    phases.find((p) => p.name === 'First pull' && p.applicable !== false)
      ?.start ??
    phases.find((p) => p.name === 'Second pull')?.start ??
    phases.find((p) => p.name === 'Lifting' || p.name === 'Pull')?.start;
  const catchTime = phases.find(
    (p) => p.name === 'Catch' || p.name === 'Lockout' || p.name === 'Squeeze',
  )?.start;
  const hasWindow =
    pullStart != null && catchTime != null && catchTime > pullStart;
  const inPull = <T extends { time: number }>(points: T[]) =>
    hasWindow
      ? points.filter((p) => p.time >= pullStart! && p.time <= catchTime!)
      : [];
  const manualTrack = a.bar
    ? { ...a.bar, points: inPull(a.bar.points) }
    : undefined;
  const rawWristTrack =
    a.shaftBar ??
    a.wristBar ??
    (a.frames.length ? estimateWristBar(a) : undefined);
  const wristTrack = rawWristTrack
    ? { ...rawWristTrack, points: inPull(rawWristTrack.points) }
    : undefined;
  const isManual =
    manualTrack?.reviewed && (manualTrack.points.length ?? 0) >= 2;
  const track = isManual ? manualTrack : wristTrack;
  const manualMetrics =
    isManual && manualTrack ? barMetrics(manualTrack) : null;
  const wristMetricsResult =
    !isManual && wristTrack ? wristMetrics(wristTrack) : null;
  const exerciseId = a.exercise?.id ?? 'snatch';
  const model = getBarPathModel(exerciseId);
  const exercise = exerciseById(exerciseId);
  const isExerciseResolved = !!exercise;

  let measuredSvgPath = '';
  let minDisplayX = 115,
    maxDisplayX = 265;
  let startDot = '';
  let endDot = '';

  if (track && track.points.length >= 2) {
    const targetDims = {
      centerX: model.refPoints[0][0],
      centerY: model.startY,
      topY: model.topY,
      corridorHalfWidth: 9,
    };
    const py = track.points.map((p) => p.y);
    const dataRange = { minY: Math.min(...py), maxY: Math.max(...py) };

    const displayPoints = track.points;
    displayPoints.forEach((p, i) => {
      // One scale preserves the measured shape; the observed start anchors
      // horizontal position independently of framing within the camera image.
      const scale =
        (targetDims.centerY - targetDims.topY) /
        Math.max(1, dataRange.maxY - dataRange.minY);
      const svgX = targetDims.centerX + (p.x - track.points[0].x) * scale;
      const svgY = targetDims.topY + (p.y - dataRange.minY) * scale;
      minDisplayX = Math.min(minDisplayX, svgX - 8);
      maxDisplayX = Math.max(maxDisplayX, svgX + 8);
      const isBreak =
        i > 0 && p.time - track.points[i - 1].time > 1.6 / a.sampleRate;
      measuredSvgPath += `${i === 0 || isBreak ? 'M' : 'L'}${svgX.toFixed(1)},${svgY.toFixed(1)} `;

      if (i === 0) {
        startDot = `<circle class="figure-plate figure-accent" cx="${svgX.toFixed(1)}" cy="${svgY.toFixed(1)}" r="4.5" stroke-width="2.5"/>`;
      }
      if (i === track.points.length - 1) {
        endDot = `<circle class="figure-accent-fill" cx="${svgX.toFixed(1)}" cy="${svgY.toFixed(1)}" r="5.5"/>`;
      }
    });
  }

  const hasPath = Boolean(
    (isManual ? manualMetrics : wristMetricsResult) &&
    track &&
    track.points.length >= 2 &&
    measuredSvgPath,
  );

  const methodLabel = isManual
    ? t('barPanel.plateTrack')
    : t(
        wristTrack?.method === 'bar-shaft'
          ? 'barPanel.shaftEstimate'
          : wristTrack?.method === 'wrist-midpoint'
            ? 'barPanel.legacyWristEstimate'
            : 'barPanel.wristLineEstimate',
      );

  if (!isExerciseResolved) {
    return `<section class="bar-section analysis-card" aria-label="${e(t('barPanel.pathAria'))}"><div class="section-title"><h2>${e(t('barPanel.title'))}</h2><span class="micro">${e(t('barPanel.exerciseNotResolved'))}</span></div><div class="bar-content measured-bar-content"><div class="bar-path-empty">${e(t('barPanel.selectExercise'))}</div></div></section>`;
  }

  return `<section class="bar-section analysis-card" aria-label="${e(t('barPanel.pathAria'))}"><div class="section-title"><h2>${e(t('barPanel.title'))}</h2><span class="micro">${e(movementName(model.exerciseId, model.exerciseName).toUpperCase())} · ${e(methodLabel.toUpperCase())}</span></div><div class="bar-content measured-bar-content">${
    hasPath
      ? `<svg class="measured-bar-path" viewBox="${minDisplayX.toFixed(1)} 15 ${(maxDisplayX - minDisplayX).toFixed(1)} 355" role="img" aria-label="${e(t(isManual || wristTrack?.method === 'bar-shaft' ? 'barPanel.pathAria' : 'barPanel.wristPathAria', { movement: model.exerciseName }))}"><path class="figure-silhouette" d="${model.silhouette.legs}" fill="none" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><path class="figure-silhouette" d="${model.silhouette.arms}" fill="none" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/><circle class="figure-silhouette-fill" cx="${model.silhouette.head[0]}" cy="${model.silhouette.head[1]}" r="13"/><path class="figure-axis" d="M194 30V354" stroke-dasharray="3 5" stroke-width="1.2"/><path class="figure-reference figure-reference-fill" d="${model.corridorPath}" fill-opacity="0.12" stroke-opacity="0.3" stroke-width="1" stroke-dasharray="2 3"/><path class="figure-reference" d="${model.refTracePath}" fill="none" stroke-width="2.2" stroke-dasharray="4 4" stroke-linecap="round"/><circle class="figure-reference-fill" cx="${model.refPoints[model.refPoints.length - 1][0]}" cy="${model.refPoints[model.refPoints.length - 1][1]}" r="3.5"/><path class="figure-accent" d="${measuredSvgPath}" fill="none" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>${startDot}${endDot}</svg><div class="bar-path-legend"><span class="legend-badge"><span class="legend-indicator legend-corridor-indicator"></span> ${e(t('barPanel.expectedTrace'))}</span><span class="legend-badge"><span class="legend-indicator legend-user-indicator"></span> ${e(isManual || wristTrack?.method === 'bar-shaft' ? t('barPanel.yourBarPath') : t('barPanel.yourWristPath'))}</span></div>`
      : `<div class="bar-path-empty">${e(t(hasWindow ? 'barPanel.bothWristsRequired' : 'barPanel.pullWindowUnavailable'))}</div>`
  }<p class="footnote">${e(t(strengthExercise(a.exercise?.id ?? undefined) ? 'strength.barWindowNote' : 'barPanel.pullWindowNote'))}</p><dl class="bar-metrics">${
    isManual && manualMetrics
      ? `<div><dt>${e(t('barPanel.horizontalDeviation'))}</dt><dd><span class="bar-value">${e(formatNumber(manualMetrics.horizontalCm, 1))}</span><small>cm</small></dd></div><div><dt>${e(t('barPanel.verticalRise'))}</dt><dd><span class="bar-value">${e(formatNumber(manualMetrics.verticalM, 2))}</span><small>m</small></dd></div><div><dt>${e(t('barPanel.peakVelocity'))}</dt><dd><span class="bar-value">${manualMetrics.peakVelocity !== null && manualMetrics.peakVelocity !== undefined ? e(formatNumber(manualMetrics.peakVelocity, 2)) : '—'}</span><small>m/s</small></dd></div>`
      : wristMetricsResult
        ? `<div><dt>${e(t('barPanel.horizontalDeviation'))}</dt><dd><span class="bar-value">${e(formatNumber(wristMetricsResult.horizontal, 1))}</span><small>${e(t('barPanel.frameWidth'))}</small></dd></div><div><dt>${e(t('barPanel.verticalRise'))}</dt><dd><span class="bar-value">${e(formatNumber(wristMetricsResult.rise, 1))}</span><small>${e(t('barPanel.frameHeight'))}</small></dd></div><div><dt>${e(t('barPanel.peakVelocity'))}</dt><dd><span class="bar-value">${wristMetricsResult.velocity !== null && wristMetricsResult.velocity !== undefined ? e(formatNumber(wristMetricsResult.velocity, 1)) : '—'}</span><small>${e(t('barPanel.frameHeightPerSecond'))}</small></dd></div>`
        : `<div><dt>${e(t('barPanel.horizontalDeviation'))}</dt><dd>—<small>${e(t('barPanel.frameWidth'))}</small></dd></div><div><dt>${e(t('barPanel.verticalRise'))}</dt><dd>—<small>${e(t('barPanel.frameHeight'))}</small></dd></div><div><dt>${e(t('barPanel.peakVelocity'))}</dt><dd>—<small>${e(t('barPanel.frameHeightPerSecond'))}</small></dd></div>`
  }</dl>${!isManual ? `<p class="footnote bar-detection-note">${e(wristTrack?.method === 'bar-shaft' ? t('barPanel.shaftNote', { coverage: formatNumber(wristTrack.coverage * 100, 0) }) : wristTrack?.method === 'wrist-midpoint' ? t('barPanel.legacyWristEstimate') : t('barPanel.handFallback'))}</p>` : ''}</section>`;
}
