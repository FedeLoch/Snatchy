import type { VisionAnalysis } from '../domain/vision';
import type { VideoSource } from '../domain/types';
import type { BarTrack } from '../domain/bar-track';
import { trackBar } from '../services/bar-tracker';
import { escapeHtml as e } from './html';
import { formatNumber, t, td } from '../i18n';
export function openBarCalibration(
  source: VideoSource,
  save: (track: BarTrack) => void,
  analysis?: VisionAnalysis,
): () => void {
  const rangeStart = analysis?.interval?.start ?? 0;
  const rangeEnd = analysis?.interval?.end ?? source.duration;
  const automatic = analysis?.automaticBar;
  const initialTime = automatic?.points[0].time ?? rangeStart;
  const dialog = document.createElement('dialog');
  dialog.className = 'bar-calibration';
  dialog.setAttribute('aria-labelledby', 'bar-title');
  dialog.innerHTML = `<button class="dialog-close" aria-label="${e(t('barTrack.close'))}">×</button><h2 id="bar-title">${e(t('barTrack.title'))}</h2><p>${e(t('barTrack.intro'))}</p><video src="${e(source.url)}" muted playsinline preload="auto" hidden></video><canvas tabindex="0" role="img" aria-label="${e(t('barTrack.canvasAria'))}"></canvas><label>${e(t('barTrack.videoPosition'))} <input id="bar-scrub" type="range" min="${rangeStart}" max="${Math.max(rangeStart, rangeEnd - 0.01)}" step="0.066667" value="${initialTime}"></label><output id="bar-time">${e(formatNumber(initialTime, 2))} s</output><div class="bar-fields"><label>${e(t('barTrack.centerX'))}<input id="bar-x" type="number" min="0" max="100" step="0.1"></label><label>${e(t('barTrack.centerY'))}<input id="bar-y" type="number" min="0" max="100" step="0.1"></label><label>${e(t('barTrack.radius'))}<input id="bar-radius" type="number" min="0.1" max="40" step="0.1"></label><label>${e(t('barTrack.diameter'))}<input id="bar-diameter" type="number" min="5" max="100" step="0.1" placeholder="${e(t('barTrack.diameterPlaceholder'))}"></label><label>${e(t('barTrack.trackUntil'))}<input id="bar-end" type="number" min="0.3" max="${rangeEnd}" step="0.01" value="${Math.min(rangeEnd - 0.01, initialTime + 30).toFixed(2)}"></label></div><label class="bar-confirm"><input id="bar-static" type="checkbox">${e(t('barTrack.stationary'))}</label><button id="bar-start" class="primary" disabled>${e(t('barTrack.start'))}</button><p id="bar-progress" role="status">${e(t('barTrack.loading'))}</p><p id="bar-error" role="alert" class="error"></p><div id="bar-review" hidden><p>${e(t('barTrack.reviewIntro'))}</p><label class="bar-confirm"><input id="bar-verified" type="checkbox">${e(t('barTrack.verified'))}</label><button id="bar-save" class="primary" disabled>${e(t('barTrack.save'))}</button></div>`;
  document.body.append(dialog);
  dialog.showModal();
  const video = dialog.querySelector('video')!,
    canvas = dialog.querySelector('canvas')!,
    ctx = canvas.getContext('2d')!;
  const input = (id: string) =>
    dialog.querySelector<HTMLInputElement>('#bar-' + id)!;
  const status = dialog.querySelector('#bar-progress')!,
    error = dialog.querySelector('#bar-error')!;
  const start = dialog.querySelector<HTMLButtonElement>('#bar-start')!,
    saveButton = dialog.querySelector<HTMLButtonElement>('#bar-save')!;
  let selectingEdge = false,
    controller: AbortController | null = null,
    draft: BarTrack | null = null,
    closed = false;
  // A canvas has no CSS cascade, so the marker colours are read from this
  // surface's own tokens. The surface is pinned dark in every theme, so one
  // read per dialog is enough.
  let traceColor = '',
    pointColor = '';
  function palette() {
    if (traceColor) return;
    const style = getComputedStyle(dialog);
    traceColor = style.getPropertyValue('--accent-fill').trim() || '#7caec7';
    pointColor = style.getPropertyValue('--reference').trim() || '#e8792b';
  }
  function draw() {
    if (closed || !video.videoWidth || video.readyState < 2) return;
    palette();
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    if (draft) {
      ctx.strokeStyle = traceColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      draft.points.forEach((p, i) => {
        const x = (p.x / draft!.width) * canvas.width,
          y = (p.y / draft!.height) * canvas.height;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.stroke();
      const point = draft.points.reduce(
        (best, p) =>
          Math.abs(p.time - video.currentTime) <
          Math.abs(best.time - video.currentTime)
            ? p
            : best,
        draft.points[0],
      );
      if (Math.abs(point.time - video.currentTime) <= 0.1) {
        ctx.fillStyle = pointColor;
        ctx.beginPath();
        ctx.arc(
          (point.x / draft.width) * canvas.width,
          (point.y / draft.height) * canvas.height,
          6,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    } else if (input('x').value && input('y').value) {
      ctx.strokeStyle = traceColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(
        (+input('x').value / 100) * canvas.width,
        (+input('y').value / 100) * canvas.height,
        Math.max(3, (+input('radius').value / 100) * canvas.width),
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
    dialog.querySelector('#bar-time')!.textContent =
      formatNumber(video.currentTime, 2) + ' s';
  }
  video.addEventListener('loadeddata', () => {
    canvas.width = 640;
    canvas.height = Math.round((640 * video.videoHeight) / video.videoWidth);
    video.currentTime = initialTime;
    if (automatic) {
      input('x').value = (
        (automatic.points[0].x / automatic.width) *
        100
      ).toFixed(2);
      input('y').value = (
        (automatic.points[0].y / automatic.height) *
        100
      ).toFixed(2);
      input('radius').value = (
        (automatic.radius / automatic.width) *
        100
      ).toFixed(2);
    }
    start.disabled = false;
    status.textContent = automatic
      ? t('barTrack.prefilled')
      : t('barTrack.markCenter');
    draw();
  });
  video.addEventListener('seeked', draw);
  input('scrub').oninput = () => {
    video.currentTime = +input('scrub').value;
  };
  canvas.onclick = (event) => {
    if (controller || draft) return;
    const box = canvas.getBoundingClientRect(),
      x = (event.clientX - box.left) / box.width,
      y = (event.clientY - box.top) / box.height;
    if (!selectingEdge) {
      input('x').value = (x * 100).toFixed(2);
      input('y').value = (y * 100).toFixed(2);
      input('radius').value = '';
      selectingEdge = true;
      status.textContent = t('barTrack.markEdge');
    } else {
      input('radius').value = (
        Math.hypot(
          x - +input('x').value / 100,
          ((y - +input('y').value / 100) * canvas.height) / canvas.width,
        ) * 100
      ).toFixed(2);
      selectingEdge = false;
      status.textContent = t('barTrack.enterDiameter');
    }
    draw();
  };
  for (const name of ['x', 'y', 'radius'])
    input(name).oninput = () => {
      draft = null;
      dialog.querySelector<HTMLElement>('#bar-review')!.hidden = true;
      draw();
    };
  start.onclick = async () => {
    error.textContent = '';
    if (
      !input('static').checked ||
      ['x', 'y', 'radius', 'diameter'].some((id) => !input(id).value) ||
      +input('x').value < 0 ||
      +input('x').value > 100 ||
      +input('y').value < 0 ||
      +input('y').value > 100
    ) {
      error.textContent = t('barTrack.enterDiameter');
      return;
    }
    controller = new AbortController();
    start.disabled = true;
    draft = null;
    saveButton.disabled = true;
    input('verified').checked = false;
    dialog.querySelector<HTMLElement>('#bar-review')!.hidden = true;
    try {
      const result = await trackBar(
        source,
        {
          x: +input('x').value / 100,
          y: +input('y').value / 100,
          radius: +input('radius').value / 100,
          diameterCm: +input('diameter').value,
          time: video.currentTime,
          end: +input('end').value,
        },
        controller.signal,
        (p) => {
          status.textContent = t('barTrack.trackingPlate', {
            percent: formatNumber(p * 100, 0),
          });
        },
      );
      if (result.points.length < 3) throw new Error('errors.plateTrackLost');
      draft = result;
      status.textContent = `${result.stoppedEarly ? t('barTrack.confidenceFell') : ''}${t(
        'barTrack.done',
        {
          start: formatNumber(result.start, 2),
          end: formatNumber(result.end, 2),
        },
      )}`;
      dialog.querySelector<HTMLElement>('#bar-review')!.hidden = false;
      draw();
    } catch (cause) {
      if (!closed)
        error.textContent =
          cause instanceof Error ? td(cause.message) : t('barTrack.failed');
    } finally {
      controller = null;
      start.disabled = false;
    }
  };
  input('verified').onchange = () => {
    saveButton.disabled = !input('verified').checked;
  };
  saveButton.onclick = () => {
    if (!draft || !input('verified').checked) return;
    const result = { ...draft, reviewed: true };
    cleanup();
    save(result);
  };
  function cleanup() {
    if (closed) return;
    closed = true;
    controller?.abort();
    video.pause();
    video.removeAttribute('src');
    video.load();
    dialog.close();
    dialog.remove();
  }
  dialog.querySelector<HTMLButtonElement>('.dialog-close')!.onclick = cleanup;
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    cleanup();
  });
  return cleanup;
}
