import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { analyzeVideo, seekVideoFrame } from '../../src/services/vision';
let video: HTMLVideoElement,
  mode = 'ok',
  decoded = true,
  controller: AbortController;
let workers: FakeWorker[] = [];
class FakeWorker extends EventTarget {
  terminate = vi.fn();
  constructor() {
    super();
    workers.push(this);
  }
  postMessage(message: { id: number; type: string }) {
    queueMicrotask(() => {
      if (mode === 'hang') return;
      if (mode === 'crash') {
        this.dispatchEvent(new Event('error'));
        return;
      }
      this.dispatchEvent(new MessageEvent('message', { data: { id: -1 } }));
      this.dispatchEvent(
        new MessageEvent('message', {
          data:
            mode === 'error'
              ? { id: message.id, error: 'Model unavailable' }
              : { id: message.id, people: 0, landmarks: [] },
        }),
      );
    });
  }
}
const source = { url: 'blob:video', name: 'clip.mp4', duration: 1 };
beforeEach(() => {
  vi.useFakeTimers();
  mode = 'ok';
  decoded = true;
  workers = [];
  controller = new AbortController();
  video = document.createElement('video');
  Object.defineProperty(video, 'videoWidth', {
    value: 640,
    configurable: true,
  });
  Object.defineProperty(video, 'videoHeight', { value: 480 });
  let currentTime = 0;
  Object.defineProperty(video, 'currentTime', {
    get: () => currentTime,
    set: (value) => {
      currentTime = value;
      queueMicrotask(() => video.dispatchEvent(new Event('seeked')));
    },
  });
  const create = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) =>
    tag === 'video' ? video : create(tag)) as typeof document.createElement);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {
    if (video.hasAttribute('src') && decoded)
      queueMicrotask(() => video.dispatchEvent(new Event('loadeddata')));
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.stubGlobal('Worker', FakeWorker);
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({ close: vi.fn() })),
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it('decodes and samples the source duration, returns measured failure for blank frames and cleans resources', async () => {
  const progress = vi.fn();
  const result = await analyzeVideo(source, {
    signal: controller.signal,
    onProgress: progress,
  });
  expect(result.frames).toHaveLength(15);
  expect(result.status).toBe('insufficient');
  expect(result.simulated).toBe(false);
  expect(result.frames[14].time).toBeCloseTo(14 / 15);
  expect(workers[0].terminate).toHaveBeenCalled();
  expect(video.getAttribute('src')).toBeNull();
  expect(progress).toHaveBeenLastCalledWith(1, 'Analysis complete');
});
it.each([0.1, 121])(
  'rejects unsupported duration %s without starting a worker',
  async (duration) => {
    await expect(
      analyzeVideo(
        { ...source, duration },
        { signal: controller.signal, onProgress: vi.fn() },
      ),
    ).rejects.toThrow();
    expect(workers).toHaveLength(0);
  },
);
it('propagates model errors and worker crashes without fake results', async () => {
  for (const value of ['error', 'crash']) {
    mode = value;
    await expect(
      analyzeVideo(source, { signal: controller.signal, onProgress: vi.fn() }),
    ).rejects.toThrow();
    expect(workers.at(-1)?.terminate).toHaveBeenCalled();
  }
});
it('aborts before inference and while a frame request is in flight', async () => {
  controller.abort();
  await expect(
    analyzeVideo(source, { signal: controller.signal, onProgress: vi.fn() }),
  ).rejects.toMatchObject({ name: 'AbortError' });
  controller = new AbortController();
  mode = 'hang';
  const promise = analyzeVideo(source, {
    signal: controller.signal,
    onProgress: vi.fn(),
  });
  const assertion = expect(promise).rejects.toMatchObject({
    name: 'AbortError',
  });
  controller.abort();
  await assertion;
  expect(workers[0].terminate).toHaveBeenCalled();
});
it('times out a stuck worker', async () => {
  mode = 'hang';
  const promise = analyzeVideo(source, {
    signal: controller.signal,
    onProgress: vi.fn(),
  });
  const assertion = expect(promise).rejects.toThrow('timed out');
  await vi.advanceTimersByTimeAsync(45000);
  await assertion;
  expect(workers[0].terminate).toHaveBeenCalled();
});
it('times out a decoder and handles a decoder error', async () => {
  decoded = false;
  let promise = analyzeVideo(source, {
    signal: controller.signal,
    onProgress: vi.fn(),
  });
  let assertion = expect(promise).rejects.toThrow('decoding timed out');
  await vi.advanceTimersByTimeAsync(15000);
  await assertion;
  promise = analyzeVideo(source, {
    signal: controller.signal,
    onProgress: vi.fn(),
  });
  assertion = expect(promise).rejects.toThrow('decoded');
  await vi.advanceTimersByTimeAsync(0);
  video.dispatchEvent(new Event('error'));
  await assertion;
});
it('aborts during decode and closes a bitmap if cancelled before transferring it', async () => {
  decoded = false;
  let promise = analyzeVideo(source, {
    signal: controller.signal,
    onProgress: vi.fn(),
  });
  let assertion = expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  await vi.advanceTimersByTimeAsync(0);
  controller.abort();
  await assertion;
  decoded = true;
  controller = new AbortController();
  const close = vi.fn();
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => {
      controller.abort();
      return { close };
    }),
  );
  promise = analyzeVideo(source, {
    signal: controller.signal,
    onProgress: vi.fn(),
  });
  assertion = expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  await assertion;
  expect(close).toHaveBeenCalled();
});
it('rejects missing dimensions and unavailable frame context', async () => {
  Object.defineProperty(video, 'videoWidth', { value: 0, configurable: true });
  await expect(
    analyzeVideo(source, { signal: controller.signal, onProgress: vi.fn() }),
  ).rejects.toThrow('dimensions');
});

it('waits for frame presentation, bounds missing callbacks, and cancels cleanly', async () => {
  let callback: VideoFrameRequestCallback | undefined;
  const cancel = vi.fn();
  Object.defineProperty(video, 'requestVideoFrameCallback', {
    value: vi.fn((fn: VideoFrameRequestCallback) => {
      callback = fn;
      return 7;
    }),
    configurable: true,
  });
  Object.defineProperty(video, 'cancelVideoFrameCallback', {
    value: cancel,
    configurable: true,
  });
  let ready = false;
  const first = seekVideoFrame(video, 0.5, controller.signal).then(() => {
    ready = true;
  });
  await vi.advanceTimersByTimeAsync(10);
  expect(ready).toBe(false);
  callback!(0, {} as VideoFrameCallbackMetadata);
  await first;
  expect(cancel).toHaveBeenCalledWith(7);
  const fallback = seekVideoFrame(video, 0.6, controller.signal);
  await vi.advanceTimersByTimeAsync(100);
  await fallback;
  const aborted = seekVideoFrame(video, 0.7, controller.signal);
  const assertion = expect(aborted).rejects.toMatchObject({
    name: 'AbortError',
  });
  await vi.advanceTimersByTimeAsync(0);
  controller.abort();
  await assertion;
});
