import { mediaEvent } from './vision';
import {
  grayscale,
  createTemplate,
  matchTemplate,
  type BarTrack,
} from '../domain/bar-track';
import type { VideoSource } from '../domain/types';
export interface BarSeed {
  x: number;
  y: number;
  radius: number;
  diameterCm: number;
  time: number;
  end: number;
}
export async function trackBar(
  source: VideoSource,
  seed: BarSeed,
  signal: AbortSignal,
  onProgress: (value: number) => void,
): Promise<BarTrack> {
  signal.throwIfAborted();
  if (
    ![seed.x, seed.y, seed.radius, seed.diameterCm, seed.time, seed.end].every(
      Number.isFinite,
    ) ||
    seed.radius <= 0 ||
    seed.diameterCm < 5 ||
    seed.diameterCm > 100 ||
    seed.time < 0 ||
    seed.end > source.duration ||
    seed.end - seed.time < 0.3 ||
    seed.end - seed.time > 30
  )
    throw new Error(
      'Choose a valid plate diameter and a tracking interval of 0.3–30 seconds.',
    );
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  try {
    await mediaEvent(video, 'loadeddata', signal, () => {
      video.src = source.url;
      video.load();
    });
    const scale = Math.min(
      1,
      320 / Math.max(video.videoWidth, video.videoHeight),
    );
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Frame decoding unavailable.');
    const radius = seed.radius * canvas.width;
    let x = seed.x * canvas.width,
      y = seed.y * canvas.height;
    const read = async (time: number) => {
      signal.throwIfAborted();
      if (Math.abs(video.currentTime - time) > 0.001)
        await mediaEvent(video, 'seeked', signal, () => {
          // Stay just inside the sample boundary. Exact fractional seeks can
          // decode the preceding frame after codec timestamp rounding.
          video.currentTime = Math.min(time + 0.001, source.duration - 0.001);
        });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return grayscale(
        ctx.getImageData(0, 0, canvas.width, canvas.height).data,
        canvas.width,
        canvas.height,
      );
    };
    // Force a decoded seek before sampling the first frame: loadeddata can precede
    // presentation of the initial video texture in a hidden decoder.
    await mediaEvent(video, 'seeked', signal, () => {
      video.currentTime = Math.min(seed.time + 0.001, source.duration - 0.01);
    });
    const template = createTemplate(await read(seed.time), x, y, radius);
    const track: BarTrack = {
      version: 1,
      method: 'seeded-template',
      points: [{ time: seed.time, x, y, confidence: 1 }],
      width: canvas.width,
      height: canvas.height,
      metersPerPixel: seed.diameterCm / 100 / (2 * radius),
      diameterCm: seed.diameterCm,
      start: seed.time,
      end: seed.time,
      requestedEnd: seed.end,
      reviewed: false,
      stoppedEarly: false,
    };
    const count = Math.floor((seed.end - seed.time) * 15);
    for (let i = 1; i <= count; i++) {
      const time = Math.min(seed.time + i / 15, source.duration - 0.01);
      const frame = await read(time);
      const match = matchTemplate(frame, template, x, y, radius);
      if (!match) {
        track.stoppedEarly = true;
        break;
      }
      x = match.x;
      y = match.y;
      track.points.push({ time, x, y, confidence: match.confidence });
      track.end = time;
      onProgress(i / count);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    signal.throwIfAborted();
    return track;
  } finally {
    video.pause();
    video.removeAttribute('src');
    video.load();
  }
}
