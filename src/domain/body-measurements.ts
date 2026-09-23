import { visible, type VisionAnalysis } from './vision';
export interface BodyMeasurements {
  meanVisible: number;
  handSpan: number | null;
  footSpan: number | null;
  shoulderTilt: number | null;
}
export function bodyMeasurements(a: VisionAnalysis): BodyMeasurements {
  const hands: number[] = [],
    feet: number[] = [],
    tilts: number[] = [];
  let count = 0;
  for (const f of a.frames) {
    if (f.people !== 1) continue;
    count += f.landmarks.filter(visible).length;
    const l = f.landmarks;
    if (![11, 12, 23, 24].every((i) => visible(l[i]))) continue;
    const distance = (i: number, j: number) =>
      Math.hypot((l[i].x - l[j].x) * a.width, (l[i].y - l[j].y) * a.height);
    const torso = (distance(11, 23) + distance(12, 24)) / 2;
    if (torso < a.height * 0.05) continue;
    if ([15, 16].every((i) => visible(l[i])))
      hands.push((distance(15, 16) / torso) * 100);
    if ([31, 32].every((i) => visible(l[i])))
      feet.push((distance(31, 32) / torso) * 100);
    if (Math.abs(l[12].x - l[11].x) * a.width > torso * 0.2)
      tilts.push(
        (Math.atan2(
          Math.abs(l[12].y - l[11].y) * a.height,
          Math.abs(l[12].x - l[11].x) * a.width,
        ) *
          180) /
          Math.PI,
      );
  }
  const median = (v: number[]) =>
    v.length
      ? Math.round(v.sort((x, y) => x - y)[Math.floor(v.length / 2)])
      : null;
  return {
    meanVisible: a.frames.length ? Math.round(count / a.frames.length) : 0,
    handSpan: median(hands),
    footSpan: median(feet),
    shoulderTilt: median(tilts),
  };
}
