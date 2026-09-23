import {
  createTemplate,
  matchTemplate,
  type GrayFrame,
  type BarPoint,
} from './bar-track';
import { visible, type PoseSample } from './vision';
export interface AutomaticBar {
  method: 'circle-template';
  width: number;
  height: number;
  radius: number;
  points: BarPoint[];
  stoppedEarly: boolean;
}
interface Circle {
  x: number;
  y: number;
  radius: number;
  confidence: number;
}
const directions = Array.from({ length: 24 }, (_, i) => [
  Math.cos((i * Math.PI) / 12),
  Math.sin((i * Math.PI) / 12),
]);
/** A conservative circular-edge proposal near the hands, not a trained object classifier. */
export function detectPlate(frame: GrayFrame, pose: PoseSample): Circle | null {
  if (pose.people !== 1) return null;
  const hands = [pose.landmarks[15], pose.landmarks[16]].filter(visible);
  if (!hands.length) return null;
  const candidates: Circle[] = [];
  const read = (x: number, y: number) =>
    frame.pixels[Math.round(y) * frame.width + Math.round(x)];
  for (let y = 8; y < frame.height - 8; y += 3) {
    for (let x = 8; x < frame.width - 8; x += 3) {
      if (
        !hands.some(
          (h) =>
            Math.abs(h.x * frame.width - x) < frame.width * 0.2 &&
            Math.abs(h.y * frame.height - y) < frame.height * 0.12,
        )
      )
        continue;
      for (
        let radius = 8;
        radius <= Math.min(48, frame.height * 0.22);
        radius += 2
      ) {
        if (
          x - radius - 3 < 0 ||
          y - radius - 3 < 0 ||
          x + radius + 3 >= frame.width ||
          y + radius + 3 >= frame.height
        )
          continue;
        const differences = directions.map(
          ([dx, dy]) =>
            read(x + dx * (radius - 2), y + dy * (radius - 2)) -
            read(x + dx * (radius + 2), y + dy * (radius + 2)),
        );
        const positive = differences.filter((d) => d > 0.12).length;
        const negative = differences.filter((d) => d < -0.12).length;
        const confidence = Math.max(positive, negative) / directions.length;
        if (confidence >= 0.875) candidates.push({ x, y, radius, confidence });
      }
    }
  }
  candidates.sort((a, b) => b.confidence - a.confidence);
  const best = candidates[0];
  if (
    !best ||
    candidates.some(
      (c) =>
        Math.hypot(c.x - best.x, c.y - best.y) > best.radius &&
        c.confidence >= best.confidence - 0.05,
    )
  )
    return null;
  return best;
}
export class AutomaticBarTracker {
  private track: AutomaticBar | null = null;
  private template: number[] | null = null;
  private stopped = false;
  push(frame: GrayFrame, pose: PoseSample) {
    if (this.stopped) return;
    if (!this.track) {
      const circle = detectPlate(frame, pose);
      if (!circle) return;
      this.template = createTemplate(frame, circle.x, circle.y, circle.radius);
      this.track = {
        method: 'circle-template',
        width: frame.width,
        height: frame.height,
        radius: circle.radius,
        points: [
          {
            time: pose.time,
            x: circle.x,
            y: circle.y,
            confidence: circle.confidence,
          },
        ],
        stoppedEarly: false,
      };
      return;
    }
    const previous = this.track.points.at(-1)!;
    const match =
      pose.time - previous.time <= 0.2
        ? matchTemplate(
            frame,
            this.template!,
            previous.x,
            previous.y,
            this.track.radius,
          )
        : null;
    const hands = [pose.landmarks[15], pose.landmarks[16]].filter(visible);
    if (
      !match ||
      pose.people !== 1 ||
      !hands.some(
        (h) =>
          Math.abs(h.x * frame.width - match.x) < frame.width * 0.25 &&
          Math.abs(h.y * frame.height - match.y) < frame.height * 0.18,
      )
    ) {
      this.track.stoppedEarly = true;
      this.stopped = true;
      return;
    }
    this.track.points.push({ ...match, time: pose.time });
  }
  result(): AutomaticBar | undefined {
    const t = this.track;
    if (
      !t ||
      t.points.length < 6 ||
      Math.max(...t.points.map((p) => t.points[0].y - p.y)) < t.radius / 2
    )
      return undefined;
    return t;
  }
}
export function relativeBarMetrics(t: AutomaticBar) {
  const first = t.points[0];
  return {
    horizontal:
      (Math.max(...t.points.map((p) => Math.abs(p.x - first.x))) / t.width) *
      100,
    rise: (Math.max(0, ...t.points.map((p) => first.y - p.y)) / t.height) * 100,
  };
}
