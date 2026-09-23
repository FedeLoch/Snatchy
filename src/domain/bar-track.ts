export interface BarPoint {
  time: number;
  x: number;
  y: number;
  confidence: number;
}
export interface BarTrack {
  version: 1;
  method: 'seeded-template';
  points: BarPoint[];
  width: number;
  height: number;
  metersPerPixel: number;
  diameterCm: number;
  start: number;
  end: number;
  requestedEnd: number;
  reviewed: boolean;
  stoppedEarly: boolean;
}
export interface GrayFrame {
  width: number;
  height: number;
  pixels: Float32Array;
}
export function grayscale(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): GrayFrame {
  const pixels = new Float32Array(width * height);
  for (let i = 0; i < pixels.length; i++)
    pixels[i] =
      (rgba[i * 4] * 0.299 +
        rgba[i * 4 + 1] * 0.587 +
        rgba[i * 4 + 2] * 0.114) /
      255;
  return { width, height, pixels };
}
function patch(
  frame: GrayFrame,
  x: number,
  y: number,
  radius: number,
): number[] | null {
  if (
    x - radius < 0 ||
    y - radius < 0 ||
    x + radius >= frame.width ||
    y + radius >= frame.height
  )
    return null;
  const values: number[] = [];
  for (let j = -5; j <= 5; j++)
    for (let i = -5; i <= 5; i++)
      values.push(
        frame.pixels[
          Math.round(y + (j * radius) / 5) * frame.width +
            Math.round(x + (i * radius) / 5)
        ],
      );
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const centered = values.map((v) => v - mean),
    norm = Math.hypot(...centered);
  return norm > 0.08 ? centered.map((v) => v / norm) : null;
}
export function createTemplate(
  frame: GrayFrame,
  x: number,
  y: number,
  radius: number,
): number[] {
  const template = patch(frame, x, y, radius);
  if (!template)
    throw new Error(
      'The selected plate has too little visible detail or is cut off. Choose a clear, textured plate with space around it.',
    );
  return template;
}
export function matchTemplate(
  frame: GrayFrame,
  template: number[],
  x: number,
  y: number,
  radius: number,
  search = 36,
): { x: number; y: number; confidence: number } | null {
  let best = { x, y, confidence: -1 };
  const candidates: { x: number; y: number; confidence: number }[] = [];
  for (let dy = -search; dy <= search; dy++)
    for (let dx = -search; dx <= search; dx++) {
      const values = patch(frame, x + dx, y + dy, radius);
      if (!values) continue;
      const confidence = values.reduce((sum, v, i) => sum + v * template[i], 0);
      const candidate = { x: x + dx, y: y + dy, confidence };
      candidates.push(candidate);
      if (confidence > best.confidence) best = candidate;
    }
  const coarse = best;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const values = patch(frame, coarse.x + dx, coarse.y + dy, radius);
      if (!values) continue;
      const confidence = values.reduce((sum, v, i) => sum + v * template[i], 0);
      if (confidence > best.confidence)
        best = { x: coarse.x + dx, y: coarse.y + dy, confidence };
    }
  const rival = candidates
    .filter((c) => Math.hypot(c.x - best.x, c.y - best.y) > Math.max(5, radius))
    .reduce((max, c) => Math.max(max, c.confidence), -1);
  return best.confidence >= 0.8 && best.confidence - rival >= 0.04
    ? best
    : null;
}
export function barMetrics(track: BarTrack): {
  horizontalCm: number;
  verticalM: number;
  peakVelocity: number | null;
} | null {
  if (
    !track.reviewed ||
    track.points.length < 3 ||
    !Number.isFinite(track.metersPerPixel) ||
    track.metersPerPixel <= 0
  )
    return null;
  const first = track.points[0];
  const horizontalCm =
    Math.max(...track.points.map((p) => Math.abs(p.x - first.x))) *
    track.metersPerPixel *
    100;
  const verticalM =
    Math.max(0, ...track.points.map((p) => first.y - p.y)) *
    track.metersPerPixel;
  let peakVelocity: number | null = null;
  // Central differences span two intervals; do not bridge gaps or call sparse differences instantaneous velocity.
  for (let i = 1; i < track.points.length - 1; i++) {
    const before = track.points[i - 1],
      after = track.points[i + 1],
      dt = after.time - before.time;
    if (dt <= 0 || dt > 0.2) continue;
    peakVelocity = Math.max(
      peakVelocity ?? 0,
      ((before.y - after.y) * track.metersPerPixel) / dt,
    );
  }
  return { horizontalCm, verticalM, peakVelocity };
}
