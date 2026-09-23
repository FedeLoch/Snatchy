import type { VisionAnalysis } from '../domain/vision';
import type { VideoSource } from '../domain/types';
import type { BarTrack } from '../domain/bar-track';
import { trackBar } from '../services/bar-tracker';
import { escapeHtml as e } from './html';
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
  dialog.innerHTML = `<button class="dialog-close" aria-label="Close bar tracking">×</button><h2 id="bar-title">Track your bar</h2><p>Pause just before the lift. Mark the center of the visible plate, then its outer edge. Enter the actual plate diameter. Use a fixed side-view camera; the plate must remain in the same plane.</p><video src="${e(source.url)}" muted playsinline preload="auto" hidden></video><canvas tabindex="0" role="img" aria-label="Video frame for plate selection. Click center then edge, or use the position fields below."></canvas><label>Video position <input id="bar-scrub" type="range" min="${rangeStart}" max="${Math.max(rangeStart, rangeEnd - 0.01)}" step="0.066667" value="${initialTime}"></label><output id="bar-time">${initialTime.toFixed(2)} s</output><div class="bar-fields"><label>Center X (%)<input id="bar-x" type="number" min="0" max="100" step="0.1"></label><label>Center Y (%)<input id="bar-y" type="number" min="0" max="100" step="0.1"></label><label>Plate radius (% of frame width)<input id="bar-radius" type="number" min="0.1" max="40" step="0.1"></label><label>Actual plate diameter (cm)<input id="bar-diameter" type="number" min="5" max="100" step="0.1" placeholder="Enter measured diameter"></label><label>Track until (seconds)<input id="bar-end" type="number" min="0.3" max="${rangeEnd}" step="0.01" value="${Math.min(rangeEnd - 0.01, initialTime + 30).toFixed(2)}"></label></div><label class="bar-confirm"><input id="bar-static" type="checkbox">The camera is stationary and the plate stays in the same plane.</label><button id="bar-start" class="primary" disabled>Track marked plate</button><p id="bar-progress" role="status">Loading video frame…</p><p id="bar-error" role="alert" class="error"></p><div id="bar-review" hidden><p>Scrub through the tracked interval. The highlighted dot must stay on the plate center. Reject and retrack if it follows the background or another object.</p><label class="bar-confirm"><input id="bar-verified" type="checkbox">I reviewed the tracked interval and the dot follows the plate.</label><button id="bar-save" class="primary" disabled>Use reviewed measurements</button></div>`;
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
  function draw() {
    if (closed || !video.videoWidth || video.readyState < 2) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    if (draft) {
      ctx.strokeStyle = '#d4f778';
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
        ctx.fillStyle = '#67dcff';
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
      ctx.strokeStyle = '#d4f778';
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
      video.currentTime.toFixed(2) + ' s';
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
      ? 'Automatic candidate prefilled. Verify the marked plate and enter its measured diameter.'
      : 'Mark the plate center, then its outer edge.';
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
      status.textContent = 'Now mark the outer edge of this plate.';
    } else {
      input('radius').value = (
        Math.hypot(
          x - +input('x').value / 100,
          ((y - +input('y').value / 100) * canvas.height) / canvas.width,
        ) * 100
      ).toFixed(2);
      selectingEdge = false;
      status.textContent =
        'Enter the real diameter and confirm the camera setup.';
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
      error.textContent =
        'Mark the plate, enter its diameter, and confirm the camera setup.';
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
          status.textContent = `Tracking plate: ${Math.round(p * 100)}%`;
        },
      );
      if (result.points.length < 3)
        throw new Error(
          'The plate could not be followed reliably. Choose a clearer starting frame and mark the plate again.',
        );
      draft = result;
      status.textContent = `${result.stoppedEarly ? 'Confidence fell; partial track only. ' : ''}Tracked ${result.start.toFixed(2)}–${result.end.toFixed(2)} s. Review before saving.`;
      dialog.querySelector<HTMLElement>('#bar-review')!.hidden = false;
      draw();
    } catch (cause) {
      if (!closed)
        error.textContent =
          cause instanceof Error ? cause.message : 'Tracking failed.';
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
