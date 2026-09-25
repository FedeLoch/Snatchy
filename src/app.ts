import { analyzePoseSamples } from './domain/vision';
import { exerciseById } from './domain/exercises';
import { analyzeVideo } from './services/vision';
import {
  loadVisionHistory,
  saveVisionHistory,
} from './services/vision-history';
import type { VisionRecord } from './domain/vision';
import {
  visionRows,
  visionProcessing,
  visionResult,
  bindVisionPlayback,
} from './ui/vision';
import './style.css';
import { requireMovement } from './domain/movements';
import { phaseAt } from './domain/analysis';
import type { LiftRecord, Page, VideoSource } from './domain/types';
import {
  addRecord,
  loadHistory,
  saveHistory,
  type StoragePort,
} from './services/history';
import { prepareVideo, releaseVideo } from './services/media';
import {
  applyTheme,
  loadTheme,
  preferredTheme,
  saveTheme,
  systemTheme,
  type Theme,
} from './services/theme';
import { LiftPlayer, type PlayerState } from './ui/player';
import { escapeHtml as e, icon } from './ui/html';
import { movementVisual } from './ui/movement-visuals';
import * as views from './ui/views';
const root = document.querySelector<HTMLDivElement>('#app')!;
// Access storage lazily: browsers can deny the localStorage getter itself.
const storage: StoragePort = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
};
const saved = loadHistory(storage);
let visionRecords = loadVisionHistory(storage);
const visionVideos = new Map<string, VideoSource>();
const selectedReps = new Map<string, number>();
function selectedAnalysis(record: VisionRecord) {
  return (
    record.analysis.repetitions?.[selectedReps.get(record.id) ?? 0] ??
    record.analysis
  );
}
let exerciseChoice = 'auto';
let suppressFocus = false;
let noticeTimer: ReturnType<typeof setTimeout> | undefined;
let removedUntil = 0;
let visionCleanup: (() => void) | null = null;
let records = saved.records,
  warning = saved.warning;
let removed: { kind: string; record: LiftRecord | VisionRecord } | null = null;
let movement = requireMovement('snatch');
let page: Page = 'home';
let pendingVideo: VideoSource | null = null;
let work: AbortController | null = null;
let player: LiftPlayer | null = null;
let active: LiftRecord | null = null;
let selected: string | null = 'arms';
let overlay = true;
let theme = preferredTheme(storage);
applyTheme(document, theme);
let loadingVideo = false;
let announceTimer: ReturnType<typeof setTimeout> | undefined;
function announce(message: string) {
  clearTimeout(announceTimer);
  const region = document.querySelector('#announcer');
  if (region) {
    region.textContent = message;
    announceTimer = setTimeout(() => {
      region.textContent = '';
    }, 5000);
  }
}
function go(destination: string) {
  if (location.hash === '#' + destination) route();
  else location.hash = destination;
}
function dispose() {
  visionCleanup?.();
  visionCleanup = null;
  work?.abort();
  work = null;
  loadingVideo = false;
  player?.dispose();
  player = null;
  document.querySelector('video')?.pause();
}
function draw(content: string, focus = true) {
  root.innerHTML = views.shell(content, page, theme);
  if (removed)
    root
      .querySelector('main')
      ?.insertAdjacentHTML(
        'afterbegin',
        '<div class="history-undo" role="status">Lift removed from history.<button data-action="undo-history">Undo removal</button></div>',
      );
  if (focus && !suppressFocus) {
    document.querySelector<HTMLElement>('main')?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(
    () => {
      root
        .querySelectorAll('.notice[role="status"]')
        .forEach((n) => n.remove());
      warning = '';
      const toast = root.querySelector('.history-undo');
      if (toast?.contains(document.activeElement)) {
        toast.addEventListener('focusout', () => setTimeout(expireUndo, 2000), {
          once: true,
        });
      } else expireUndo();
    },
    removed ? Math.max(0, removedUntil - Date.now()) : 7000,
  );
}
function expireUndo() {
  if (removed && Date.now() >= removedUntil) {
    if (removed.kind === 'vision') {
      releaseVideo(visionVideos.get(removed.record.id) ?? null);
      visionVideos.delete(removed.record.id);
    }
    removed = null;
    root.querySelector('.history-undo')?.remove();
  }
}
function refreshInPlace(index = 0) {
  const y = window.scrollY;
  suppressFocus = true;
  route();
  suppressFocus = false;
  const buttons = root.querySelectorAll<HTMLButtonElement>('.history-remove');
  (
    buttons[Math.min(index, buttons.length - 1)] ??
    root.querySelector<HTMLElement>('a[href="#capture"]')
  )?.focus({ preventScroll: true });
  window.scrollTo(0, y);
}
function route() {
  const route = location.hash.slice(1) || 'home';
  if (route === 'main') {
    document.querySelector<HTMLElement>('main')?.focus();
    return;
  }
  dispose();
  if (route.startsWith('vision/')) {
    const record = visionRecords.find((r) => r.id === route.slice(7));
    if (!record) {
      page = 'history';
      draw(
        views.history(
          records,
          'That analysis is no longer available.',
          visionRows(visionRecords),
        ),
      );
      return;
    }
    page = 'result';
    active = null;
    const analysis = selectedAnalysis(record);
    draw(
      visionResult(
        { ...record, analysis },
        visionVideos.get(record.id) ?? null,
        warning,
      ),
    );
    if (record.analysis.repetitions?.length) {
      const nav = document.createElement('nav');
      nav.className = 'rep-selector';
      nav.setAttribute('aria-label', 'Detected repetitions');
      nav.innerHTML = record.analysis.repetitions
        .map(
          (rep, i) =>
            `<button class="rep-pill" data-action="select-rep" data-id="${record.id}" data-rep="${i}" aria-pressed="${rep === analysis}">Rep ${i + 1}<small>${rep.interval!.start.toFixed(1)}–${rep.interval!.end.toFixed(1)} s</small></button>`,
        )
        .join('');
      root.querySelector('.analysis-layout')?.before(nav);
    }
    visionCleanup = bindVisionPlayback(root, analysis);
    return;
  }
  if (route.startsWith('result/')) {
    active = records.find((r) => r.id === route.slice(7)) ?? null;
    if (!active) {
      page = 'history';
      draw(views.history(records, 'That saved result is no longer available.'));
      return;
    }
    movement = requireMovement(active.analysis.movementId);
    page = 'result';
    selected = null;
    overlay = true;
    renderResult();
    return;
  }
  active = null;
  page = route === 'capture' || route === 'history' ? route : 'home';
  if (page !== 'capture') {
    releaseVideo(pendingVideo);
    pendingVideo = null;
  }
  if (page === 'home')
    draw(views.home(records, warning, visionRows(visionRecords.slice(0, 3))));
  else if (page === 'history')
    draw(views.history(records, warning, visionRows(visionRecords)));
  else draw(views.capture(movement, pendingVideo, exerciseChoice));
}
function renderResult() {
  if (!active) return;
  if (active.source === 'video') {
    draw(views.unanalyzedUpload());
    return;
  }
  const source: VideoSource | null = null;
  draw(views.result(active, movement, source, selected, warning));
  const video = document.querySelector<HTMLVideoElement>('#lift-video');
  player = new LiftPlayer(active.analysis.duration, updatePlayback, video);
  player.seek(0);
  if (video) {
    video.addEventListener(
      'loadedmetadata',
      () => player?.seek(player.state.time),
      { once: true },
    );
    video.addEventListener('error', () => {
      player?.pause();
      document.querySelector('#media-error')!.textContent =
        'This clip could not be played. Import another video or return to the demo.';
    });
  }
  updateReading();
}
function updatePlayback(state: PlayerState) {
  if (!active) return;
  const a = active.analysis,
    phase = phaseAt(a, state.time),
    issue = a.issues.find((i) => i.id === selected);
  const frame = document.querySelector('#pose-frame');
  if (frame)
    frame.innerHTML = movementVisual(
      a.movementId,
      Math.min(state.time, a.duration),
      overlay,
      issue && Math.abs(state.time - issue.time) < 0.25
        ? issue.highlight
        : undefined,
    );
  const slider = document.querySelector<HTMLInputElement>('#scrubber');
  if (slider) {
    slider.value = String(state.time);
    slider.setAttribute(
      'aria-valuetext',
      `${state.time.toFixed(2)} seconds, ${phase.name}`,
    );
  }
  const time = document.querySelector('#time-label');
  if (time) time.textContent = state.time.toFixed(2) + ' s';
  const label = document.querySelector('#phase-label');
  if (label) label.textContent = phase.name;
  document
    .querySelectorAll<HTMLButtonElement>('[data-action="phase"]')
    .forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.id === phase.id));
    });
  const play = document.querySelector<HTMLButtonElement>(
    '[data-action="play"]',
  );
  if (play) {
    play.innerHTML = icon(state.playing ? 'pause' : 'play');
    play.setAttribute('aria-label', state.playing ? 'Pause lift' : 'Play lift');
  }
  const speed = document.querySelector<HTMLButtonElement>(
    '[data-action="speed"]',
  );
  if (speed) {
    speed.textContent = state.speed + '×';
    speed.setAttribute('aria-label', `Playback speed, ${state.speed} times`);
  }
  const loop = document.querySelector<HTMLButtonElement>(
    '[data-action="loop"]',
  );
  if (loop) {
    loop.setAttribute('aria-pressed', String(state.loopTime !== null));
    loop.disabled = !selected;
  }
}
function updateReading() {
  if (!active) return;
  const issue = active.analysis.issues.find((i) => i.id === selected);
  const reading = document.querySelector('#reading');
  if (reading)
    reading.innerHTML = issue
      ? `<span class="reading-dot"></span><div><strong>${e(issue.name)}</strong><span>${e(issue.measurement)}</span></div><b>${issue.time.toFixed(2)}<small> s</small></b>`
      : '<p>Select a phase or observation to inspect your lift.</p>';
}
function selectIssue(id: string, toggle = true) {
  if (!active || !player) return;
  const issue = active.analysis.issues.find((i) => i.id === id);
  if (!issue) return;
  player.pause();
  selected = toggle && selected === id ? null : id;
  const wasLooping = player.state.loopTime !== null;
  player.setLoop(wasLooping && selected ? issue.time : null);
  if (selected) player.seek(issue.time);
  document.querySelector('#issues')!.innerHTML = views.issueCards(
    active.analysis,
    movement,
    selected,
  );
  document
    .querySelector<HTMLButtonElement>(`[data-action="issue"][data-id="${id}"]`)
    ?.focus({ preventScroll: true });
  updateReading();
  announce(
    selected
      ? `${issue.name}, demo frame ${issue.time.toFixed(2)} seconds`
      : 'Observation collapsed',
  );
}

async function analyzeUpload() {
  if (!pendingVideo) return;
  dispose();
  const source = pendingVideo;
  const controller = new AbortController();
  work = controller;
  draw(visionProcessing());
  try {
    const analysis = await analyzeVideo(source, {
      signal: controller.signal,
      exerciseId: exerciseChoice,
      onProgress: (progress, label) => {
        const bar = root.querySelector<HTMLProgressElement>('progress');
        if (bar) bar.value = progress;
        const status = root.querySelector('#vision-progress-label');
        if (status) status.textContent = label;
      },
    });
    if (controller.signal.aborted) return;
    const record: VisionRecord = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      analysis,
    };
    visionVideos.set(record.id, source);
    pendingVideo = null;
    visionRecords = [record, ...visionRecords].slice(0, 10);
    for (const [id, video] of visionVideos) {
      if (!visionRecords.some((r) => r.id === id)) {
        releaseVideo(video);
        visionVideos.delete(id);
      }
    }
    warning = saveVisionHistory(storage, visionRecords);
    work = null;
    go('vision/' + record.id);
  } catch (error) {
    if (controller.signal.aborted) return;
    work = null;
    draw(views.capture(movement, pendingVideo, exerciseChoice));
    root.querySelector('#capture-error')!.textContent =
      error instanceof Error
        ? error.message
        : 'Video analysis failed. Try another clip.';
  }
}
async function importFile(file: File) {
  if (loadingVideo) return;
  work?.abort();
  const controller = new AbortController();
  work = controller;
  loadingVideo = true;
  document.querySelector('#capture-error')!.textContent = '';
  document.querySelector('#capture-status')!.textContent =
    'Opening your video…';
  document
    .querySelectorAll<HTMLButtonElement>(
      '[data-action="import"],[data-action="record"],[data-action="replace"]',
    )
    .forEach((b) => (b.disabled = true));
  try {
    const source = await prepareVideo(file, controller.signal);
    if (controller.signal.aborted) {
      releaseVideo(source);
      return;
    }
    releaseVideo(pendingVideo);
    pendingVideo = source;
    draw(views.capture(movement, pendingVideo, exerciseChoice));
  } catch (error) {
    if (controller.signal.aborted) return;
    document.querySelector('#capture-error')!.textContent =
      error instanceof Error ? error.message : 'Could not open this video.';
  } finally {
    if (!controller.signal.aborted) {
      loadingVideo = false;
      work = null;
      const status = document.querySelector('#capture-status');
      if (status) status.textContent = '';
      document
        .querySelectorAll<HTMLButtonElement>(
          '[data-action="import"],[data-action="record"],[data-action="replace"]',
        )
        .forEach((b) => (b.disabled = false));
    }
  }
}
function drill(id: string, trigger: HTMLElement) {
  const d = movement.drills.find((d) => d.id === id);
  if (!d) return;
  const dialog = document.createElement('dialog');
  dialog.setAttribute('aria-labelledby', 'drill-title');
  dialog.innerHTML = `<button class="dialog-close" aria-label="Close drill">${icon('close')}</button><div class="eyebrow">TAKE IT INTO YOUR NEXT SET</div><h2 id="drill-title">${e(d.name)}</h2><p>${e(d.instruction)}</p><blockquote>${e(d.cue)}</blockquote><button class="primary">Got it ${icon('check')}</button>`;
  dialog
    .querySelectorAll('button')
    .forEach((b) => (b.onclick = () => dialog.close()));
  dialog.addEventListener('close', () => {
    dialog.remove();
    trigger.focus();
  });
  root.append(dialog);
  dialog.showModal();
}
root.addEventListener('click', (event) => {
  const target = (event.target as Element).closest<HTMLElement>(
    '[data-action]',
  );
  if (!target) return;
  const action = target.dataset.action,
    id = target.dataset.id ?? '';
  if (action === 'select-rep') {
    const rep = Number(target.dataset.rep);
    selectedReps.set(id, rep);
    const y = window.scrollY;
    suppressFocus = true;
    route();
    suppressFocus = false;
    window.scrollTo(0, y);
    root
      .querySelector<HTMLElement>(
        `[data-action="select-rep"][data-id="${id}"][data-rep="${rep}"]`,
      )
      ?.focus({ preventScroll: true });
    announce(`Rep ${rep + 1} selected.`);
  } else if (action === 'remove-history') {
    const rowIndex = Array.from(
      root.querySelectorAll('.history-remove'),
    ).indexOf(target);
    const kind = target.dataset.kind;
    const record =
      kind === 'vision'
        ? visionRecords.find((r) => r.id === id)
        : records.find((r) => r.id === id);
    if (!record) return;
    const nextVision = visionRecords.filter((r) => r.id !== id);
    const nextDemo = records.filter((r) => r.id !== id);
    const failure =
      kind === 'vision'
        ? saveVisionHistory(storage, nextVision)
        : saveHistory(storage, nextDemo);
    if (failure) {
      warning =
        'Could not remove this lift from device storage. Please try again.';
      refreshInPlace(rowIndex);
      return;
    }
    if (removed?.kind === 'vision') {
      releaseVideo(visionVideos.get(removed.record.id) ?? null);
      visionVideos.delete(removed.record.id);
    }
    removed = { kind: kind!, record };
    removedUntil = Date.now() + 8000;
    if (kind === 'vision') visionRecords = nextVision;
    else records = nextDemo;
    warning = '';
    refreshInPlace(rowIndex);
  } else if (action === 'undo-history' && removed) {
    const nextVision =
      removed.kind === 'vision'
        ? [removed.record as VisionRecord, ...visionRecords]
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, 10)
        : visionRecords;
    const nextDemo =
      removed.kind === 'demo'
        ? addRecord(records, removed.record as LiftRecord).sort(
            (a, b) => b.createdAt - a.createdAt,
          )
        : records;
    const failure =
      removed.kind === 'vision'
        ? saveVisionHistory(storage, nextVision)
        : saveHistory(storage, nextDemo);
    if (failure)
      warning = 'Could not restore this lift. Please try Undo again.';
    else {
      visionRecords = nextVision;
      records = nextDemo;
      removed = null;
      warning = '';
    }
    refreshInPlace();
  } else if (action === 'analyze-video') void analyzeUpload();
  else if (action === 'review-speed') {
    const video = document.querySelector<HTMLVideoElement>(
      '.review-video video',
    );
    if (video) {
      video.playbackRate =
        video.playbackRate === 1 ? 0.5 : video.playbackRate === 0.5 ? 0.25 : 1;
      target.textContent = `Playback speed: ${video.playbackRate}×`;
    }
  } else if (action === 'cancel') {
    dispose();
    go('capture');
  } else if (action === 'record' || action === 'import' || action === 'replace')
    document
      .querySelector<HTMLInputElement>(
        action === 'record' ? '#record' : '#import',
      )
      ?.click();
  else if (action === 'play' && player) {
    if (player.state.playing) player.pause();
    else void player.play();
  } else if (action === 'speed') player?.setSpeed();
  else if (action === 'loop' && player && active) {
    const issue = active.analysis.issues.find((i) => i.id === selected);
    player.setLoop(
      player.state.loopTime !== null ? null : (issue?.time ?? null),
    );
  } else if (action === 'overlay') {
    overlay = !overlay;
    target.setAttribute('aria-pressed', String(overlay));
    target.innerHTML =
      icon('eye') + `<span>Pose ${overlay ? 'on' : 'off'}</span>`;
    if (player) updatePlayback(player.state);
  } else if (action === 'theme') {
    // Applied in place rather than through route(), so an in-flight analysis
    // or a playing lift is not torn down by a re-render.
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    theme = next;
    applyTheme(document, theme);
    target.setAttribute(
      'aria-label',
      `Switch to ${next === 'dark' ? 'light' : 'dark'} theme`,
    );
    target.setAttribute(
      'title',
      `Switch to ${next === 'dark' ? 'light' : 'dark'} theme`,
    );
    target.innerHTML = icon(next === 'dark' ? 'sun' : 'moon');
    const failure = saveTheme(storage, theme);
    if (failure) warning = failure;
    announce(`${theme === 'dark' ? 'Dark' : 'Light'} theme on.`);
  } else if (action === 'issue') selectIssue(id);
  else if (action === 'jump') {
    selectIssue(id, false);
    document
      .querySelector<HTMLElement>('.video-stage')
      ?.focus({ preventScroll: true });
    document.querySelector('.video-stage')?.scrollIntoView({
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
      block: 'start',
    });
  } else if (action === 'phase' && active && player) {
    const phase = active.analysis.phases.find((p) => p.id === id);
    if (phase) {
      player.pause();
      player.setLoop(null);
      player.seek(phase.start);
    }
  } else if (action === 'drill') drill(id, target);
});
root.addEventListener('change', (event) => {
  const input = event.target as HTMLInputElement;
  if (input.type === 'file' && input.files?.[0])
    void importFile(input.files[0]);
  if (input.id === 'movement') {
    exerciseChoice = input.value;
    if (input.value !== 'auto') movement = requireMovement(input.value);
  }
  if (input.id === 'result-exercise') {
    const record = visionRecords.find(
      (r) => '#vision/' + r.id === location.hash,
    );
    if (!record || (input.value !== 'auto' && !exerciseById(input.value)))
      return;
    const previous = selectedAnalysis(record);
    if (!previous.frames.length) return;
    const updated = analyzePoseSamples(
      previous.frames,
      previous.width,
      previous.height,
      previous.duration,
      previous.sampleRate,
      input.value,
    );
    updated.interval = previous.interval;
    if (record.analysis.repetitions?.length)
      record.analysis.repetitions[selectedReps.get(record.id) ?? 0] = updated;
    else record.analysis = updated;
    warning = saveVisionHistory(storage, visionRecords);
    suppressFocus = true;
    route();
    suppressFocus = false;
    root
      .querySelector<HTMLElement>('#result-exercise')
      ?.focus({ preventScroll: true });
    announce('Exercise updated. Phases and score recalculated.');
  }
});
root.addEventListener('input', (event) => {
  const input = event.target as HTMLInputElement;
  if (input.id === 'scrubber') {
    player?.pause();
    player?.seek(Number(input.value));
  }
});
root.addEventListener('keydown', (event) => {
  if (!(event.target as Element).matches('.video-stage')) return;
  if (event.code === 'Space') {
    event.preventDefault();
    if (player?.state.playing) player.pause();
    else void player?.play();
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    player?.pause();
    player?.seek(
      player.state.time + (event.key === 'ArrowLeft' ? -0.05 : 0.05),
    );
  }
});
window.addEventListener('hashchange', route);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) player?.pause();
});
// Follow the operating system only while no explicit choice has been stored,
// so a later system change is respected without overriding a deliberate pick.
matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
  if (loadTheme(storage) !== null) return;
  theme = systemTheme();
  applyTheme(document, theme);
  const toggle = root.querySelector<HTMLElement>('[data-action="theme"]');
  if (toggle) {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    toggle.setAttribute('aria-label', `Switch to ${next} theme`);
    toggle.setAttribute('title', `Switch to ${next} theme`);
    toggle.innerHTML = icon(next === 'dark' ? 'sun' : 'moon');
  }
});
window.addEventListener('pagehide', () => {
  dispose();
  releaseVideo(pendingVideo);
  visionVideos.forEach(releaseVideo);
  visionVideos.clear();
});
route();
