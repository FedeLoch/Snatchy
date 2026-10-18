import { analyzeRepetitions } from '../domain/repetitions';
import {
  analyzePoseSamples,
  type Landmark,
  type PoseSample,
  type VisionAnalysis,
} from '../domain/vision';
import type { VideoSource } from '../domain/types';
export const MAX_ANALYSIS_SECONDS = 120;
export const SAMPLE_RATE = 15;
/** Optional precise timing: a second pull lasts roughly 0.1–0.25 s, only one
 * to three samples at 15 Hz, and 30 Hz halves the timing step for phases and
 * checks. It about doubles processing time, so it is opt-in and limited to
 * short clips. */
export const PRECISE_SAMPLE_RATE = 30;
export const PRECISE_MAX_SECONDS = 30;
export type TimingDetail = 'standard' | 'precise';
export const sampleRateFor = (
  duration: number,
  detail: TimingDetail = 'standard',
): number =>
  detail === 'precise' && duration <= PRECISE_MAX_SECONDS
    ? PRECISE_SAMPLE_RATE
    : SAMPLE_RATE;
/** Longest decoded edge sent to the worker. The pose model crops the athlete
 * from this frame and the hand model crops each hand, so more source pixels
 * give both models a sharper view than a pre-shrunk 640 px frame. 1920
 * keeps 1080p phone video at native resolution. */
export const ANALYSIS_EDGE = 1920;
interface Reply {
  id: number;
  error?: string;
  people: number;
  landmarks: Landmark[];
  hands?: PoseSample['hands'];
  world?: PoseSample['world'];
  barShaft?: PoseSample['barShaft'];
}
/** A timeout that only counts time while the page is visible. Android pauses
 * the app when the screen locks or another app opens, and work resumes
 * afterwards, so time spent paused must not count as a stall. A frozen page
 * runs no timers; the first tick after resuming counts at most one second. */
export function patientTimeout(ms: number, onTimeout: () => void): () => void {
  let elapsed = 0,
    last = Date.now();
  const tick = setInterval(() => {
    const now = Date.now();
    if (typeof document === 'undefined' || !document.hidden)
      elapsed += Math.min(now - last, 1000);
    last = now;
    if (elapsed >= ms) {
      clearInterval(tick);
      onTimeout();
    }
  }, 250);
  return () => clearInterval(tick);
}
export function mediaEvent(
  video: HTMLVideoElement,
  event: string,
  signal: AbortSignal,
  action?: () => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const cleanup = () => {
      stopTimer();
      video.removeEventListener(event, done);
      video.removeEventListener('error', failed);
      signal.removeEventListener('abort', aborted);
    };
    const done = () => {
      cleanup();
      resolve();
    };
    const failed = () => {
      cleanup();
      reject(new Error('errors.vision.decodeFailed'));
    };
    const aborted = () => {
      cleanup();
      reject(new DOMException('Analysis cancelled', 'AbortError'));
    };
    const stopTimer = patientTimeout(15000, () => {
      cleanup();
      reject(new Error('errors.vision.decodeTimedOut'));
    });
    video.addEventListener(event, done, { once: true });
    video.addEventListener('error', failed, { once: true });
    signal.addEventListener('abort', aborted, { once: true });
    action?.();
  });
}
/** Wait for the composited frame as well as seek completion where supported.
 * A bounded fallback handles paused/hidden decoders that omit frame callbacks.
 * Resolves with the presented frame's media timestamp when the browser
 * reports one, so callers can recognize a repeated source frame. */
export async function seekVideoFrame(
  video: HTMLVideoElement,
  time: number,
  signal: AbortSignal,
): Promise<number | null> {
  if (typeof video.requestVideoFrameCallback !== 'function') {
    await mediaEvent(video, 'seeked', signal, () => {
      video.currentTime = time;
    });
    return null;
  }
  let mediaTime: number | null = null;
  let finish!: () => void;
  const presented = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const callback = video.requestVideoFrameCallback((_, metadata) => {
    mediaTime = metadata?.mediaTime ?? null;
    finish();
  });
  const timer = setTimeout(finish, 100);
  signal.addEventListener('abort', finish, { once: true });
  try {
    await mediaEvent(video, 'seeked', signal, () => {
      video.currentTime = time;
    });
    await presented;
    signal.throwIfAborted();
    return mediaTime;
  } finally {
    clearTimeout(timer);
    video.cancelVideoFrameCallback(callback);
    signal.removeEventListener('abort', finish);
  }
}
/** Seek to each sample time. Precise timing seeks a quarter interval past
 * each sample time, so a seek never lands on an ambiguous frame boundary,
 * and skips a repeated source frame instead of analyzing it twice. */
async function* seekedFrames(
  video: HTMLVideoElement,
  rate: number,
  duration: number,
  count: number,
  signal: AbortSignal,
  capture: () => void,
): AsyncGenerator<number> {
  const precise = rate > SAMPLE_RATE;
  const offset = precise ? 0.25 / rate : 0;
  let lastMediaTime: number | null = null;
  for (let index = 0; index < count; index++) {
    signal.throwIfAborted();
    const target = Math.min(index / rate + offset, duration - 0.01);
    if (Math.abs(video.currentTime - target) > 0.001) {
      const mediaTime = await seekVideoFrame(video, target, signal);
      if (precise && mediaTime !== null && mediaTime === lastMediaTime)
        continue;
      lastMediaTime = mediaTime;
    } else lastMediaTime = video.currentTime;
    capture();
    yield video.currentTime;
  }
}
export async function analyzeVideo(
  source: VideoSource,
  options: {
    signal: AbortSignal;
    exerciseId?: string;
    poseModel?: 'lite' | 'full';
    timing?: TimingDetail;
    /** Overrides the timing-based sampling rate. */
    sampleRate?: number;
    onProgress: (progress: number, label: string) => void;
  },
): Promise<VisionAnalysis> {
  const { signal, onProgress } = options;
  signal.throwIfAborted();
  if (source.duration > MAX_ANALYSIS_SECONDS)
    throw new Error('errors.vision.tooLong');
  if (source.duration < 0.8) throw new Error('errors.vision.tooShort');
  const worker = new Worker(
    new URL('../workers/pose.worker.ts', import.meta.url),
    { type: 'module' },
  );
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  let id = 0;
  function request(
    message: Record<string, unknown>,
    transfer: Transferable[] = [],
  ): Promise<Reply> {
    return new Promise((resolve, reject) => {
      signal.throwIfAborted();
      const current = ++id;
      const cleanup = () => {
        stopTimer();
        worker.removeEventListener('message', receive);
        worker.removeEventListener('error', fail);
        signal.removeEventListener('abort', abort);
      };
      const receive = (event: MessageEvent<Reply>) => {
        if (event.data.id !== current) return;
        cleanup();
        if (event.data.error)
          reject(new Error('errors.vision.inferenceFailed'));
        else resolve(event.data);
      };
      const fail = () => {
        cleanup();
        reject(new Error('errors.vision.modelFailed'));
      };
      const abort = () => {
        cleanup();
        reject(new DOMException('Analysis cancelled', 'AbortError'));
      };
      const stopTimer = patientTimeout(45000, () => {
        cleanup();
        reject(new Error('errors.vision.analysisTimedOut'));
      });
      worker.addEventListener('message', receive);
      worker.addEventListener('error', fail, { once: true });
      signal.addEventListener('abort', abort, { once: true });
      worker.postMessage({ ...message, id: current }, transfer);
    });
  }
  try {
    onProgress(0, 'vision.loadingModel');
    await request({
      type: 'init',
      origin: location.origin,
      model: options.poseModel ?? 'lite',
    });
    await mediaEvent(video, 'loadeddata', signal, () => {
      video.src = source.url;
      video.load();
    });
    const width = video.videoWidth,
      height = video.videoHeight;
    if (!width || !height) throw new Error('errors.vision.noDimensions');
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, ANALYSIS_EDGE / Math.max(width, height));
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('errors.noFrameDecoding');
    const frames: PoseSample[] = [];
    const rate =
      options.sampleRate ?? sampleRateFor(source.duration, options.timing);
    const count = Math.ceil(source.duration * rate);
    const capture = () =>
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const sampled = seekedFrames(
      video,
      rate,
      source.duration,
      count,
      signal,
      capture,
    );
    for await (const time of sampled) {
      const bitmap = await createImageBitmap(canvas);
      if (signal.aborted) {
        bitmap.close();
        signal.throwIfAborted();
      }
      const reply = await request({ type: 'frame', bitmap, time }, [bitmap]);
      frames.push({
        time,
        people: reply.people,
        landmarks: reply.landmarks,
        ...(reply.hands ? { hands: reply.hands } : {}),
        ...(reply.world ? { world: reply.world } : {}),
        barShaft: reply.barShaft,
      });
      onProgress(
        Math.min(1, time / source.duration) * 0.8,
        `Tracking frame ${frames.length} of ${count}`,
      );
    }
    signal.throwIfAborted();
    // When repeated frames were skipped, the source could not supply the
    // dense rate; analyze with the base-rate rules its samples actually fit.
    const analysisRate =
      rate > SAMPLE_RATE && frames.length < count * 0.75 ? SAMPLE_RATE : rate;
    const analysis = analyzePoseSamples(
      frames,
      width,
      height,
      source.duration,
      analysisRate,
      options.exerciseId ?? 'auto',
    );
    analysis.engine =
      options.poseModel === 'full'
        ? 'MediaPipe Pose Landmarker Full'
        : 'MediaPipe Pose Landmarker Lite';
    analysis.repetitions = analyzeRepetitions(analysis);
    for (const rep of analysis.repetitions) rep.engine = analysis.engine;
    onProgress(1, 'status.analysisComplete');
    return analysis;
  } finally {
    worker.terminate();
    video.pause();
    video.removeAttribute('src');
    video.load();
  }
}
