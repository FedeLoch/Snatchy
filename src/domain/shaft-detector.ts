import type { GrayFrame } from './bar-track';
import type { PoseSample } from './vision';
import { handBarPoint, type WristBarPoint } from './wrist-bar';

/** Paired-edge shaft candidate near the grip. Hands constrain the search only;
 * the line's position comes from contrasting pixels on both sides of a ridge.
 * Returns normalized coordinates, or nothing for ambiguous/occluded evidence.
 */
export function detectBarShaft(
  frame: GrayFrame,
  pose: PoseSample,
): WristBarPoint | null {
  const hands = handBarPoint(pose, frame.width, frame.height);
  if (!hands) return null;
  const dx = hands.right.x - hands.left.x,
    dy = hands.right.y - hands.left.y;
  const span = Math.hypot(dx, dy);
  // End-on views do not expose enough shaft to support a line measurement.
  if (span < 30) return null;
  const angle = Math.atan2(dy, dx);
  const radius = Math.min(24, Math.max(6, frame.height * 0.035));
  const read = (x: number, y: number) => {
    const ix = Math.round(x),
      iy = Math.round(y);
    return ix < 0 || iy < 0 || ix >= frame.width || iy >= frame.height
      ? null
      : frame.pixels[iy * frame.width + ix];
  };
  const candidates: {
    angle: number;
    offset: number;
    score: number;
    width: number;
  }[] = [];
  for (let degrees = -12; degrees <= 12; degrees += 3) {
    const theta = angle + (degrees * Math.PI) / 180;
    const tx = Math.cos(theta),
      ty = Math.sin(theta),
      nx = -ty,
      ny = tx;
    for (let offset = -radius; offset <= radius; offset += 2) {
      for (const halfWidth of [1, 2, 3, 4]) {
        let hits = 0,
          tested = 0,
          contrast = 0,
          outsideHits = 0;
        for (let i = 0; i < 48; i++) {
          const along = (i / 47 - 0.5) * span * 1.5;
          // Hands wrap around the shaft; do not require pixels under the grip.
          if (Math.abs(Math.abs(along) - span / 2) < Math.max(3, span * 0.05))
            continue;
          const x = hands.x + nx * offset + tx * along;
          const y = hands.y + ny * offset + ty * along;
          const center = read(x, y);
          const above = read(
            x + nx * (halfWidth + 2),
            y + ny * (halfWidth + 2),
          );
          const below = read(
            x - nx * (halfWidth + 2),
            y - ny * (halfWidth + 2),
          );
          if (center === null || above === null || below === null) continue;
          tested++;
          const ridge = Math.max(
            Math.min(center - above, center - below),
            Math.min(above - center, below - center),
          );
          if (ridge >= 0.07) {
            hits++;
            contrast += ridge;
            if (Math.abs(along) > span / 2) outsideHits++;
          }
        }
        // Support must extend outside the hands, rejecting short clothing edges.
        if (tested >= 30 && hits / tested >= 0.65 && outsideHits >= 6)
          candidates.push({
            angle: theta,
            offset,
            width: halfWidth,
            score: contrast / tested,
          });
      }
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  if (!best || best.score < 0.09) return null;
  if (
    candidates.some(
      (c) =>
        Math.abs(c.offset - best.offset) > Math.max(6, best.width * 2) &&
        c.score > best.score * 0.9,
    )
  )
    return null;
  const tx = Math.cos(best.angle),
    ty = Math.sin(best.angle);
  const x = hands.x - ty * best.offset,
    y = hands.y + tx * best.offset;
  const left = {
    x: (x - (tx * span) / 2) / frame.width,
    y: (y - (ty * span) / 2) / frame.height,
  };
  const right = {
    x: (x + (tx * span) / 2) / frame.width,
    y: (y + (ty * span) / 2) / frame.height,
  };
  if ([left, right].some((p) => p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1))
    return null;
  return {
    time: pose.time,
    left,
    right,
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2,
  };
}
