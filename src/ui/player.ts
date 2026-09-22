import { clampTime, loopWindow } from '../domain/analysis';
export interface PlayerState {
  time: number;
  duration: number;
  playing: boolean;
  speed: number;
  loopTime: number | null;
}
export class LiftPlayer {
  state: PlayerState;
  private frame = 0;
  private last = 0;
  private generation = 0;
  private disposed = false;
  constructor(
    duration: number,
    private change: (state: PlayerState) => void,
    private video: HTMLVideoElement | null = null,
  ) {
    this.state = {
      time: 0,
      duration,
      playing: false,
      speed: 0.5,
      loopTime: null,
    };
    if (video) {
      video.addEventListener('ended', this.onEnded);
      video.addEventListener('error', this.onError);
    }
  }
  private onError = () => this.pause();
  private onEnded = () => {
    this.state.playing = false;
    cancelAnimationFrame(this.frame);
    if (this.state.loopTime !== null) {
      this.seek(loopWindow(this.state.loopTime, this.state.duration)[0]);
      void this.play();
    } else this.pause();
  };
  seek(value: number) {
    this.state.time = clampTime(value, this.state.duration);
    if (this.video && this.video.readyState > 0)
      this.video.currentTime = this.state.time;
    this.emit();
  }
  setSpeed() {
    this.state.speed =
      this.state.speed === 0.5 ? 1 : this.state.speed === 1 ? 0.25 : 0.5;
    if (this.video) this.video.playbackRate = this.state.speed;
    this.emit();
  }
  setLoop(time: number | null) {
    this.state.loopTime =
      time === null ? null : clampTime(time, this.state.duration);
    this.emit();
  }
  async play() {
    if (this.disposed || this.state.playing) return;
    const generation = ++this.generation;
    if (this.state.time >= this.state.duration - 0.01) this.seek(0);
    if (this.video) {
      this.video.playbackRate = this.state.speed;
      try {
        await this.video.play();
      } catch {
        if (generation === this.generation) this.pause();
        return;
      }
    }
    if (this.disposed || generation !== this.generation) {
      this.video?.pause();
      return;
    }
    this.state.playing = true;
    this.last = performance.now();
    this.emit();
    this.frame = requestAnimationFrame(this.tick);
  }
  pause() {
    this.generation++;
    this.state.playing = false;
    cancelAnimationFrame(this.frame);
    this.video?.pause();
    this.emit();
  }
  private tick = (now: number) => {
    if (!this.state.playing || this.disposed) return;
    this.state.time = this.video
      ? this.video.currentTime
      : clampTime(
          this.state.time +
            Math.min((now - this.last) / 1000, 0.1) * this.state.speed,
          this.state.duration,
        );
    this.last = now;
    if (this.state.loopTime !== null) {
      const [start, end] = loopWindow(this.state.loopTime, this.state.duration);
      if (this.state.time >= end || this.state.time < start) this.seek(start);
    } else if (this.state.time >= this.state.duration) this.pause();
    this.emit();
    if (this.state.playing) this.frame = requestAnimationFrame(this.tick);
  };
  private emit() {
    if (!this.disposed) this.change({ ...this.state });
  }
  dispose() {
    this.pause();
    this.disposed = true;
    if (this.video) {
      this.video.removeEventListener('ended', this.onEnded);
      this.video.removeEventListener('error', this.onError);
    }
  }
}
