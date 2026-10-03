import { SIDES, anglesAt, visible, type PoseSample, type Side } from './vision';

const median = (xs: number[]) =>
  xs.toSorted((a, b) => a - b)[Math.floor(xs.length / 2)];
/** Exclude isolated geometric glitches, never fill gaps or move observed points.
 * Keep raw coordinates in memory for inspection and repeatable reanalysis.
 */
export function reliablePoseFrames(
  frames: PoseSample[],
  width: number,
  height: number,
  sampleRate: number,
): PoseSample[] {
  const raw = frames.map((f) => ({
    ...f,
    landmarks: f.rawLandmarks ?? f.landmarks,
  }));
  const parents: Record<number, number> = {
    11: 23,
    12: 24,
    13: 11,
    14: 12,
    15: 13,
    16: 14,
    23: 11,
    24: 12,
    25: 27,
    26: 28,
    27: 25,
    28: 26,
  };
  const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot((a.x - b.x) * width, (a.y - b.y) * height);
  return raw.map((f, i) => {
    const landmarks = f.landmarks.map((p) => ({ ...p }));
    if (f.people === 1 && i > 0 && i + 1 < raw.length) {
      const before = raw[i - 1],
        after = raw[i + 1];
      if (
        before.people === 1 &&
        after.people === 1 &&
        f.time - before.time <= 1.6 / sampleRate &&
        after.time - f.time <= 1.6 / sampleRate
      ) {
        for (const [key, parent] of Object.entries(parents)) {
          const id = Number(key),
            point = f.landmarks[id],
            p = f.landmarks[parent];
          const prev = before.landmarks[id],
            next = after.landmarks[id];
          if (
            ![
              point,
              p,
              prev,
              next,
              before.landmarks[parent],
              after.landmarks[parent],
            ].every(visible)
          )
            continue;
          const previousLength = distance(prev, before.landmarks[parent]);
          const nextLength = distance(next, after.landmarks[parent]);
          const expected = (previousLength + nextLength) / 2;
          if (
            expected < 4 ||
            Math.abs(previousLength - nextLength) > expected * 0.2
          )
            continue;
          const fraction = (f.time - before.time) / (after.time - before.time);
          const predicted = {
            x: prev.x + (next.x - prev.x) * fraction,
            y: prev.y + (next.y - prev.y) * fraction,
          };
          const lengthError =
            Math.abs(distance(point, p) - expected) / expected;
          if (
            lengthError > 0.4 &&
            distance(point, predicted) > expected * 0.45 &&
            distance(prev, next) < expected * 0.5
          )
            landmarks[id].visibility = 0;
        }
      }
    }
    return { ...f, rawLandmarks: f.landmarks, landmarks };
  });
}
/** Choose one coherent side per analyzed rep. Complete joint chains count more
 * than high visibility on an incomplete chain; isolated jumps were excluded above.
 */
export function reliableSide(
  frames: PoseSample[],
  width: number,
  height: number,
): Side {
  const score = (side: Side) =>
    frames.reduce((sum, f) => {
      if (f.people !== 1) return sum;
      const complete = Object.values(anglesAt(f, side, width, height)).filter(
        (v) => v !== null,
      ).length;
      const visibility = SIDES[side].reduce(
        (s, id) =>
          s + (visible(f.landmarks[id]) ? f.landmarks[id].visibility : 0),
        0,
      );
      return sum + complete * 2 + visibility;
    }, 0);
  return score('left') >= score('right') ? 'left' : 'right';
}

/** Representative is an actual sample, not an interpolated angle. A persistent
 * minimum is the lowest three-sample median from uninterrupted observed data.
 */
export function sustainedMinimum<T extends { time: number }>(
  rows: T[],
  value: (row: T) => number | null,
  sampleRate: number,
): T | null {
  let best: T | null = null;
  for (let i = 0; i + 2 < rows.length; i++) {
    const window = rows.slice(i, i + 3);
    if (
      window.some(
        (r, j) =>
          value(r) === null ||
          (j > 0 && r.time - window[j - 1].time > 1.6 / sampleRate),
      )
    )
      continue;
    const mid = median(window.map((r) => value(r)!));
    const representative = window.find((r) => value(r) === mid)!;
    if (!best || value(representative)! < value(best)!) best = representative;
  }
  return best;
}
