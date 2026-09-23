import { liftFrames } from './lift-pose';
export function cleanFrames(power = false, highHang = false, muscle = false) {
  const knees = [
    110, 110, 110, 120, 130, 145, 160, 155, 145, 140, 145, 160, 175, 170, 150,
    120, 95, 85, 85, 95, 115, 140, 165, 175, 175, 175,
  ];
  if (power)
    knees.splice(15, 11, 150, 145, 142, 140, 145, 150, 155, 165, 170, 175, 175);
  if (muscle) knees.splice(15, 11, ...Array(11).fill(175));
  if (highHang) knees.splice(0, 3, 165, 165, 165);
  const frames = liftFrames(knees);
  for (const [i, f] of frames.entries())
    for (const [s, e, w, h] of [
      [11, 13, 15, 23],
      [12, 14, 16, 24],
    ]) {
      if (i >= 15) {
        f.landmarks[w] = {
          x: f.landmarks[s].x,
          y: f.landmarks[s].y + 0.03,
          visibility: 1,
        };
        f.landmarks[e] = {
          x: f.landmarks[s].x + 0.08,
          y: f.landmarks[s].y + 0.12,
          visibility: 1,
        };
      } else if (highHang && i < 13) {
        f.landmarks[w] = {
          x: f.landmarks[s].x,
          y: frames[0].landmarks[h].y + 0.04 - Math.max(0, i - 2) * 0.009,
          visibility: 1,
        };
        f.landmarks[e] = {
          x: f.landmarks[s].x,
          y: (f.landmarks[s].y + f.landmarks[w].y) / 2,
          visibility: 1,
        };
      }
    }
  return frames;
}
