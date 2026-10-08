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
    const ix = Math.floor(x),
      iy = Math.floor(y);
    if (ix < 0 || iy < 0 || ix + 1 >= frame.width || iy + 1 >= frame.height)
      return null;
    const fx = x - ix,
      fy = y - iy;
    const at = (px: number, py: number) => frame.pixels[py * frame.width + px];
    return (
      (1 - fy) * ((1 - fx) * at(ix, iy) + fx * at(ix + 1, iy)) +
      fy * ((1 - fx) * at(ix, iy + 1) + fx * at(ix + 1, iy + 1))
    );
  };
  const candidates: {
    angle: number;
    offset: number;
    score: number;
    width: number;
  }[] = [];
  const scan = (
    baseAngle: number,
    minAngle: number,
    maxAngle: number,
    angleStep: number,
    minOffset: number,
    maxOffset: number,
    offsetStep: number,
    widths: number[],
  ) => {
    for (let degrees = minAngle; degrees <= maxAngle; degrees += angleStep) {
      const theta = baseAngle + (degrees * Math.PI) / 180;
      const tx = Math.cos(theta),
        ty = Math.sin(theta),
        nx = -ty,
        ny = tx;
      for (let offset = minOffset; offset <= maxOffset; offset += offsetStep) {
        for (const halfWidth of widths) {
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
  };
  scan(angle, -12, 12, 3, -radius, radius, 2, [1, 2, 3, 4]);
  candidates.sort((a, b) => b.score - a.score);
  let best = candidates[0];
  if (!best || best.score < 0.09) return null;
  if (
    candidates.some(
      (c) =>
        Math.abs(c.offset - best.offset) > Math.max(6, best.width * 2) &&
        c.score > best.score * 0.9,
    )
  )
    return null;
  // Refine only an unambiguous supported ridge; never manufacture missing pixels.
  scan(
    best.angle,
    -1.5,
    1.5,
    0.5,
    Math.max(-radius, best.offset - 2),
    Math.min(radius, best.offset + 2),
    0.25,
    [best.width],
  );
  candidates.sort((a, b) => b.score - a.score);
  best = candidates[0];
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
