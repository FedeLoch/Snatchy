import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  MAX_VIDEO_BYTES,
  prepareVideo,
  releaseVideo,
  validateVideo,
} from '../../src/services/media';
let video: HTMLVideoElement;
beforeEach(() => {
  vi.useFakeTimers();
  video = document.createElement('video');
  vi.spyOn(document, 'createElement').mockReturnValue(video);
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  vi.stubGlobal(
    'URL',
    Object.assign(URL, {
      createObjectURL: vi.fn(() => 'blob:local-video'),
      revokeObjectURL: vi.fn(),
    }),
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const file = () => new File(['video'], 'lift.mp4', { type: 'video/mp4' });
it('validates video type, empty files and maximum size', () => {
  expect(validateVideo({ type: 'text/plain', size: 3 })).toContain(
    'video file',
  );
  expect(validateVideo({ type: 'video/mp4', size: 0 })).toContain('empty');
  expect(
    validateVideo({ type: 'video/mp4', size: MAX_VIDEO_BYTES + 1 }),
  ).toContain('250 MB');
  expect(validateVideo({ type: 'video/mp4', size: MAX_VIDEO_BYTES })).toBe('');
});
it('validates before allocating a URL', async () => {
  await expect(
    prepareVideo(new File(['x'], 'x.txt', { type: 'text/plain' })),
  ).rejects.toThrow('video file');
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});
it('loads metadata and returns local media without leaking the decoder', async () => {
  const promise = prepareVideo(file());
  Object.defineProperty(video, 'duration', { value: 3.6 });
  video.dispatchEvent(new Event('loadedmetadata'));
  expect(await promise).toEqual({
    url: 'blob:local-video',
    name: 'lift.mp4',
    duration: 3.6,
  });
  expect(video.getAttribute('src')).toBeNull();
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});
it.each([0, Infinity, NaN])(
  'rejects unplayable duration %s and releases the URL',
  async (duration) => {
    const promise = prepareVideo(file());
    const assertion = expect(promise).rejects.toThrow('duration');
    Object.defineProperty(video, 'duration', { value: duration });
    video.dispatchEvent(new Event('loadedmetadata'));
    await assertion;
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local-video');
  },
);
it('handles decoder errors', async () => {
  const promise = prepareVideo(file());
  const assertion = expect(promise).rejects.toThrow('cannot play');
  video.dispatchEvent(new Event('error'));
  await assertion;
  expect(URL.revokeObjectURL).toHaveBeenCalled();
});
it('times out metadata and releases resources', async () => {
  const promise = prepareVideo(file());
  const assertion = expect(promise).rejects.toThrow('too long');
  await vi.advanceTimersByTimeAsync(10000);
  await assertion;
  expect(URL.revokeObjectURL).toHaveBeenCalled();
});
it('cancels pending metadata', async () => {
  const controller = new AbortController();
  const promise = prepareVideo(file(), controller.signal);
  const assertion = expect(promise).rejects.toMatchObject({
    name: 'AbortError',
  });
  controller.abort();
  await assertion;
  expect(vi.getTimerCount()).toBe(0);
  expect(URL.revokeObjectURL).toHaveBeenCalled();
});
it('does not allocate for an already aborted request', async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(prepareVideo(file(), controller.signal)).rejects.toMatchObject({
    name: 'AbortError',
  });
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});
it('releases a video safely', () => {
  releaseVideo(null);
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  releaseVideo({ url: 'blob:test', name: 'x', duration: 1 });
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
});
