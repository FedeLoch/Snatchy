import { availableMovements, getMovement } from '../domain/movements';
import type {
  Analysis,
  LiftRecord,
  Movement,
  Page,
  VideoSource,
} from '../domain/types';
import { processingSteps } from '../services/analysis-provider';
import { escapeHtml as e, icon } from './html';
import { movementVisual, movementBarPath } from './movement-visuals';
export function shell(content: string, page: Page): string {
  return `<a href="#main" class="skip-link">Skip to content</a><header class="app-header"><a class="brand" href="#home" aria-label="Snatchy home"><span class="brand-mark" aria-hidden="true">Ⅱ</span>snatchy<span>.</span></a><div class="edition">THE TECHNIQUE LAB <span>VOL. 01</span></div><span class="header-status"><i></i> LOCAL FIRST</span></header><main id="main" tabindex="-1">${content}</main><nav aria-label="Main navigation">${(['home', 'capture', 'history'] as const).map((p) => `<a href="#${p}" ${page === p || (page === 'result' && p === 'capture') ? 'aria-current="page"' : ''}>${icon(p === 'capture' ? 'plus' : p)}<span>${p === 'capture' ? 'Analyze' : p === 'home' ? 'Home' : 'History'}</span></a>`).join('')}</nav><div class="sr-only" id="announcer" role="status" aria-live="polite"></div>`;
}
function rows(records: LiftRecord[]): string {
  return records.length
    ? `<div class="lift-list">${records.map((r) => `<div class="history-entry"><a class="lift-row" href="#result/${r.id}" aria-label="Open ${e(getMovement(r.analysis.movementId)?.name)} ${r.source === 'video' ? 'upload, not analyzed' : 'result, score ' + r.analysis.score}"><span class="lift-icon">${icon('arrow')}</span><span class="lift-description"><strong>${e(getMovement(r.analysis.movementId)?.name)}</strong><small>${e(new Date(r.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }))}<span class="row-dot">·</span>${r.source === 'video' ? 'Imported clip' : 'Demo lift'}</small></span>${r.source === 'video' ? '<span class="upload-status">Not analyzed</span>' : `<span class="lift-score">${r.analysis.score}<small>/100</small></span>`}${icon('arrow')}</a><button class="history-remove" data-action="remove-history" data-kind="demo" data-id="${r.id}" aria-label="Remove ${r.source === 'demo' ? 'demo lift' : 'video analysis'} from history">Remove</button></div>`).join('')}</div>`
    : `<div class="empty-state"><span class="empty-icon">${icon('history')}</span><div><h3>Your next lift starts here.</h3><p>Analyze a snatch to save your first result.</p></div><a href="#capture" class="text-link">Start a lift ${icon('arrow')}</a></div>`;
}
export function home(
  records: LiftRecord[],
  warning: string,
  realHistory = '',
): string {
  return `<div class="home-grid"><section class="home-intro"><div class="eyebrow"><i></i> BUILT FOR THE MOMENTS BETWEEN SETS</div><h1>Every lift.<br>A little <em>better.</em></h1><p class="lead">See the details. Understand the movement.<br>Make your next rep count.</p><a class="primary" href="#capture">Analyze a lift ${icon('arrow')}</a><span class="under-cta">ONE LIFT. A CLEARER PERSPECTIVE.</span></section><button class="demo-hero" data-action="demo" aria-label="Explore the Snatch demo"><span class="hero-head"><span><strong>THE SNATCH</strong><small>POWER. PRECISION. PERSPECTIVE.</small></span><span class="tag">INTERACTIVE DEMO</span></span>${movementVisual('snatch', 1.34, true, 'elbow')}<span class="hero-foot"><span><i></i> SEE WHAT YOU’VE BEEN MISSING</span>${icon('arrow')}</span></button></div><section class="recent-section"><div class="section-title"><h2>Recent lifts</h2><a href="#history" class="text-link">View history ${icon('arrow')}</a></div>${warning ? `<p class="notice" role="status">${e(warning)}</p>` : ''}${realHistory}${records.length || !realHistory ? rows(records.slice(0, 3)) : ''}</section><div class="principle-strip"><span>01 <b>Record</b></span><span>02 <b>Understand</b></span><span>03 <b>Improve</b></span></div>`;
}
export function history(
  records: LiftRecord[],
  warning: string,
  realHistory = '',
): string {
  return `<div class="page-title"><div class="eyebrow">A RECORD OF YOUR WORK</div><h1>Lift history<span class="accent">.</span></h1><p>Measured video summaries and explicitly labeled demo results are saved on this device.</p></div>${warning ? `<p class="notice" role="status">${e(warning)}</p>` : ''}${realHistory}${records.length || !realHistory ? rows(records) : ''}<p class="footnote">Video files are kept only for the current session. Older prototype uploads remain unscored; new measured analyses retain their summaries.</p><a class="primary compact" href="#capture">Analyze a lift ${icon('plus')}</a>`;
}
export function capture(
  movement: Movement,
  source: VideoSource | null,
): string {
  return `<div class="narrow"><a href="#home" class="back">${icon('back')} Back</a><div class="eyebrow">01 / CAPTURE</div><h1>${source ? 'Ready when<br>you are.' : 'One lift.<br>New perspective.'}</h1><div class="movement-field"><label for="movement">Movement</label><select id="movement" ${availableMovements().length === 1 ? 'aria-describedby="movement-hint"' : ''}>${availableMovements()
    .map(
      (m) =>
        `<option value="${m.id}" ${m.id === movement.id ? 'selected' : ''}>${e(m.name)}</option>`,
    )
    .join(
      '',
    )}</select></div><p id="movement-hint" class="field-hint">Real body-pose analysis runs on your device. Use a side-view clip of one athlete, 0.8–30 seconds.</p>${source ? `<div class="review-video"><video src="${e(source.url)}" controls playsinline preload="metadata" aria-label="Review your lift video"></video><div class="file-meta"><span>${e(source.name)}</span><span>${source.duration.toFixed(1)} s</span></div></div><div class="notice"><strong>Ready for real pose analysis.</strong><p>Detect body joints and measure motion from this clip on your device. Results depend on visibility. No barbell tracking or validated technique score.</p></div><button class="primary" data-action="analyze-video">Analyze this video ${icon('arrow')}</button><button class="secondary" data-action="review-speed">Playback speed: 1×</button><button class="secondary" data-action="replace">Choose another video ${icon('upload')}</button>` : `<div class="framing">${movementVisual(movement.id, 0.3, false)}<span class="frame-corner tl"></span><span class="frame-corner br"></span><span class="framing-caption">SIDE VIEW / FULL BODY / HIP HEIGHT</span></div><div class="camera-guide"><span>GET THE ANGLE RIGHT</span><p>${e(movement.cameraGuide)}</p></div><button class="primary" data-action="record">Record a video ${icon('camera')}</button><button class="secondary" data-action="import">Import from gallery ${icon('upload')}</button><div class="or-divider"><span>OR EXPLORE FIRST</span></div><button class="demo-link" data-action="demo">Try the demo lift ${icon('arrow')}</button>`}<p id="capture-error" class="error" role="alert"></p><p id="capture-status" role="status" class="footnote"></p><div class="privacy-note">${icon('shield')}<span>Private by design. Your video stays on this device.<br>One lift per clip · up to 250 MB</span></div><input id="import" type="file" accept="video/*" hidden><input id="record" type="file" accept="video/*" capture="environment" hidden></div>`;
}
export function processing(movement: Movement): string {
  return `<div class="narrow"><div class="eyebrow">02 / OBSERVE</div><h1>Analyzing<br>your ${e(movement.name.toLowerCase())}<span class="accent">.</span></h1><p>Finding the moments that matter.</p><div class="processing-visual">${movementVisual(movement.id, 1.34, true)}<span class="tag">SIMULATED ANALYSIS</span><div class="scan"></div></div><div class="steps" role="status" aria-live="polite">${processingSteps.map((s, i) => `<div data-step="${i}"><span>0${i + 1}</span><span>${s}</span><b aria-hidden="true">·</b></div>`).join('')}</div><button class="secondary" data-action="cancel">Cancel analysis ${icon('close')}</button></div>`;
}
export function issueCards(
  a: Analysis,
  movement: Movement,
  selected: string | null,
): string {
  return a.issues
    .map(
      (i, n) =>
        `<article class="issue ${selected === i.id ? 'expanded' : ''}"><h3><button class="issue-toggle" data-action="issue" data-id="${e(i.id)}" aria-expanded="${selected === i.id}" aria-controls="issue-${e(i.id)}"><span class="issue-number">0${n + 1}</span><span class="issue-name"><strong>${e(i.name)}</strong><small>${e(a.phases.find((p) => p.id === i.phaseId)?.name)}<span class="severity ${i.severity}">${i.severity}</span></small></span><span class="expand-icon" aria-hidden="true">${selected === i.id ? '−' : '+'}</span></button></h3><div id="issue-${e(i.id)}" class="issue-body" ${selected === i.id ? '' : 'hidden'}><div class="issue-time">DEMO FRAME / ${i.time.toFixed(2)} S</div><dl><dt>What happened</dt><dd>${e(i.what)}</dd><dt>Why it matters</dt><dd>${e(i.why)}</dd><dt>How to improve</dt><dd>${e(i.how)}</dd></dl><div class="drill-links">${i.drillIds
          .map((id) => {
            const d = movement.drills.find((d) => d.id === id);
            return d
              ? `<button data-action="drill" data-id="${e(id)}">${e(d.name)} ${icon('arrow')}</button>`
              : '';
          })
          .join(
            '',
          )}</div><button class="jump-link" data-action="jump" data-id="${e(i.id)}">View this moment ${icon('arrow')}</button></div></article>`,
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
  return `<div class="result-heading"><div><a href="#history" class="back">${icon('back')} Your lifts</a><div class="eyebrow">${e(movement.name.toUpperCase())} <span class="tag">DEMO ANALYSIS</span></div><h1>${e(a.verdict)}<span class="accent">.</span></h1><p>${e(a.summary)}</p></div><div class="score" aria-label="Score ${a.score} out of 100">${a.score}<small>/ 100</small></div></div>${warning ? `<p class="notice" role="status">${e(warning)}</p>` : ''}<div class="analysis-layout"><section class="video-column" aria-label="Lift playback"><div class="video-stage ${source ? 'has-video' : ''}" tabindex="0" aria-label="Lift viewer. Space to play or pause; arrow keys to step.">${source ? `<video id="lift-video" src="${e(source.url)}" playsinline preload="auto" aria-label="Imported lift video"></video>` : ''}<div id="pose-frame" ${source ? 'class="pose-inset"' : ''}>${movementVisual(movement.id, 0, true)}</div><div class="stage-top"><span class="tag">${source ? 'YOUR VIDEO' : 'ILLUSTRATED DEMO'}</span><button class="chip" data-action="overlay" aria-pressed="true" aria-label="Show illustrative pose overlay">${icon('eye')}<span>Pose on</span></button></div><div class="stage-bottom"><span id="phase-label">${e(a.phases[0].name)}</span><span id="time-label">0.00 s</span></div></div><p id="media-error" class="error" role="alert"></p><div class="player"><button data-action="play" aria-label="Play lift">${icon('play')}</button><input id="scrubber" type="range" min="0" max="${source?.duration ?? a.duration}" step="0.01" value="0" aria-label="Scrub lift"><button data-action="speed" aria-label="Playback speed, 0.5 times">0.5×</button><button data-action="loop" aria-pressed="false" aria-label="Loop selected issue">${icon('loop')}</button></div><p class="viewer-caption">${source ? 'Pose inset and timings are illustrative; they are not tracked from your video.' : 'Simplified side-view animation. Play the full lift or select an observation.'}</p><div class="section-title"><h2>Movement phases</h2><span class="micro">${a.phases.length} PHASES</span></div><div class="timeline">${a.phases.map((p) => `<button data-action="phase" data-id="${p.id}" aria-label="${e(p.name)}, score ${p.score}${a.issues.some((i) => i.phaseId === p.id) ? ', observation detected' : ''}"><span class="phase-line ${a.issues.some((i) => i.phaseId === p.id) ? 'warning' : ''}"></span><b>${p.score}</b><span>${e(p.name)}</span></button>`).join('')}</div><div class="selected-reading" id="reading" aria-live="polite"></div><p class="keyboard-hint">SPACE play / pause <span>← → step through</span></p></section><section class="feedback-column" aria-label="Technique feedback"><div class="section-title"><h2>The details that matter</h2><span class="micro">${String(a.issues.length).padStart(2, '0')} OBSERVATIONS</span></div><div id="issues">${issueCards(a, movement, selected)}</div><section class="bar-section"><div class="section-title"><h2>Follow the bar</h2><span class="micro">SIDE VIEW</span></div><div class="bar-content">${movementBarPath(movement.id)}<dl class="bar-metrics">${a.metrics.map((m) => `<div><dt>${e(m.label)}</dt><dd>${m.value}<small> ${e(m.unit)}</small></dd></div>`).join('')}</dl></div><p class="footnote">Illustrative trajectory and demo values.</p></section></section></div><div class="next-lift"><div><div class="eyebrow">UNDERSTAND. ADJUST. REPEAT.</div><h2>Take it into your next set.</h2></div><a class="primary" href="#capture">Analyze another lift ${icon('arrow')}</a></div>`;
}

export function unanalyzedUpload(): string {
  return `<div class="narrow"><a href="#history" class="back">${icon('back')} Your lifts</a><div class="eyebrow">PREVIOUS UPLOAD</div><h1>Not analyzed<span class="accent">.</span></h1><p class="notice">This earlier upload was shown a fixed demo score. That score was not calculated from your video and is not a valid assessment of your technique.</p><p>The original clip was not saved. Import it again to review your footage. Re-import the clip to run the new on-device pose analysis.</p><a href="#capture" class="primary">Import your video ${icon('upload')}</a></div>`;
}
