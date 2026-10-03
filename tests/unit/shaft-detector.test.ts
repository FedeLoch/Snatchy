import { expect, it } from 'vitest';
import { detectBarShaft } from '../../src/domain/shaft-detector';
import { analyzePoseSamples, type PoseSample } from '../../src/domain/vision';
import { liftFrames } from '../fixtures/lift-pose';
import { barPanel } from '../../src/ui/lift-analysis';
import {
  isVisionRecord,
  loadVisionHistory,
  saveVisionHistory,
} from '../../src/services/vision-history';
const width = 240,
  height = 160;
function pose(): PoseSample {
  const f = structuredClone(liftFrames()[0]);
  for (const [ids, x] of [
    [[15, 17, 19], 80],
    [[16, 18, 20], 160],
  ] as const)
    for (const id of ids)
      f.landmarks[id] = { x: x / width, y: 80 / height, visibility: 1 };
  return f;
}
function frame(lines: number[], dark = false, slope = 0) {
  const pixels = new Float32Array(width * height).fill(dark ? 0.8 : 0.2);
  for (let x = 35; x < 205; x++)
    for (const line of lines)
      for (let y = 0; y < height; y++)
        if (Math.abs(y - line - slope * (x - 120)) <= 1)
          pixels[y * width + x] = dark ? 0.15 : 0.9;
  return { width, height, pixels };
}
it.each([false, true])(
  'finds the pixel shaft offset from the hands (dark=%s)',
  (dark) => {
    const result = detectBarShaft(frame([84], dark), pose());
    expect(result).not.toBeNull();
    expect(result!.y * height).toBeCloseTo(84, 0);
    expect(result!.y).not.toBe(0.5);
    expect(result!.x * width).toBeCloseTo(120, 0);
  },
);
it('supports a tilted shaft and rejects blank, competing lines and end-on views', () => {
  const tilted = detectBarShaft(
    frame([82], false, Math.tan((6 * Math.PI) / 180)),
    pose(),
  );
  expect(tilted).not.toBeNull();
  expect(tilted!.right.y).toBeGreaterThan(tilted!.left.y);
  expect(detectBarShaft(frame([]), pose())).toBeNull();
  expect(detectBarShaft(frame([74, 86]), pose())).toBeNull();
  const f = pose();
  for (const i of [16, 18, 20]) f.landmarks[i].x = f.landmarks[15].x;
  expect(detectBarShaft(frame([84]), f)).toBeNull();
  expect(detectBarShaft(frame([84]), { ...pose(), people: 2 })).toBeNull();
});
it('rejects a single broad edge and a short stripe confined between the hands', () => {
  const edge = frame([]);
  for (let y = 84; y < height; y++)
    for (let x = 0; x < width; x++) edge.pixels[y * width + x] = 0.9;
  expect(detectBarShaft(edge, pose())).toBeNull();
  const short = frame([84]);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (x < 90 || x > 150) short.pixels[y * width + x] = 0.2;
  expect(detectBarShaft(short, pose())).toBeNull();
});
it('uses shaft pixels for metrics, retains gaps and persists them without replacing hand estimates', () => {
  const frames = liftFrames().map((f, i) => ({
    ...f,
    barShaft:
      i === 10
        ? undefined
        : {
            time: f.time,
            left: { x: 0.2, y: 0.7 - i * 0.01 },
            right: { x: 0.8, y: 0.7 - i * 0.01 },
            x: 0.5,
            y: 0.7 - i * 0.01,
          },
  }));
  const a = analyzePoseSamples(frames, 1000, 500, 2);
  expect(a.shaftBar!.points).toHaveLength(25);
  expect(a.shaftBar!.points[0].y).toBe(350);
  expect(a.wristBar!.method).toBe('hand-midpoint');
  expect(barPanel(a)).toContain('PIXEL SHAFT ESTIMATE');
  const record = { id: 'shaft', createdAt: 1, analysis: a };
  expect(isVisionRecord(record)).toBe(true);
  saveVisionHistory(localStorage, [record]);
  expect(loadVisionHistory(localStorage)[0].analysis.shaftBar).toEqual(
    a.shaftBar,
  );
  const bad = structuredClone(record);
  bad.analysis.shaftBar!.points[0].x = NaN;
  expect(isVisionRecord(bad)).toBe(false);
  expect(
    analyzePoseSamples(
      frames.map((f, i) => ({
        ...f,
        barShaft: i < 5 ? f.barShaft : undefined,
      })),
      1000,
      500,
      2,
    ).shaftBar,
  ).toBeUndefined();
});
