import { SIDES, visible, type VisionAnalysis, type PoseSample } from './vision';
import type { MovementCheck, CheckName } from './lift-phases';
export function coachingGroup(name: CheckName): 'pull' | 'receive' | 'recover' {
  return name === 'Standing recovery'
    ? 'recover'
    : name === 'Receiving arm extension' || name === 'Front-rack arm flexion'
      ? 'receive'
      : 'pull';
}
/** A threshold illustration in the image plane, never a predicted ideal pose. */
export function referenceVector(
  a: VisionAnalysis,
  frame: PoseSample,
  check: MovementCheck,
) {
  if (
    frame.people !== 1 ||
    Math.abs(frame.time - check.time) > 1.1 / a.sampleRate
  )
    return null;
  const [s, e, w, h, k, ankle] = SIDES[a.side];
  const indices =
    check.name === 'Hip extension'
      ? [s, h, k]
      : check.name === 'Knee extension' || check.name === 'Standing recovery'
        ? [h, k, ankle]
        : [s, e, w];
  if (!indices.every((i) => visible(frame.landmarks[i]))) return null;
  const [p, c, d] = indices.map((i) => ({
    x: frame.landmarks[i].x * a.width,
    y: frame.landmarks[i].y * a.height,
  }));
  const length = Math.hypot(d.x - c.x, d.y - c.y);
  if (length < 1 || Math.hypot(p.x - c.x, p.y - c.y) < 1) return null;
  const target =
    check.name === 'Front-rack arm flexion' ? 180 - check.target : check.target;
  const base = Math.atan2(p.y - c.y, p.x - c.x);
  const sign =
    (p.x - c.x) * (d.y - c.y) - (p.y - c.y) * (d.x - c.x) >= 0 ? 1 : -1;
  const angle = base + (sign * target * Math.PI) / 180;
  const end = {
    x: c.x + length * Math.cos(angle),
    y: c.y + length * Math.sin(angle),
  };
  if (end.x < 0 || end.y < 0 || end.x > a.width || end.y > a.height)
    return null;
  return { start: c, end, target };
}
