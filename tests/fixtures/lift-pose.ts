import type { Landmark, PoseSample } from '../../src/domain/vision';
const point = (x: number, y: number): Landmark => ({ x, y, visibility: 0.99 });
export function liftFrames(): PoseSample[] {
  const knees = [
    110, 110, 110, 120, 130, 145, 160, 155, 145, 140, 145, 160, 175, 170, 150,
    120, 95, 85, 85, 95, 115, 140, 165, 175, 175, 175,
  ];
  return knees.map((knee, i) => {
    const angle = ((180 - knee) * Math.PI) / 180;
    const h = point(0.5 + Math.sin(angle) * 0.18, 0.7 - Math.cos(angle) * 0.18);
    const hipAngle = ((i === 12 ? 175 : 145) * Math.PI) / 180;
    const dir = Math.atan2(0.7 - h.y, 0.5 - h.x) - hipAngle;
    const s = point(h.x + Math.cos(dir) * 0.2, h.y + Math.sin(dir) * 0.2);
    const wrist = point(
      s.x,
      i < 3
        ? 0.84
        : i < 13
          ? 0.84 - (i - 2) * 0.028
          : i < 15
            ? s.y + 0.03
            : s.y - 0.18,
    );
    const elbow = point(s.x, (s.y + wrist.y) / 2);
    const landmarks = Array.from({ length: 33 }, () => point(0.5, 0.5));
    for (const [si, ei, wi, hi, ki, ai] of [
      [11, 13, 15, 23, 25, 27],
      [12, 14, 16, 24, 26, 28],
    ]) {
      landmarks[si] = s;
      landmarks[ei] = elbow;
      landmarks[wi] = wrist;
      landmarks[hi] = h;
      landmarks[ki] = point(0.5, 0.7);
      landmarks[ai] = point(0.5, 0.9);
    }
    return { time: i / 15, people: 1, landmarks };
  });
}
