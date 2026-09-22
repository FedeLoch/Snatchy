import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { demoProvider } from '../../src/services/analysis-provider';
import { isAnalysis } from '../../src/domain/analysis';
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
it('reports each step and returns an independent result', async () => {
  const onProgress = vi.fn();
  const controller = new AbortController();
  const result = demoProvider.analyze('snatch', {
    signal: controller.signal,
    onProgress,
  });
  await vi.runAllTimersAsync();
  const analysis = await result;
  expect(isAnalysis(analysis)).toBe(true);
  expect(onProgress.mock.calls.map((c) => c[0])).toEqual([0, 1, 2, 3]);
  analysis.score = 1;
  const next = demoProvider.analyze('snatch', {
    signal: controller.signal,
    onProgress,
  });
  await vi.runAllTimersAsync();
  expect((await next).score).toBe(83);
});
it('cancels during processing without publishing a result', async () => {
  const controller = new AbortController();
  const promise = demoProvider.analyze('snatch', {
    signal: controller.signal,
    onProgress: vi.fn(),
  });
  const rejection = expect(promise).rejects.toMatchObject({
    name: 'AbortError',
  });
  controller.abort();
  await rejection;
  expect(vi.getTimerCount()).toBe(0);
});
it('rejects an already cancelled request', async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(
    demoProvider.analyze('snatch', {
      signal: controller.signal,
      onProgress: vi.fn(),
    }),
  ).rejects.toMatchObject({ name: 'AbortError' });
});
it('does not send planned movements through Snatch analysis', async () => {
  await expect(
    demoProvider.analyze('clean', {
      signal: new AbortController().signal,
      onProgress: vi.fn(),
    }),
  ).rejects.toThrow('not available');
});
