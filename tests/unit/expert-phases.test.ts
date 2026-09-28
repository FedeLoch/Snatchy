import { expect, it } from 'vitest';
import traces from '../fixtures/expert-phase-traces.json';
import { analyzePoseSamples } from '../../src/domain/vision';
import { analyzeRepetitions } from '../../src/domain/repetitions';
import { partialScore } from '../../src/domain/score-summary';
import { techniqueScore } from '../../src/ui/lift-analysis';
const ids = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
function analyze(index: number) {
  const trace = traces[index];
  const frames = trace.rows.map((row) => {
    const landmarks = Array.from({ length: 33 }, () => ({
      x: 0,
      y: 0,
      visibility: 0,
    }));
    ids.forEach((id, i) => {
      const point = row[i + 2] as number[];
      landmarks[id] = { x: point[0], y: point[1], visibility: point[2] };
    });
    return { time: row[0] as number, people: row[1] as number, landmarks };
  });
  return analyzePoseSamples(
    frames,
    trace.width,
    trace.height,
    trace.duration,
    trace.sampleRate,
    'auto',
  );
}
it('recognizes a wide-grip high-hang dip and all applicable phases', () => {
  const analysis = analyze(1);
  expect(analysis.exercise?.id).toBe('high-hang-snatch');
  const reps = analyzeRepetitions(analysis);
  expect(reps).toHaveLength(1);
  expect(reps[0].exercise?.id).toBe('high-hang-snatch');
  const lift = reps[0].lift!;
  expect(
    lift.phases
      .filter((p) => p.applicable !== false)
      .every((p) => p.start !== null),
  ).toBe(true);
  expect(lift.phases[1].applicable).toBe(false);
  expect(lift.phases[2].applicable).toBe(false);
  expect(lift.phases[3].start).toBeGreaterThan(2.5);
  expect(lift.phases[3].start).toBeLessThan(3.1);
  expect(lift.checks).toHaveLength(5);
  expect(partialScore(reps[0])).toBe(false);
});
it('retains setup and the entire slow-motion rep instead of restarting mid-pull', () => {
  const reps = analyzeRepetitions(analyze(0));
  expect(reps).toHaveLength(1);
  expect(reps[0].interval!.start).toBeLessThan(1);
  expect(reps[0].interval!.end).toBeGreaterThan(23);
  expect(reps[0].exercise?.id).toBe('snatch');
});
it('keeps timing uncertainty visible without calling five available checks partial', () => {
  const a = analyze(1);
  a.lift!.phases[4].start = null;
  expect(partialScore(a)).toBe(false);
  expect(techniqueScore(a)).toContain('Turnover');
  expect(techniqueScore(a)).not.toContain('class="partial-score-mark"');
  a.lift!.checks.pop();
  expect(partialScore(a)).toBe(true);
  expect(techniqueScore(a)).toContain('class="partial-score-mark"');
});
