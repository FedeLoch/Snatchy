import { handBarPoint } from '../domain/wrist-bar';
import { features } from '../services/features';
import { referenceVector } from '../domain/coaching';
import type { MovementCheck } from '../domain/lift-phases';
import { exercises, exerciseById, expectedChecks } from '../domain/exercises';
import { historyScore, scoreBand } from '../domain/score-summary';
import {
  movementPhases,
  measuredSummary,
  techniqueScore,
  techniqueFeedback,
  barPanel,
} from './lift-analysis';
import { estimatePhases } from '../domain/lift-phases';
import { visionRadar } from './radar';
import { compareWithPrevious } from '../services/comparison';
import type { ExerciseComparison } from '../services/comparison';
import {
  anglesAt,
  nearestSample,
  visible,
  type VisionRecord,
  type VisionAnalysis,
} from '../domain/vision';
import type { VideoSource } from '../domain/types';
import type { LiftRecord } from '../domain/types';
import { escapeHtml as e, icon } from './html';
import { footer } from './views';
import { formatDateTime, formatNumber, t } from '../i18n';
import {
  eventDetail,
  eventTitle,
  jointName,
  movementName,
  sideName,
} from './labels';
const links = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 7],
  [0, 4],
  [4, 5],
  [5, 6],
  [6, 8],
  [9, 10],
  [15, 17],
  [15, 19],
  [15, 21],
  [17, 19],
  [16, 18],
  [16, 20],
  [16, 22],
  [18, 20],
  [27, 29],
  [29, 31],
  [28, 30],
  [30, 32],
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
  [27, 31],
  [28, 32],
];
export function visionRows(records: VisionRecord[]): string {
  if (!records.length) return '';
  return `<div class="lift-list">${records
    .map((r) => {
      const score = historyScore(r.analysis);
      const exercise =
        r.analysis.repetitions?.[0]?.exercise ?? r.analysis.exercise;
      const name =
        exerciseById(exercise?.id ?? (exercise ? '' : 'snatch'))?.name ??
        t('vision.movementFallback');
      const reps = r.analysis.repetitions?.length ?? 0;
      const status = reps
        ? t(reps === 1 ? 'vision.repDetectedOne' : 'vision.repsDetectedMany', {
            count: formatNumber(reps),
          })
        : r.analysis.status === 'tracked'
          ? t('vision.poseTracked')
          : t('vision.limitedTracking');
      const notes = [
        status,
        ...(score.partial ? [t('vision.partialAnalysis')] : []),
        ...(score.count > 1 ? [t('vision.averageScore')] : []),
      ];
      const scoreLabel =
        score.value === null
          ? t('vision.scoreUnavailable')
          : t(score.count > 1 ? 'vision.scoreAverage' : 'vision.scoreOf', {
              score: formatNumber(score.value),
            });
      const scoreAria = score.partial
        ? t('vision.scorePartial', { score: scoreLabel })
        : scoreLabel;
      return `<div class="history-entry"><a class="lift-row" href="#vision/${r.id}" aria-label="${e(t('vision.openAnalysis'))}"><span class="lift-description"><strong>${e(name)}</strong><small>${e(formatDateTime(r.createdAt))}</small><small>${notes.map(e).join('<span class="row-dot">·</span>')}</small></span><span class="lift-score" aria-label="${e(scoreAria)}">${score.value === null ? '—' : formatNumber(score.value)}<small>/100</small></span>${icon('arrow')}</a><button class="history-remove" data-action="remove-history" data-kind="vision" data-id="${r.id}" aria-label="${e(t('vision.removeAnalysis'))}">${icon('close')}</button></div>`;
    })
    .join('')}</div>`;
}
export function visionProcessing(): string {
  return `<div class="narrow"><div class="eyebrow">${e(t('vision.eyebrow'))}</div><h1>${e(t('vision.titleLead'))}<br>${e(t('vision.titleAccent'))}<span class="accent">.</span></h1><p>${e(t('vision.lede'))}</p><div class="vision-progress"><progress max="1" value="0" aria-label="${e(t('vision.progressAria'))}"></progress><p id="vision-progress-label" role="status">${e(t('vision.loadingModel'))}</p></div><button class="secondary" data-action="cancel">${e(t('vision.cancel'))} ${icon('close')}</button><p class="footnote">${e(t('vision.firstRun'))}</p></div>`;
}
function angleChart(a: VisionAnalysis): string {
  const start = a.interval?.start ?? 0;
  const span = a.duration - start;
  const points = a.frames.map((f) => ({
    time: f.time,
    angle: anglesAt(f, a.side, a.width, a.height).elbow,
  }));
  let path = '',
    pen = false;
  for (const p of points) {
    if (p.angle === null) {
      pen = false;
      continue;
    }
    path += `${pen ? 'L' : 'M'}${(((p.time - start) / span) * 300).toFixed(2)},${(100 - (p.angle / 180) * 90).toFixed(2)} `;
    pen = true;
  }
  return `<svg viewBox="0 0 320 120" role="img" aria-label="${e(t('vision.chartAria'))}"><path class="chart-grid" d="M0 10h300M0 55h300M0 100h300" stroke-width=".5"/><path class="chart-accent" d="${path}" stroke-width="2"/><text class="chart-label" x="0" y="117" font-size="9">${e(formatNumber(start, 1))} s</text><text class="chart-label" x="270" y="117" font-size="9">${e(formatNumber(a.duration, 1))} s</text></svg>`;
}
export function visionResult(
  record: VisionRecord,
  source: VideoSource | null,
  warning: string,
  allRecords: LiftRecord[] = [],
): string {
  const a = record.analysis;
  const lift = a.lift ?? estimatePhases(a);
  const applicablePhases = lift.phases.filter((p) => p.applicable !== false);
  const recognisedPhases = applicablePhases.filter((p) => p.start !== null);
  const checksMet = lift.checks.filter((c) => c.passed).length;
  const comparison: ExerciseComparison = compareWithPrevious(
    allRecords,
    record as unknown as LiftRecord,
  );
  return `<a class="back" href="#history">${icon('back')} ${e(t('result.back'))}</a><div class="eyebrow">${e((a.exercise?.id === null ? undefined : exerciseById(a.exercise?.id ?? 'snatch')?.name) ?? t('vision.exerciseNotResolved'))} <span class="tag">${e(t('vision.measuredPoseTag'))}</span></div><div class="result-heading"><div><h1>${e(a.lift?.score !== null && a.lift?.checks && a.lift.checks.length < expectedChecks(a.exercise?.id ?? undefined) ? t('vision.partialAnalysis') : t(`verdicts.${scoreBand(a.lift?.score)}`))}<span class="accent">.</span></h1><p>${e(measuredSummary(a))}</p></div>${techniqueScore(a, comparison)}</div><dl class="quick-verdict" aria-label="${e(t('vision.resultsAtAGlance'))}"><div><dt>${e(t('vision.phasesRecognised'))}</dt><dd>${e(formatNumber(recognisedPhases.length))}<small>/ ${e(formatNumber(applicablePhases.length))}</small></dd></div><div><dt>${e(t('vision.measuredChecksMet'))}</dt><dd>${formatNumber(checksMet)}<small> ${e(t('vision.checksMetOf', { total: formatNumber(lift.checks.length) }))}</small></dd></div><div><dt>${e(t('vision.poseCoverage'))}</dt><dd>${e(formatNumber(a.coverage * 100, 0))}<small>%</small></dd></div></dl>${warning ? `<p class="notice" role="status">${e(warning)}</p>` : ''}<div class="exercise-review"><div class="exercise-review-controls"><label for="result-exercise">${e(t('vision.exerciseLabel'))}</label><select id="result-exercise" ${!a.frames.length ? 'disabled' : ''}><option value="auto" ${a.exercise?.source !== 'manual' ? 'selected' : ''}>${e(t('vision.automaticSuggestion'))} · ${e(a.exercise?.id ? movementName(a.exercise.id, exerciseById(a.exercise.id)?.name ?? '') : t('vision.selectManually'))}</option>${exercises.map((x) => `<option value="${x.id}" ${a.exercise?.source === 'manual' && a.exercise.id === x.id ? 'selected' : ''}>${e(movementName(x.id, x.name))}</option>`).join('')}</select></div></div><div class="analysis-layout"><div class="video-column"><section class="video-card analysis-card" aria-label="${e(t('vision.resultVideoAria'))}">${source ? `<div class="cv-stage"><video id="cv-video" src="${e(source.url)}" controls playsinline preload="metadata" aria-label="${e(t('vision.yourAnalyzedLiftVideo'))}"></video><svg id="cv-overlay" viewBox="0 0 ${a.width} ${a.height}" aria-hidden="true"></svg></div><div class="cv-controls"><button id="cv-pose" class="secondary" aria-pressed="true">${e(t('vision.trackedPoseOn'))}</button><button id="cv-raw" class="secondary" aria-pressed="false">${e(t('vision.rawOverlay'))}</button><button id="cv-speed" class="secondary">${e(t('vision.playbackSpeed', { speed: formatNumber(1) }))}</button></div><div id="coaching-reference-note" class="footnote" hidden><p>${e(t('coaching.vectorNote'))}</p><button id="coaching-reference-off" class="secondary">${e(t('coaching.hideVector'))}</button></div><p class="footnote">${e(t('vision.filterNote'))}</p><p id="cv-frame-status" class="footnote">${e(t('vision.frameStatusHint'))}</p><div id="cv-angles" class="live-angles"></div><p id="cv-media-error" class="error" role="alert"></p>` : `<div class="notice"><strong>${e(t('vision.savedSummaryTitle'))}</strong><p>${e(t('vision.savedSummaryBody'))}</p><a href="#capture" class="text-link">${e(t('vision.importClipAgain'))}</a></div>`}</section>${movementPhases(a, !!source)}${a.frames.length && a.status === 'tracked' ? `<section class="motion-card analysis-card"><div class="section-title"><h2>${e(t('vision.elbowMotion'))}</h2><span class="micro">${e(t('vision.projectedAngle'))}</span></div>${angleChart(a)}</section>` : ''}<section class="quality-card analysis-card"><div class="section-title"><h2>${e(t('vision.trackingQuality'))}</h2><span class="micro">${e(t('vision.samplesPerSecond', { count: formatNumber(a.sampleRate) }))}</span></div><div class="quality-summary"><b>${e(formatNumber(a.coverage * 100, 0))}<small>%</small></b><div><strong>${e(t('vision.usableFrames'))}</strong><p>${e(t('vision.samplesOfSide', { usable: formatNumber(a.usableFrames), total: formatNumber(a.sampledFrames), side: sideName(a.side) }))}</p></div></div>${a.status === 'insufficient' ? `<div class="notice"><strong>${e(t('vision.insufficientTitle'))}</strong><p>${e(t('vision.insufficientBody'))}</p></div>` : ''}</section></div><div class="feedback-column">${techniqueFeedback(a, !!source, comparison)}${barPanel(a)}<section class="ranges-card analysis-card"><div class="section-title"><h2>${e(t('vision.measuredJointRanges'))}</h2><span class="micro">${e(t('vision.twoDAngles'))}</span></div><div class="measured-ranges">${(['elbow', 'hip', 'knee'] as const).map((key) => `<div><span>${e(jointName(key))}</span><b>${a.ranges[key] ? `${e(formatNumber(a.ranges[key]!.min, 0))}–${e(formatNumber(a.ranges[key]!.max, 0))}°` : e(t('radarPanel.unavailable'))}</b></div>`).join('')}</div></section><section class="moments-card analysis-card"><div class="section-title"><h2>${e(t('vision.momentsToInspect'))}</h2><span class="micro">${e(t('vision.eventsCount', { count: formatNumber(a.events.length) }))}</span></div>${a.events.length ? a.events.map((event) => `<article class="measured-event"><button data-cv-time="${event.time}" ${source ? '' : 'disabled'}><span>${e(eventTitle(event.title))}</span><b>${e(formatNumber(event.time, 2))} s ${icon('arrow')}</b></button><p>${e(eventDetail(event.id, event.detail, event.values))}</p><span class="event-kind">${e(t(event.kind === 'hypothesis' ? 'vision.kindHypothesis' : 'vision.kindMeasured'))}</span></article>`).join('') : `<p class="notice">${e(t(a.status === 'tracked' ? 'vision.noMotionEventsTracked' : 'vision.noMotionEventsQuality'))}</p>`}</section>${visionRadar(a)}</div></div><a class="primary compact" href="#capture">${e(t('vision.analyzeAnotherVideo'))} ${icon('arrow')}</a>${footer()}`;
}
export function bindVisionPlayback(
  root: HTMLElement,
  a: VisionAnalysis,
): () => void {
  const video = root.querySelector<HTMLVideoElement>('#cv-video');
  if (!video) return () => {};
  const overlay = root.querySelector<SVGElement>('#cv-overlay')!,
    status = root.querySelector<HTMLElement>('#cv-frame-status')!,
    angles = root.querySelector<HTMLElement>('#cv-angles')!;
  let reference: MovementCheck | undefined;
  let rawOverlay = false;
  let enabled = true,
    raf = 0,
    lastTime = -1,
    disposed = false;
  function draw() {
    if (!video || disposed) return;
    const lift = a.lift ?? estimatePhases(a);
    root
      .querySelectorAll<HTMLButtonElement>('[data-cv-phase]')
      .forEach((button) => {
        const phase = lift.phases.find(
          (p) => p.name === button.dataset.cvPhase,
        );
        button.setAttribute(
          'aria-pressed',
          String(
            phase?.start !== null &&
              phase?.start !== undefined &&
              phase.end !== null &&
              video.currentTime >= phase.start &&
              video.currentTime < phase.end,
          ),
        );
      });
    const f = nearestSample(
      a.frames,
      video.currentTime,
      1 / a.sampleRate + 0.02,
    );
    if (!f || f.people !== 1) {
      overlay.innerHTML = '';
      angles.textContent = '';
      status.textContent = t(
        f && f.people > 1
          ? 'vision.frameMultiplePeople'
          : 'vision.frameTrackingUnavailable',
      );
      return;
    }
    const good = f.landmarks.filter(visible).length;
    status.textContent = t('vision.frameStatus', {
      time: formatNumber(f.time, 2),
      good: formatNumber(good),
      side: sideName(a.side),
    });
    const thickness = Math.max(a.width, a.height) / 350;
    const overlayLandmarks = rawOverlay
      ? (f.rawLandmarks ?? f.landmarks)
      : f.landmarks;
    const segments = links
      .filter(
        ([start, end]) =>
          visible(overlayLandmarks[start]) && visible(overlayLandmarks[end]),
      )
      .map(([start, end]) => {
        const p = overlayLandmarks[start],
          q = overlayLandmarks[end];
        return `<line x1="${p.x * a.width}" y1="${p.y * a.height}" x2="${q.x * a.width}" y2="${q.y * a.height}"/>`;
      })
      .join('');
    const joints = overlayLandmarks
      .map((_, i) => i)
      .filter((i) => visible(overlayLandmarks[i]))
      .map((i) => {
        const p = overlayLandmarks[i];
        return `<circle cx="${p.x * a.width}" cy="${p.y * a.height}" r="${thickness * 2}"/>`;
      })
      .join('');
    overlay.innerHTML = enabled
      ? `<g class="tracked-pose figure-accent figure-accent-fill" stroke-width="${thickness}">${segments}${joints}</g>`
      : '';
    const barTrack = a.shaftBar ?? a.wristBar;
    const hand = barTrack
      ? barTrack.points.find((p) => Math.abs(p.time - f.time) < 0.001)
      : handBarPoint(f, a.width, a.height);
    if (hand)
      overlay.innerHTML += `<g class="${a.shaftBar ? 'shaft-bar-estimate' : 'hand-bar-estimate'}"><line class="figure-reference" x1="${hand.left.x}" y1="${hand.left.y}" x2="${hand.right.x}" y2="${hand.right.y}" stroke-width="${thickness * 2}"/><circle class="figure-reference-fill" cx="${hand.x}" cy="${hand.y}" r="${thickness * 3}"/></g>`;
    const guide =
      !rawOverlay && reference ? referenceVector(a, f, reference) : null;
    if (guide)
      overlay.innerHTML += `<g class="coaching-vector" stroke="#60a5fa" stroke-width="${thickness * 2}" fill="none"><path stroke-dasharray="6 4" d="M${guide.start.x},${guide.start.y}L${guide.end.x},${guide.end.y}"/><circle cx="${guide.end.x}" cy="${guide.end.y}" r="${thickness * 3}"/></g>`;
    const values = anglesAt(f, a.side, a.width, a.height);
    angles.innerHTML = Object.entries(values)
      .map(
        ([joint, value]) =>
          `<span>${joint}<b>${
            value === null ? '—' : `${e(formatNumber(value, 0))}°`
          }</b></span>`,
      )
      .join('');
  }
  function tick() {
    if (disposed) return;
    if (video!.currentTime !== lastTime) {
      lastTime = video!.currentTime;
      draw();
    }
    if (!video!.paused) raf = requestAnimationFrame(tick);
  }
  const start = a.interval?.start ?? 0;
  const end = a.interval?.end ?? a.duration;
  const initialize = () => {
    video.currentTime = start;
    draw();
  };
  const enforceInterval = () => {
    if (a.interval && !video.paused && video.currentTime >= end) {
      video.pause();
      video.currentTime = end;
    }
    draw();
  };
  const play = () => {
    if (a.interval && (video.currentTime < start || video.currentTime >= end))
      video.currentTime = start;
    cancelAnimationFrame(raf);
    tick();
  };
  const update = () => draw();
  const error = () => {
    root.querySelector('#cv-media-error')!.textContent = t(
      'errors.playbackFailed',
    );
  };
  video.addEventListener('play', play);
  video.addEventListener('seeked', update);
  video.addEventListener('loadedmetadata', initialize);
  video.addEventListener('timeupdate', enforceInterval);
  video.addEventListener('error', error);
  root.querySelector<HTMLButtonElement>('#cv-pose')!.onclick = (event) => {
    enabled = !enabled;
    const button = event.currentTarget as HTMLButtonElement;
    button.textContent = `Tracked pose ${enabled ? 'on' : 'off'}`;
    button.setAttribute('aria-pressed', String(enabled));
    draw();
  };
  root.querySelector<HTMLButtonElement>('#cv-raw')!.onclick = (event) => {
    rawOverlay = !rawOverlay;
    const button = event.currentTarget as HTMLButtonElement;
    button.setAttribute('aria-pressed', String(rawOverlay));
    button.textContent = t(
      rawOverlay ? 'vision.filteredOverlay' : 'vision.rawOverlay',
    );
    draw();
  };
  root.querySelector<HTMLButtonElement>('#cv-speed')!.onclick = (event) => {
    video.playbackRate =
      video.playbackRate === 1 ? 0.5 : video.playbackRate === 0.5 ? 0.25 : 1;
    (event.currentTarget as HTMLButtonElement).textContent =
      `Playback speed: ${video.playbackRate}×`;
  };
  root.querySelectorAll<HTMLButtonElement>('[data-cv-time]').forEach(
    (button) =>
      (button.onclick = () => {
        video.pause();
        reference =
          features().ads && button.dataset.coachingCheck
            ? a.lift?.checks.find(
                (c) => c.name === button.dataset.coachingCheck,
              )
            : undefined;
        const note = root.querySelector<HTMLElement>(
          '#coaching-reference-note',
        );
        if (note) note.hidden = !reference;
        video.currentTime = Number(button.dataset.cvTime);
        draw();
        video.scrollIntoView({
          block: 'center',
          behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 'instant'
            : 'smooth',
        });
      }),
  );
  root.querySelector<HTMLButtonElement>('#coaching-reference-off')!.onclick =
    () => {
      reference = undefined;
      root.querySelector<HTMLElement>('#coaching-reference-note')!.hidden =
        true;
      draw();
    };
  draw();
  return () => {
    disposed = true;
    cancelAnimationFrame(raf);
    video.pause();
    video.removeEventListener('play', play);
    video.removeEventListener('seeked', update);
    video.removeEventListener('loadedmetadata', initialize);
    video.removeEventListener('timeupdate', enforceInterval);
    video.removeEventListener('error', error);
  };
}
