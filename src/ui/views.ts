import { features } from '../services/features';
import { availableMovements, getMovement } from '../domain/movements';
import type {
  Analysis,
  LiftRecord,
  Movement,
  Page,
  VideoSource,
} from '../domain/types';
import { t, td } from '../i18n';
import { formatDateTime, formatNumber } from '../i18n';
import type { Theme } from '../services/theme';
import { escapeHtml as e, icon } from './html';
import { movementVisual, movementBarPath } from './movement-visuals';
import { compareWithPrevious } from '../services/comparison';
import {
  demoMetric,
  demoSummary,
  demoVerdict,
  drillName,
  issueField,
  issueName,
  movementName,
  phaseName,
  severityName,
} from './labels';

/**
 * Repeated on every screen so the credit is always one tap away, including
 * from a saved result deep link. Extracted because it was previously pasted
 * into six template literals and had already drifted.
 */
export function footer(): string {
  return `<footer class="app-footer"><span class="footer-credit">${e(t('settings.footer'))} <a class="creator-link" href="https://github.com/FedeLoch" target="_blank" rel="noopener noreferrer"><strong>${e(t('settings.creator'))}</strong></a> · <a class="donate-link" href="https://buymeacoffee.com/fedelochbaum" target="_blank" rel="noopener noreferrer">☕ ${e(t('settings.donate'))}</a></span></footer>`;
}

export function shell(content: string, page: Page, theme: Theme): string {
  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  const switchTo = t('theme.switchTo', { theme: t(`theme.${next}`) });
  const toggle = `<button class="theme-toggle" data-action="theme" title="${e(switchTo)}" aria-label="${e(switchTo)}">${icon(next === 'light' ? 'sun' : 'moon')}</button>`;
  // `class="app-nav"` is the layout hook the stylesheet matches on, and the
  // `aria-label` beside it is translated. Keeping those two separate is
  // deliberate: selecting on the label meant `nav[aria-label='Main
  // navigation']` stopped matching the moment the visitor switched language,
  // which dropped the bar out of its fixed position and into normal flow.
  const nav = (['home', 'capture', 'history', 'settings'] as const)
    .map(
      (p) =>
        `<a href="#${p}" ${page === p || (page === 'result' && p === 'capture') ? 'aria-current="page"' : ''}>${icon(p === 'capture' ? 'plus' : p === 'settings' ? 'gear' : p)}<span>${e(t(`app.nav.${p}`))}</span></a>`,
    )
    .join('');
  return `<a href="#main" class="skip-link">${e(t('app.skipToContent'))}</a><header class="app-header"><a class="brand" href="#home" aria-label="${e(t('app.homeAria'))}"><img class="brand-logo" src="/logo-snatchy.png" alt="" aria-hidden="true"><span>${e(t('app.brand'))}<span>.</span></span></a><div class="edition">${e(t('app.techniqueLab'))} <span>${e(t('app.volume'))}</span></div><div class="header-tools"><span class="header-status"><i></i> ${e(t('app.localFirst'))}</span>${toggle}</div></header><main id="main" tabindex="-1">${content}</main><nav class="app-nav" aria-label="${e(t('app.mainNavigation'))}">${nav}${features().ads ? `<div class="sponsor-slot"><span>${e(t('coaching.adPlaceholder'))}</span><button data-action="ad-settings">${e(t('coaching.manage'))}</button></div>` : ''}</nav><div class="sr-only" id="announcer" role="status" aria-live="polite"></div>`;
}

function rows(records: LiftRecord[], allRecords: LiftRecord[] = []): string {
  return records.length
    ? `<div class="lift-list">${records
        .map((r) => {
          const comparison = compareWithPrevious(allRecords, r);
          const delta =
            comparison.overallDeltaPct !== null && r.source === 'video'
              ? `<span class="improvement-delta ${comparison.overallDeltaPct > 0 ? 'up' : 'down'}" title="${comparison.overallDeltaPct > 0 ? '+' : ''}${comparison.overallDeltaPct.toFixed(1)}%">${icon(comparison.overallDeltaPct > 0 ? 'arrowUp' : 'arrowDown')}${comparison.overallDeltaPct > 0 ? '+' : ''}${comparison.overallDeltaPct.toFixed(1)}%</span>`
              : '';
          return `<div class="history-entry"><a class="lift-row" href="#result/${r.id}" aria-label="${e(r.source === 'video' ? t('liftRow.openNotAnalyzed', { movement: movementName(r.analysis.movementId) }) : t('liftRow.openScored', { movement: movementName(r.analysis.movementId), score: formatNumber(r.analysis.score) }))}"><span class="lift-icon">${icon('arrow')}</span><span class="lift-description"><strong>${e(movementName(r.analysis.movementId, getMovement(r.analysis.movementId)?.name ?? ''))}</strong><small>${e(formatDateTime(r.createdAt))}<span class="row-dot">·</span>${e(t(`liftRow.${r.source === 'video' ? 'importedClip' : 'demoLift'}`))}</small></span>${r.source === 'video' ? `<span class="upload-status">${e(t('liftRow.notAnalyzed'))}</span>` : `<span class="lift-score">${r.analysis.score}<small>/100</small>${delta}</span>`}${icon('arrow')}</a><button class="history-remove" data-action="remove-history" data-kind="demo" data-id="${r.id}" aria-label="${e(r.source === 'demo' ? t('liftRow.removeDemoLift') : t('liftRow.removeVideoAnalysis'))}">${icon('close')}</button></div>`;
        })
        .join('')}</div>`
    : `<div class="empty-state"><div><h3>${e(t('home.emptyTitle'))}</h3><p>${e(t('home.emptyBody'))}</p></div><a href="#capture" class="text-link">${e(t('home.startALift'))} ${icon('arrow')}</a></div>`;
}

export function home(
  records: LiftRecord[],
  warning: string,
  realHistory = '',
): string {
  return `<section class="home-hero-centered"><div class="eyebrow"><i></i> ${e(t('home.eyebrow'))}</div><h1>${e(t('home.titleLead'))}<br>${e(t('home.titleAccent'))}</h1><p class="lead">${e(t('home.leadFirst'))}<br>${e(t('home.leadSecond'))}</p><a class="primary" href="#capture">${e(t('home.cta'))} ${icon('arrow')}</a><span class="under-cta">${e(t('home.underCta'))}</span></section><section class="recent-section"><div class="section-title"><h2>${e(t('home.recentLifts'))}</h2><a href="#history" class="text-link">${e(t('home.viewHistory'))} ${icon('arrow')}</a></div>${warning ? `<p class="notice" role="status">${e(td(warning))}</p>` : ''}${realHistory}${records.length || !realHistory ? rows(records.slice(0, 3), records) : ''}</section><div class="principle-strip"><span>01 <b>${e(t('home.principles.record'))}</b></span><span>02 <b>${e(t('home.principles.understand'))}</b></span><span>03 <b>${e(t('home.principles.improve'))}</b></span></div>${footer()}`;
}

export function history(
  records: LiftRecord[],
  warning: string,
  realHistory = '',
): string {
  return `<div class="page-title"><div class="eyebrow">${e(t('history.eyebrow'))}</div><h1>${e(t('history.title'))}<span class="accent">.</span></h1><p>${e(t('history.lead'))}</p></div>${warning ? `<p class="notice" role="status">${e(td(warning))}</p>` : ''}${realHistory}${records.length || !realHistory ? rows(records, records) : ''}<p class="footnote">${e(t('history.footnote'))}</p><a class="primary compact" href="#capture">${e(t('history.analyzeAnother'))} ${icon('plus')}</a>${footer()}`;
}

export function capture(
  movement: Movement,
  source: VideoSource | null,
  exerciseChoice = 'auto',
): string {
  return `<div class="narrow"><a href="#home" class="back">${icon('back')} ${e(t('capture.back'))}</a><div class="eyebrow">${e(t('capture.eyebrow'))}</div><h1>${source ? e(t('capture.titleReady')) : `${e(t('capture.titleIdle'))}<br>${e(t('capture.titleIdleAccent'))}`}</h1><div class="movement-field"><label for="movement">${e(t('capture.movementLabel'))}</label><select id="movement" ${availableMovements().length === 1 && !source ? 'aria-describedby="movement-hint"' : ''}><option value="auto" ${exerciseChoice === 'auto' ? 'selected' : ''}>${e(t('capture.detectAuto'))}</option>${availableMovements()
    .map(
      (m) =>
        `<option value="${m.id}" ${m.id === exerciseChoice ? 'selected' : ''}>${e(movementName(m.id, m.name))}</option>`,
    )
    .join(
      '',
    )}</select></div>${!source ? `<p id="movement-hint" class="field-hint">${e(t('capture.bodyPoseHint'))}</p>` : ''}${source ? `<div class="review-video"><video src="${e(source.url)}" controls playsinline preload="metadata" aria-label="${e(t('capture.reviewAria'))}"></video><div class="file-meta"><span>${e(source.name)}</span><span>${formatNumber(source.duration, 1)} s</span></div></div><div class="notice"><strong>${e(t('capture.readyForAnalysis'))}</strong><p>${e(t('capture.readyForAnalysisBody'))}</p></div><button class="primary" data-action="analyze-video">${e(t('capture.analyzeThisVideo'))} ${icon('arrow')}</button><button class="secondary" data-action="review-speed">${e(t('capture.playbackSpeed', { speed: 1 }))}</button><button class="secondary" data-action="replace">${e(t('capture.chooseAnotherVideo'))} ${icon('upload')}</button>` : `<div class="framing">${movementVisual(movement.id, 0.3, false)}<span class="frame-corner tl"></span><span class="frame-corner br"></span><span class="framing-caption">${e(t('capture.sideView'))}</span></div><div class="camera-guide"><span>${e(t('capture.getAngleRight'))}</span><p>${e(movement.id === 'snatch' ? t('movementMeta.snatchGuide') : t('movementMeta.experimentalGuide'))}</p></div><button class="primary" data-action="record">${e(t('capture.recordVideo'))} ${icon('camera')}</button><button class="secondary" data-action="import">${e(t('capture.importFromGallery'))} ${icon('upload')}</button>`}<p id="capture-error" class="error" role="alert"></p><p id="capture-status" role="status" class="footnote"></p><div class="privacy-note">${icon('shield')}<span>${e(t('capture.privacyNoteFirst'))}<br>${e(t('capture.privacyNoteSecond'))}</span></div>${footer()}<input id="import" type="file" accept="video/*" hidden><input id="record" type="file" accept="video/*" capture="environment" hidden></div>`;
}

export function issueCards(
  a: Analysis,
  movement: Movement,
  selected: string | null,
): string {
  return a.issues
    .map(
      (i, n) =>
        `<article class="issue ${selected === i.id ? 'expanded' : ''}"><h3><button class="issue-toggle" data-action="issue" data-id="${e(i.id)}" aria-expanded="${selected === i.id}" aria-controls="issue-${e(i.id)}"><span class="issue-number">0${n + 1}</span><span class="issue-name"><strong>${e(issueName(i.id, i.name))}</strong><small>${e(phaseName(a.phases.find((p) => p.id === i.phaseId)?.name ?? ''))}<span class="severity ${i.severity}">${e(severityName(i.severity))}</span></small></span><span class="expand-icon" aria-hidden="true">${selected === i.id ? '−' : '+'}</span></button></h3><div id="issue-${e(i.id)}" class="issue-body" ${selected === i.id ? '' : 'hidden'}><div class="issue-time">${e(t('result.demoFrame', { time: formatNumber(i.time, 2) }))}</div><dl><dt>${e(t('result.whatHappened'))}</dt><dd>${e(issueField(i.id, 'what', i.what))}</dd><dt>${e(t('result.whyItMatters'))}</dt><dd>${e(issueField(i.id, 'why', i.why))}</dd><dt>${e(t('result.howToImprove'))}</dt><dd>${e(issueField(i.id, 'how', i.how))}</dd></dl><div class="drill-links">${i.drillIds
          .map((id) => {
            const d = movement.drills.find((d) => d.id === id);
            return d
              ? `<button data-action="drill" data-id="${e(id)}">${e(drillName(d.id, d.name))} ${icon('arrow')}</button>`
              : '';
          })
          .join(
            '',
          )}</div><button class="jump-link" data-action="jump" data-id="${e(i.id)}">${e(t('result.viewThisMoment'))} ${icon('arrow')}</button></div></article>`,
    )
    .join('');
}

export function result(
  record: LiftRecord,
  movement: Movement,
  source: VideoSource | null,
  selected: string | null,
  warning: string,
): string {
  if (record.source === 'video') return unanalyzedUpload();
  const a = record.analysis;
  return `<a href="#history" class="back">${icon('back')} ${e(t('result.back'))}</a><div class="eyebrow">${e(movementName(movement.id, movement.name).toUpperCase())} <span class="tag">${e(t('result.demoTag'))}</span></div><div class="result-heading demo-result-heading"><div><h1>${e(t(demoVerdict(a.verdict)))}<span class="accent">.</span></h1><p>${e(demoSummary(a.summary))}</p></div><div class="score" aria-label="${e(t('result.scoreAria', { score: formatNumber(a.score) }))}">${a.score}<small>/ 100</small></div></div>${warning ? `<p class="notice" role="status">${e(td(warning))}</p>` : ''}<div class="analysis-layout"><section class="video-column" aria-label="${e(t('result.playbackAria'))}"><div class="video-stage ${source ? 'has-video' : ''}" tabindex="0" aria-label="${e(t('result.viewerAria'))}">${source ? `<video id="lift-video" src="${e(source.url)}" playsinline preload="auto" aria-label="${e(t('result.importedVideo'))}"></video>` : ''}<div id="pose-frame" ${source ? 'class="pose-inset"' : ''}>${movementVisual(movement.id, 0, true)}</div><div class="stage-top"><span class="tag">${e(t(`result.${source ? 'yourVideo' : 'illustratedDemo'}`))}</span><button class="chip" data-action="overlay" aria-pressed="true" aria-label="${e(t('result.poseOverlayAria'))}">${icon('eye')}<span>${e(t('result.poseOn'))}</span></button></div><div class="stage-bottom"><span id="phase-label">${e(phaseName(a.phases[0].name))}</span><span id="time-label">${formatNumber(0, 2)} s</span></div></div><p id="media-error" class="error" role="alert"></p><div class="player"><button data-action="play" aria-label="${e(t('result.play'))}">${icon('play')}</button><input id="scrubber" type="range" min="0" max="${source?.duration ?? a.duration}" step="0.01" value="0" aria-label="${e(t('result.scrubAria'))}"><button data-action="speed" aria-label="${e(t('result.speedAria', { speed: formatNumber(0.5) }))}">0.5×</button><button data-action="loop" aria-pressed="false" aria-label="${e(t('result.loopAria'))}">${icon('loop')}</button></div><p class="viewer-caption">${e(t(`result.${source ? 'captionWithVideo' : 'captionDemo'}`))}</p><div class="section-title"><h2>${e(t('phasesPanel.title'))}</h2><span class="micro">${e(t('result.phasesCount', { count: a.phases.length }))}</span></div><div class="timeline">${a.phases.map((p) => `<button data-action="phase" data-id="${p.id}" aria-label="${e(a.issues.some((i) => i.phaseId === p.id) ? t('result.phaseScoreWithObservation', { phase: phaseName(p.name), score: formatNumber(p.score) }) : t('result.phaseScoreAria', { phase: phaseName(p.name), score: formatNumber(p.score) }))}"><span class="phase-line ${a.issues.some((i) => i.phaseId === p.id) ? 'warning' : ''}"></span><b>${p.score}</b><span>${e(phaseName(p.name))}</span></button>`).join('')}</div><div class="selected-reading" id="reading" aria-live="polite"></div><p class="keyboard-hint">${e(t('result.keyboardPlayPause'))}<span>${e(t('result.keyboardStep'))}</span></p></section><section class="feedback-column" aria-label="${e(t('result.feedbackColumn'))}"><section class="bar-section"><div class="section-title"><h2>${e(t('barPanel.title'))}</h2><span class="micro">${e(t('result.barSideView'))}</span></div><div class="bar-content">${movementBarPath(movement.id)}<dl class="bar-metrics">${a.metrics.map((m) => `<div><dt>${e(demoMetric(m.label))}</dt><dd>${formatNumber(m.value)}<small>${e(m.unit)}</small></dd></div>`).join('')}</dl></div><p class="footnote">${e(t('result.illustrativeFootnote'))}</p></section><div class="section-title"><h2>${e(t('checksPanel.title'))}</h2><span class="micro">${e(t('result.observationsCount', { count: String(a.issues.length).padStart(2, '0') }))}</span></div><div id="issues">${issueCards(a, movement, selected)}</div></section></div><div class="next-lift"><div><div class="eyebrow">${e(t('result.nextEyebrow'))}</div><h2>${e(t('result.nextTitle'))}</h2></div><a class="primary" href="#capture">${e(t('result.analyzeAnotherLift'))} ${icon('arrow')}</a></div>${footer()}`;
}

export function unanalyzedUpload(): string {
  return `<div class="narrow"><a href="#history" class="back">${icon('back')} ${e(t('result.back'))}</a><div class="eyebrow">${e(t('unanalyzed.eyebrow'))}</div><h1>${e(t('unanalyzed.title'))}<span class="accent">.</span></h1><p class="notice">${e(t('unanalyzed.notice'))}</p><p>${e(t('unanalyzed.detail'))}</p><a href="#capture" class="primary">${e(t('unanalyzed.importYourVideo'))} ${icon('upload')}</a>${footer()}</div>`;
}
