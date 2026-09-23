import {
  movementPhases,
  measuredSummary,
  techniqueScore,
  techniqueFeedback,
  barPanel,
} from './lift-analysis';
import { estimatePhases } from '../domain/lift-phases';
import { visionRadar } from './radar';
import {
  anglesAt,
  nearestSample,
  visible,
  SIDES,
  type VisionRecord,
  type VisionAnalysis,
} from '../domain/vision';
import type { VideoSource } from '../domain/types';
import { escapeHtml as e, icon } from './html';
const links = [
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
  return records.length
    ? `<div class="lift-list">${records.map((r) => `<div class="history-entry"><a class="lift-row" href="#vision/${r.id}" aria-label="Open measured pose analysis"><span class="lift-icon">${icon('eye')}</span><span class="lift-description"><strong>SNATCH · YOUR VIDEO</strong><small>${e(new Date(r.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }))}</small></span><span class="upload-status">${r.analysis.repetitions?.length ? r.analysis.repetitions.length + ' reps detected' : r.analysis.status === 'tracked' ? 'Pose tracked' : 'Limited tracking'}</span>${icon('arrow')}</a><button class="history-remove" data-action="remove-history" data-kind="vision" data-id="${r.id}" aria-label="Remove video analysis from history">Remove</button></div>`).join('')}</div>`
    : '';
}
export function visionProcessing(): string {
  return `<div class="narrow"><div class="eyebrow">ON-DEVICE COMPUTER VISION</div><h1>Reading<br>your movement<span class="accent">.</span></h1><p>Your video stays on this device. The model is detecting body landmarks from the actual frames.</p><div class="vision-progress"><progress max="1" value="0" aria-label="Video analysis progress"></progress><p id="vision-progress-label" role="status">Loading the local pose model</p></div><button class="secondary" data-action="cancel">Cancel analysis ${icon('close')}</button><p class="footnote">First runs may take longer. Keep this tab open.</p></div>`;
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
  return `<svg viewBox="0 0 320 120" role="img" aria-label="Measured elbow angle over time; gaps indicate low confidence"><path d="M0 10h300M0 55h300M0 100h300" stroke="#46513b" stroke-width=".5"/><path d="${path}" fill="none" stroke="#d4f778" stroke-width="2"/><text x="0" y="117" fill="#a8b09d" font-size="9">${start.toFixed(1)} s</text><text x="270" y="117" fill="#a8b09d" font-size="9">${a.duration.toFixed(1)} s</text></svg>`;
}
export function visionResult(
  record: VisionRecord,
  source: VideoSource | null,
  warning: string,
): string {
  const a = record.analysis;
  return `<div class="result-heading"><div><a class="back" href="#history">${icon('back')} Your lifts</a><div class="eyebrow">SNATCH <span class="tag">MEASURED POSE</span></div><h1>${a.status === 'tracked' ? 'Your movement' : 'Limited tracking'}<span class="accent">.</span></h1><p>${e(measuredSummary(a))}</p></div>${techniqueScore(a)}</div>${warning ? `<p class="notice">${e(warning)}</p>` : ''}<div class="analysis-layout"><section aria-label="Your analyzed video">${source ? `<div class="cv-stage"><video id="cv-video" src="${e(source.url)}" controls playsinline preload="metadata" aria-label="Your analyzed lift video"></video><svg id="cv-overlay" viewBox="0 0 ${a.width} ${a.height}" aria-hidden="true"></svg></div><div class="cv-controls"><button id="cv-pose" class="secondary" aria-pressed="true">Tracked pose on</button><button id="cv-speed" class="secondary">Playback speed: 1×</button></div><p id="cv-frame-status" class="footnote">Move through the video to inspect measured joints.</p><div id="cv-angles" class="live-angles"></div><p id="cv-media-error" class="error" role="alert"></p>` : '<div class="notice"><strong>Saved measurement summary</strong><p>The video and frame landmarks were kept only in the original session. Import the clip again to view a tracked replay.</p><a href="#capture" class="text-link">Import the clip again ↗</a></div>'}${a.interval ? `<p class="notice">Auto-selected exercise · ${a.interval.start.toFixed(1)}–${a.interval.end.toFixed(1)} s. Playback and measurements focus on this candidate rep. The original recording is unchanged.</p>` : `<p class="footnote">No low-to-overhead repetition was isolated. Showing the available recording evidence.</p>`}${movementPhases(a, !!source)}<div class="section-title"><h2>Tracking quality</h2><span class="micro">${a.sampleRate} SAMPLES / SECOND</span></div><div class="quality-summary"><b>${Math.round(a.coverage * 100)}<small>%</small></b><div><strong>Usable frames</strong><p>${a.usableFrames} of ${a.sampledFrames} samples · ${a.side} side</p></div></div><p class="footnote">This percentage measures landmark availability, not technique quality.</p>${a.status === 'insufficient' ? '<div class="notice"><strong>Not enough reliable evidence</strong><p>Some joint measurements are unavailable. Independently supported phases and checks can still be shown. Film one athlete from the side, keep wrists, hips, knees and ankles visible, and use a well-lit, steady shot.</p></div>' : ''}${a.frames.length && a.status === 'tracked' ? `<div class="section-title"><h2>Elbow motion</h2><span class="micro">2D PROJECTED ANGLE</span></div>${angleChart(a)}` : ''}</section><section class="feedback-column">${techniqueFeedback(a, !!source)}${barPanel(a, !!source)}<div class="section-title"><h2>Measured joint ranges</h2></div><div class="measured-ranges">${(['elbow', 'hip', 'knee'] as const).map((key) => `<div><span>${key}</span><b>${a.ranges[key] ? `${a.ranges[key]!.min}–${a.ranges[key]!.max}°` : 'Unavailable'}</b></div>`).join('')}</div><p class="footnote">5th–95th percentile of high-visibility frames. Image-plane angles are perspective-dependent, not calibrated 3D biomechanics.</p><div class="section-title"><h2>Moments to inspect</h2></div>${a.events.length ? a.events.map((event) => `<article class="measured-event"><button data-cv-time="${event.time}" ${source ? '' : 'disabled'}><span>${e(event.title)}</span><b>${event.time.toFixed(2)} s ${icon('arrow')}</b></button><p>${e(event.detail)}</p><span class="event-kind">${event.kind === 'hypothesis' ? 'EXPERIMENTAL TECHNIQUE HYPOTHESIS' : 'MEASURED MOTION EVENT'}</span></article>`).join('') : `<p class="notice">${a.status === 'tracked' ? 'No distinct motion events met the evidence thresholds. The clip may be static or may not contain a complete lift.' : 'Motion events are withheld because tracking quality is too low.'}</p>`}${visionRadar(a)}<p class="footnote">${e(a.engine)} · ${(a.duration - (a.interval?.start ?? 0)).toFixed(1)} s sampled · all processing on this device</p></section></div><a class="primary compact" href="#capture">Analyze another video ${icon('arrow')}</a>`;
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
      status.textContent =
        f && f.people > 1
          ? 'Multiple people detected: this frame is excluded.'
          : 'Tracking unavailable in this frame.';
      return;
    }
    const good = f.landmarks.filter(visible).length;
    status.textContent = `${f.time.toFixed(2)} s · ${good} visible landmarks · ${a.side} side measured`;
    const thickness = Math.max(a.width, a.height) / 350;
    const segments = links
      .filter(
        ([start, end]) =>
          visible(f.landmarks[start]) && visible(f.landmarks[end]),
      )
      .map(([start, end]) => {
        const p = f.landmarks[start],
          q = f.landmarks[end];
        return `<line x1="${p.x * a.width}" y1="${p.y * a.height}" x2="${q.x * a.width}" y2="${q.y * a.height}"/>`;
      })
      .join('');
    const joints = SIDES[a.side]
      .filter((i) => visible(f.landmarks[i]))
      .map((i) => {
        const p = f.landmarks[i];
        return `<circle cx="${p.x * a.width}" cy="${p.y * a.height}" r="${thickness * 2}"/>`;
      })
      .join('');
    overlay.innerHTML = enabled
      ? `<g stroke="#d4f778" stroke-width="${thickness}" fill="#d4f778">${segments}${joints}</g>`
      : '';
    const automatic = a.automaticBar;
    const point = automatic?.points.find(
      (p) => Math.abs(p.time - video.currentTime) <= 0.5 / a.sampleRate,
    );
    if (point && automatic)
      overlay.innerHTML += `<circle cx="${(point.x / automatic.width) * a.width}" cy="${(point.y / automatic.height) * a.height}" r="${(automatic.radius / automatic.width) * a.width}" fill="none" stroke="#73c9ff" stroke-width="${thickness * 2}"/>`;
    const values = anglesAt(f, a.side, a.width, a.height);
    angles.innerHTML = Object.entries(values)
      .map(
        ([joint, value]) =>
          `<span>${joint}<b>${value === null ? '—' : Math.round(value) + '°'}</b></span>`,
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
    root.querySelector('#cv-media-error')!.textContent =
      'This video could not be played. Import it again or try an MP4.';
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
        const phase = (a.lift ?? estimatePhases(a)).phases.find(
          (p) => p.name === button.dataset.cvPhase,
        );
        const reading = root.querySelector('#cv-phase-reading');
        if (phase && reading)
          reading.textContent = `${phase.name} · ${phase.start?.toFixed(2)} s — ${phase.evidence}`;
        video.currentTime = Number(button.dataset.cvTime);
        video.scrollIntoView({
          block: 'center',
          behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 'instant'
            : 'smooth',
        });
      }),
  );
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
