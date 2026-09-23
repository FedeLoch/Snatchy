import { visible, type VisionAnalysis } from './vision';
export interface WristBarPoint {
  time: number;
  left: { x: number; y: number };
  right: { x: number; y: number };
  x: number;
  y: number;
}
export interface WristBar {
  method: 'wrist-midpoint';
  width: number;
  height: number;
  coverage: number;
  points: WristBarPoint[];
}
export function estimateWristBar(a: VisionAnalysis): WristBar {
  const points = a.frames
    .filter(
      (f) =>
        f.people === 1 && visible(f.landmarks[15]) && visible(f.landmarks[16]),
    )
    .map((f) => {
      const left = {
          x: f.landmarks[15].x * a.width,
          y: f.landmarks[15].y * a.height,
        },
        right = {
          x: f.landmarks[16].x * a.width,
          y: f.landmarks[16].y * a.height,
        };
      return {
        time: f.time,
        left,
        right,
        x: (left.x + right.x) / 2,
        y: (left.y + right.y) / 2,
      };
    });
  return {
    method: 'wrist-midpoint',
    width: a.width,
    height: a.height,
    coverage: a.frames.length ? points.length / a.frames.length : 0,
    points,
  };
}
export function wristMetrics(t: WristBar) {
  if (t.points.length < 3) return null;
  const first = t.points[0];
  let velocity: number | null = null;
  for (let i = 1; i < t.points.length - 1; i++) {
    const p = t.points[i - 1],
      q = t.points[i + 1],
      dt = q.time - p.time;
    if (dt > 0 && dt <= 0.2)
      velocity = Math.max(velocity ?? 0, ((p.y - q.y) / dt / t.height) * 100);
  }
  return {
    horizontal:
      (Math.max(...t.points.map((p) => Math.abs(p.x - first.x))) / t.width) *
      100,
    rise: (Math.max(0, ...t.points.map((p) => first.y - p.y)) / t.height) * 100,
    velocity,
  };
}
