import { expect, it } from 'vitest';
import { detectBarShaft } from '../../src/domain/shaft-detector';
it('localizes subpixel ridges without sacrificing detection coverage', () => {
  const errors: number[] = [],
    angles: number[] = [];
  for (const offset of [2.3, 3.7, 4.6, -3.4])
    for (const angle of [-7.2, -2.3, 1.7, 5.2]) {
      const width = 240,
        height = 160,
        pixels = new Float32Array(width * height),
        theta = (angle * Math.PI) / 180;
      // Analytic image reference independent of detector discretization.
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          const d =
            (y - (80 + offset) - Math.tan(theta) * (x - 120)) * Math.cos(theta);
          pixels[y * width + x] = 0.2 + 0.7 * Math.exp(-0.5 * (d / 0.85) ** 2);
        }
      const landmarks = Array.from({ length: 33 }, () => ({
        x: 0,
        y: 0,
        visibility: 0,
      }));
      for (const ids of [
        [15, 17, 19],
        [16, 18, 20],
      ])
        for (const id of ids)
          landmarks[id] = {
            x: ids[0] === 15 ? 80 / width : 160 / width,
            y: 0.5,
            visibility: 1,
          };
      const p = detectBarShaft(
        { width, height, pixels },
        { time: 0, people: 1, landmarks },
      );
      expect(p).not.toBeNull();
      errors.push(Math.abs(p!.y * height - (80 + offset)));
      angles.push(
        Math.abs(
          (Math.atan2(
            (p!.right.y - p!.left.y) * height,
            (p!.right.x - p!.left.x) * width,
          ) *
            180) /
            Math.PI -
            angle,
        ),
      );
    }
  expect(errors).toHaveLength(16);
  expect(errors.reduce((a, b) => a + b, 0) / 16).toBeLessThan(0.15);
  expect(angles.reduce((a, b) => a + b, 0) / 16).toBeLessThan(0.3);
});
