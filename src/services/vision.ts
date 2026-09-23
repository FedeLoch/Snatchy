import { AutomaticBarTracker } from '../domain/automatic-bar';
import { grayscale } from '../domain/bar-track';
import { analyzeRepetitions } from '../domain/repetitions';
import {
  analyzePoseSamples,
  visible,
  type Landmark,
  type PoseSample,
  type VisionAnalysis,
} from '../domain/vision';
import type { VideoSource } from '../domain/types';
export const MAX_ANALYSIS_SECONDS = 120;
export const SAMPLE_RATE = 15;
interface Reply {
  id: number;
  error?: string;
  people: number;
  landmarks: Landmark[];
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
      clearTimeout(timer);
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
      reject(new Error('This video could not be decoded. Try an MP4 clip.'));
    };
    const aborted = () => {
      cleanup();
      reject(new DOMException('Analysis cancelled', 'AbortError'));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Video decoding timed out. Try a shorter clip.'));
    }, 15000);
    video.addEventListener(event, done, { once: true });
    video.addEventListener('error', failed, { once: true });
    signal.addEventListener('abort', aborted, { once: true });
    action?.();
  });
}
/** Wait for the composited frame as well as seek completion where supported.
 * A bounded fallback handles paused/hidden decoders that omit frame callbacks. */
export async function seekVideoFrame(
  video: HTMLVideoElement,
  time: number,
  signal: AbortSignal,
): Promise<void> {
  if (typeof video.requestVideoFrameCallback !== 'function') {
    await mediaEvent(video, 'seeked', signal, () => {
      video.currentTime = time;
    });
    return;
  }
  let finish!: () => void;
  const presented = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const callback = video.requestVideoFrameCallback(() => finish());
  const timer = setTimeout(finish, 100);
  signal.addEventListener('abort', finish, { once: true });
  try {
    await mediaEvent(video, 'seeked', signal, () => {
      video.currentTime = time;
    });
    await presented;
    signal.throwIfAborted();
  } finally {
    clearTimeout(timer);
    video.cancelVideoFrameCallback(callback);
    signal.removeEventListener('abort', finish);
  }
}
export async function analyzeVideo(
  source: VideoSource,
  options: {
    signal: AbortSignal;
    onProgress: (progress: number, label: string) => void;
  },
): Promise<VisionAnalysis> {
  const { signal, onProgress } = options;
  signal.throwIfAborted();
  if (source.duration > MAX_ANALYSIS_SECONDS)
    throw new Error(
      'Record up to two minutes at a time. Detected repetitions are analyzed separately.',
    );
  if (source.duration < 0.8)
    throw new Error(
      'Use a clip at least 0.8 seconds long so enough frames can be measured.',
    );
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
        clearTimeout(timer);
        worker.removeEventListener('message', receive);
        worker.removeEventListener('error', fail);
        signal.removeEventListener('abort', abort);
      };
      const receive = (event: MessageEvent<Reply>) => {
        if (event.data.id !== current) return;
        cleanup();
        if (event.data.error) reject(new Error(event.data.error));
        else resolve(event.data);
      };
      const fail = () => {
        cleanup();
        reject(
          new Error(
            'The local pose model could not start. Try a current Chrome or Safari browser.',
          ),
        );
      };
      const abort = () => {
        cleanup();
        reject(new DOMException('Analysis cancelled', 'AbortError'));
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(
          new Error(
            'Pose analysis timed out. Try a shorter clip or a faster device.',
          ),
        );
      }, 45000);
      worker.addEventListener('message', receive);
      worker.addEventListener('error', fail, { once: true });
      signal.addEventListener('abort', abort, { once: true });
      worker.postMessage({ ...message, id: current }, transfer);
    });
  }
  try {
    onProgress(0, 'Loading the local pose model');
    await request({ type: 'init', origin: location.origin });
    await mediaEvent(video, 'loadeddata', signal, () => {
      video.src = source.url;
      video.load();
    });
    const width = video.videoWidth,
      height = video.videoHeight;
    if (!width || !height)
      throw new Error('Video dimensions are unavailable. Try another clip.');
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 640 / Math.max(width, height));
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext('2d');
    if (!context)
      throw new Error('This browser cannot decode video frames for analysis.');
    const frames: PoseSample[] = [];
    const count = Math.ceil(source.duration * SAMPLE_RATE);
    for (let index = 0; index < count; index++) {
      signal.throwIfAborted();
      const target = Math.min(index / SAMPLE_RATE, source.duration - 0.01);
      if (Math.abs(video.currentTime - target) > 0.001)
        await seekVideoFrame(video, target, signal);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const bitmap = await createImageBitmap(canvas);
      if (signal.aborted) {
        bitmap.close();
        signal.throwIfAborted();
      }
      const reply = await request(
        { type: 'frame', bitmap, time: video.currentTime },
        [bitmap],
      );
      frames.push({
        time: video.currentTime,
        people: reply.people,
        landmarks: reply.landmarks,
      });
      onProgress(
        ((index + 1) / count) * 0.8,
        `Tracking frame ${index + 1} of ${count}`,
      );
    }
    signal.throwIfAborted();
    const analysis = analyzePoseSamples(
      frames,
      width,
      height,
      source.duration,
      SAMPLE_RATE,
    );
    analysis.repetitions = analyzeRepetitions(analysis);
    const targets = analysis.repetitions.length
      ? analysis.repetitions
      : [analysis];
    const barCanvas = document.createElement('canvas');
    const barScale = Math.min(1, 320 / Math.max(width, height));
    barCanvas.width = Math.round(width * barScale);
    barCanvas.height = Math.round(height * barScale);
    const barContext = barCanvas.getContext('2d', { willReadFrequently: true });
    if (barContext) {
      let processed = 0;
      const total = targets.reduce((sum, rep) => sum + rep.frames.length, 0);
      for (const rep of targets) {
        const tracker = new AutomaticBarTracker();
        for (const pose of rep.frames) {
          signal.throwIfAborted();
          if (
            pose.people !== 1 ||
            ![pose.landmarks[15], pose.landmarks[16]].some(visible)
          ) {
            processed++;
            continue;
          }
          const target = Math.min(pose.time + 0.001, source.duration - 0.001);
          if (Math.abs(video.currentTime - target) > 0.0001)
            await seekVideoFrame(video, target, signal);
          barContext.drawImage(video, 0, 0, barCanvas.width, barCanvas.height);
          tracker.push(
            grayscale(
              barContext.getImageData(0, 0, barCanvas.width, barCanvas.height)
                .data,
              barCanvas.width,
              barCanvas.height,
            ),
            pose,
          );
          onProgress(
            0.8 + 0.2 * (++processed / total),
            'Looking for a visible plate and tracking its path',
          );
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
        rep.automaticBar = tracker.result();
      }
    }
    onProgress(1, 'Analysis complete');
    return analysis;
  } finally {
    worker.terminate();
    video.pause();
    video.removeAttribute('src');
    video.load();
  }
}
