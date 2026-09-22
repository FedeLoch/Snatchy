import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiftPlayer } from '../../src/ui/player';
let players: LiftPlayer[] = [];
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});
afterEach(() => {
  players.forEach((p) => p.dispose());
  players = [];
  vi.restoreAllMocks();
  vi.useRealTimers();
});
function create(duration = 3.6, video: HTMLVideoElement | null = null) {
  const change = vi.fn();
  const player = new LiftPlayer(duration, change, video);
  players.push(player);
  return { player, change };
}
it('seeks, clamps and cycles playback speeds', () => {
  const { player } = create();
  player.seek(99);
  expect(player.state.time).toBe(3.6);
  player.seek(-1);
  expect(player.state.time).toBe(0);
  player.setSpeed();
  expect(player.state.speed).toBe(1);
  player.setSpeed();
  expect(player.state.speed).toBe(0.25);
  player.setSpeed();
  expect(player.state.speed).toBe(0.5);
});
it('advances and pauses without duplicate animation loops', async () => {
  const { player } = create();
  await player.play();
  await player.play();
  await vi.advanceTimersByTimeAsync(1000);
  expect(player.state.time).toBeGreaterThan(0.4);
  expect(player.state.time).toBeLessThan(0.6);
  player.pause();
  const time = player.state.time;
  await vi.advanceTimersByTimeAsync(1000);
  expect(player.state.time).toBe(time);
});
it('stops at the end and restarts from the beginning', async () => {
  const { player } = create(0.1);
  await player.play();
  await vi.advanceTimersByTimeAsync(500);
  expect(player.state.playing).toBe(false);
  expect(player.state.time).toBe(0.1);
  await player.play();
  expect(player.state.time).toBe(0);
});
it('loops around a selected moment and can disable it', async () => {
  const { player } = create();
  player.setLoop(1.34);
  await player.play();
  await vi.advanceTimersByTimeAsync(4000);
  expect(player.state.time).toBeGreaterThanOrEqual(0.94);
  expect(player.state.time).toBeLessThan(1.74);
  player.setLoop(null);
  expect(player.state.loopTime).toBeNull();
});
it('syncs media seeking and playback speed', async () => {
  const video = document.createElement('video');
  Object.defineProperty(video, 'readyState', { value: 1 });
  vi.spyOn(video, 'play').mockResolvedValue();
  const { player } = create(5, video);
  player.seek(2);
  expect(video.currentTime).toBe(2);
  player.setSpeed();
  expect(video.playbackRate).toBe(1);
  await player.play();
  video.currentTime = 3;
  await vi.advanceTimersByTimeAsync(20);
  expect(player.state.time).toBe(3);
  video.dispatchEvent(new Event('ended'));
  expect(player.state.playing).toBe(false);
});
it('handles rejected video playback', async () => {
  const video = document.createElement('video');
  vi.spyOn(video, 'play').mockRejectedValue(Error('blocked'));
  const { player } = create(5, video);
  await player.play();
  expect(player.state.playing).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});
it('cannot restart after disposal while media play is pending', async () => {
  let resolve!: () => void;
  const video = document.createElement('video');
  vi.spyOn(video, 'play').mockReturnValue(
    new Promise<void>((r) => (resolve = r)),
  );
  const { player } = create(5, video);
  const play = player.play();
  player.dispose();
  resolve();
  await play;
  expect(player.state.playing).toBe(false);
  await player.play();
  expect(vi.getTimerCount()).toBe(0);
});
it('handles a pause before pending play resolves', async () => {
  let resolve!: () => void;
  const video = document.createElement('video');
  vi.spyOn(video, 'play').mockReturnValue(
    new Promise<void>((r) => (resolve = r)),
  );
  const { player } = create(5, video);
  const play = player.play();
  player.pause();
  resolve();
  await play;
  expect(player.state.playing).toBe(false);
});
it('restarts a media loop after an ended event', async () => {
  const video = document.createElement('video');
  Object.defineProperty(video, 'readyState', { value: 1 });
  vi.spyOn(video, 'play').mockResolvedValue();
  const { player } = create(2, video);
  player.setLoop(1.8);
  video.dispatchEvent(new Event('ended'));
  await Promise.resolve();
  expect(video.currentTime).toBeCloseTo(1.4);
  expect(player.state.playing).toBe(true);
});

it('pauses instead of restarting a failed media loop', async () => {
  const video = document.createElement('video');
  vi.spyOn(video, 'play').mockResolvedValue();
  const { player } = create(2, video);
  player.setLoop(1);
  await player.play();
  video.dispatchEvent(new Event('error'));
  expect(player.state.playing).toBe(false);
  expect(video.play).toHaveBeenCalledTimes(1);
});
