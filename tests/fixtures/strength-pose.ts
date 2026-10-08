import { liftFrames } from './lift-pose';
export function strengthFrames(id: string) {
  const ascending = liftFrames().slice(0, 13);
  const steps =
    id === 'romanian-deadlift'
      ? [...ascending].reverse().concat(ascending.slice(1))
      : ascending.concat([...ascending].reverse().slice(1));
  return steps.map((f, i) => {
    const frame = structuredClone(f);
    frame.time = i / 15;
    if (id === 'barbell-row') {
      const progress = i <= 12 ? i / 12 : (24 - i) / 12;
      for (const [s, e, w, h, k, a] of [
        [11, 13, 15, 23, 25, 27],
        [12, 14, 16, 24, 26, 28],
      ]) {
        frame.landmarks[s] = { x: 0.5, y: 0.35, visibility: 1 };
        frame.landmarks[h] = { x: 0.3, y: 0.5, visibility: 1 };
        frame.landmarks[k] = { x: 0.4, y: 0.72, visibility: 1 };
        frame.landmarks[a] = { x: 0.35, y: 0.95, visibility: 1 };
        frame.landmarks[e] = { x: 0.6, y: 0.55, visibility: 1 };
        frame.landmarks[w] = {
          x: 0.55,
          y: 0.75 - progress * 0.25,
          visibility: 1,
        };
      }
    }
    return frame;
  });
}
