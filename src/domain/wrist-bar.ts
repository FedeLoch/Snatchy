import { visible, type VisionAnalysis, type PoseSample } from './vision';
import { barTrace, MOTION } from './snatch-motion';

/** Smooth only presentation; preserve endpoints and never bridge missing samples. */
export function smoothWristPath(
  points: { time: number; x: number; y: number }[],
  sampleRate: number,
) {
  return points.map((p, i) => {
    const before = points[i - 1],
      after = points[i + 1];
    if (
      !before ||
      !after ||
      p.time - before.time > 2.1 / sampleRate ||
      after.time - p.time > 2.1 / sampleRate
    )
      return p;
    return {
      ...p,
      x: (before.x + p.x + after.x) / 3,
      y: (before.y + p.y + after.y) / 3,
    };
  });
}

export interface WristBarPoint {
  time: number;
  left: { x: number; y: number };
  right: { x: number; y: number };
  x: number;
  y: number;
}
export interface WristBar {
  method: 'wrist-midpoint' | 'hand-midpoint';
  width: number;
  height: number;
  coverage: number;
  points: WristBarPoint[];
}
/** Palm-center proxy from wrist, index and pinky landmarks, not bar detection.
 * Require both visible hands; never silently replace an obscured hand with a wrist.
 */
export function handBarPoint(
  f: PoseSample,
  width: number,
  height: number,
): WristBarPoint | null {
  if (f.people !== 1) return null;
  const center = (ids: number[]) => {
    const points = ids.map((i) => f.landmarks[i]);
    if (!points.every(visible)) return null;
    return {
      x: points.reduce((sum, p) => sum + p.x * width, 0) / points.length,
      y: points.reduce((sum, p) => sum + p.y * height, 0) / points.length,
    };
  };
  const left = center([15, 17, 19]),
    right = center([16, 18, 20]);
  if (!left || !right) return null;
  return {
    time: f.time,
    left,
    right,
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2,
  };
}
export function estimateWristBar(a: VisionAnalysis): WristBar {
  const points = a.frames
    .map((f) => handBarPoint(f, a.width, a.height))
    .filter((p): p is WristBarPoint => p !== null);
  return {
    method: 'hand-midpoint',
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
/** The illustration's idealised bar path, scaled and aligned onto the measured track. */
export function barReference(t: WristBar): { x: number[]; y: number[] } | null {
  if (t.points.length < 3) return null;
  const ref = barTrace(MOTION.duration);
  const rx = ref.map((p) => p[0]),
    ry = ref.map((p) => p[1]);
  const px = t.points.map((p) => p.x),
    py = t.points.map((p) => p.y);
  const xMin = Math.min(...rx),
    xMax = Math.max(...rx),
    xSpan = Math.max(1, xMax - xMin);
  const yMin = Math.min(...ry),
    yMax = Math.max(...ry),
    ySpan = Math.max(1, yMax - yMin);
  const pXMin = Math.min(...px),
    pXSpan = Math.max(1, Math.max(...px) - pXMin);
  const pYMin = Math.min(...py),
    pYSpan = Math.max(1, Math.max(...py) - pYMin);
  return {
    x: ref.map((p) => pXMin + ((p[0] - xMin) / xSpan) * pXSpan),
    y: ref.map((p) => pYMin + ((p[1] - yMin) / ySpan) * pYSpan),
  };
}
/** Largest horizontal gap between the measured path and the aligned reference, as % frame width. */
export function wristDrift(
  t: WristBar,
  reference: { x: number[]; y: number[] } | null,
): number | null {
  if (!reference || t.points.length < 3) return null;
  const n = t.points.length;
  let max = 0;
  for (let i = 0; i < n; i++) {
    const k = Math.min(
      reference.x.length - 1,
      Math.round((i / Math.max(1, n - 1)) * (reference.x.length - 1)),
    );
    max = Math.max(max, Math.abs(t.points[i].x - reference.x[k]));
  }
  return (max / t.width) * 100;
}
