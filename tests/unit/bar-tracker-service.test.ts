import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { trackBar } from '../../src/services/bar-tracker';
const source = { url: 'blob:test', name: 'test.mp4', duration: 1 };
const seed = {
  x: 0.5,
  y: 0.5,
  radius: 0.15,
  diameterCm: 45,
  time: 0,
  end: 0.5,
};
let video: HTMLVideoElement,
  blankAfter = Infinity,
  contextUnavailable = false;
beforeEach(() => {
  blankAfter = Infinity;
  contextUnavailable = false;
  video = document.createElement('video');
  Object.defineProperty(video, 'videoWidth', { value: 100 });
  Object.defineProperty(video, 'videoHeight', { value: 100 });
  let time = 0;
  Object.defineProperty(video, 'currentTime', {
    get: () => time,
    set: (v) => {
      time = v;
      queueMicrotask(() => video.dispatchEvent(new Event('seeked')));
    },
  });
  const create = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) =>
    tag === 'video' ? video : create(tag)) as typeof document.createElement);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {
    if (video.hasAttribute('src'))
      queueMicrotask(() => video.dispatchEvent(new Event('loadeddata')));
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() =>
    contextUnavailable
      ? null
      : {
          drawImage: vi.fn(),
          getImageData: () => {
            const data = new Uint8ClampedArray(100 * 100 * 4),
              shift = Math.round(time * 15);
            if (time < blankAfter)
              for (let y = 35; y <= 65; y++)
                for (let x = 35; x <= 65; x++) {
                  const i = ((y - shift) * 100 + x) * 4,
                    value = (x * 31 + y * 17) % 251;
                  data[i] = value;
                  data[i + 1] = value;
                  data[i + 2] = value;
                  data[i + 3] = 255;
                }
            return { data };
          },
        }) as typeof HTMLCanvasElement.prototype.getContext);
});
afterEach(() => vi.restoreAllMocks());
it('tracks decoded pixels, reports progress and frees the decoder', async () => {
  const progress = vi.fn();
  const result = await trackBar(
    source,
    seed,
    new AbortController().signal,
    progress,
  );
  expect(result.points.length).toBeGreaterThan(3);
  expect(result.stoppedEarly).toBe(false);
  expect(result.reviewed).toBe(false);
  expect(result.points.at(-1)!.y).toBeLessThan(result.points[0].y);
  expect(result.metersPerPixel).toBeCloseTo(0.015);
  expect(progress).toHaveBeenLastCalledWith(1);
  expect(video.getAttribute('src')).toBeNull();
});
it('stops instead of extending a trajectory through missing pixels', async () => {
  blankAfter = 0.2;
  const result = await trackBar(
    source,
    seed,
    new AbortController().signal,
    vi.fn(),
  );
  expect(result.stoppedEarly).toBe(true);
  expect(result.end).toBeLessThan(0.2);
});
it('rejects invalid calibration, missing context and textureless selection', async () => {
  await expect(
    trackBar(
      source,
      { ...seed, diameterCm: 0 },
      new AbortController().signal,
      vi.fn(),
    ),
  ).rejects.toThrow('diameter');
  contextUnavailable = true;
  await expect(
    trackBar(source, seed, new AbortController().signal, vi.fn()),
  ).rejects.toThrow('decoding');
  contextUnavailable = false;
  blankAfter = 0;
  await expect(
    trackBar(source, seed, new AbortController().signal, vi.fn()),
  ).rejects.toThrow('visible detail');
});
it('cancels before start and between frames without retaining video', async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(
    trackBar(source, seed, controller.signal, vi.fn()),
  ).rejects.toMatchObject({ name: 'AbortError' });
  const running = new AbortController();
  await expect(
    trackBar(source, seed, running.signal, () => running.abort()),
  ).rejects.toMatchObject({ name: 'AbortError' });
  expect(video.getAttribute('src')).toBeNull();
});
