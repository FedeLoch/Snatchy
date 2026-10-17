import { formatNumber, t } from '../i18n';

/** The parts of a media element that result playback relies on. */
export interface MediaLike extends EventTarget {
  currentTime: number;
  readonly paused: boolean;
  playbackRate: number;
  pause(): void;
  scrollIntoView(options?: ScrollIntoViewOptions): void;
}

/** A video-like clock for replaying a saved skeleton without its footage.
 * It emits the same events as a video (loadedmetadata, play, pause, seeked,
 * timeupdate), so the overlay and its controls work unchanged. */
export class SkeletonClock extends EventTarget implements MediaLike {
  playbackRate = 1;
  #time: number;
  #paused = true;
  #raf = 0;
  #last = 0;
  constructor(
    private readonly stage: HTMLElement,
    readonly start: number,
    readonly end: number,
  ) {
    super();
    this.#time = start;
    queueMicrotask(() => this.dispatchEvent(new Event('loadedmetadata')));
  }
  get currentTime(): number {
    return this.#time;
  }
  set currentTime(value: number) {
    this.#time = Math.max(this.start, Math.min(this.end, value));
    queueMicrotask(() => {
      this.dispatchEvent(new Event('seeked'));
      this.dispatchEvent(new Event('timeupdate'));
    });
  }
  get paused(): boolean {
    return this.#paused;
  }
  play(): void {
    if (!this.#paused) return;
    if (this.#time >= this.end - 1e-3) this.#time = this.start;
    this.#paused = false;
    this.#last = performance.now();
    this.dispatchEvent(new Event('play'));
    const step = (now: number) => {
      if (this.#paused) return;
      this.#time = Math.min(
        this.end,
        this.#time + ((now - this.#last) / 1000) * this.playbackRate,
      );
      this.#last = now;
      this.dispatchEvent(new Event('timeupdate'));
      if (this.#time >= this.end) this.pause();
      else this.#raf = requestAnimationFrame(step);
    };
    this.#raf = requestAnimationFrame(step);
  }
  pause(): void {
    if (this.#paused) return;
    this.#paused = true;
    cancelAnimationFrame(this.#raf);
    this.dispatchEvent(new Event('pause'));
  }
  scrollIntoView(options?: ScrollIntoViewOptions): void {
    this.stage.scrollIntoView(options);
  }
}

/** Play/pause button, scrubber and time readout for a skeleton replay. */
export function bindSkeletonControls(
  root: HTMLElement,
  clock: SkeletonClock,
): () => void {
  const button = root.querySelector<HTMLButtonElement>('#sk-play'),
    scrub = root.querySelector<HTMLInputElement>('#sk-scrub'),
    label = root.querySelector<HTMLElement>('#sk-time');
  const sync = () => {
    if (scrub) scrub.value = String(clock.currentTime);
    if (label) label.textContent = `${formatNumber(clock.currentTime, 2)} s`;
  };
  const state = () => {
    if (!button) return;
    button.textContent = t(clock.paused ? 'vision.play' : 'vision.pause');
    button.setAttribute('aria-pressed', String(!clock.paused));
  };
  const toggle = () => (clock.paused ? clock.play() : clock.pause());
  const seek = () => {
    clock.pause();
    clock.currentTime = Number(scrub!.value);
  };
  button?.addEventListener('click', toggle);
  scrub?.addEventListener('input', seek);
  clock.addEventListener('timeupdate', sync);
  clock.addEventListener('seeked', sync);
  clock.addEventListener('play', state);
  clock.addEventListener('pause', state);
  sync();
  return () => {
    clock.pause();
    button?.removeEventListener('click', toggle);
    scrub?.removeEventListener('input', seek);
    clock.removeEventListener('timeupdate', sync);
    clock.removeEventListener('seeked', sync);
    clock.removeEventListener('play', state);
    clock.removeEventListener('pause', state);
  };
}
