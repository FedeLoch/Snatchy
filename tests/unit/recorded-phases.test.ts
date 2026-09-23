import { expect, it } from 'vitest';
import {
  recordedTraces as traces,
  recordedFrames,
} from '../fixtures/recorded-pose';
import { analyzePoseSamples } from '../../src/domain/vision';
import { isVisionRecord } from '../../src/services/vision-history';
it.each(traces)(
  'recovers supported phases in $name without inventing a rebend',
  (trace) => {
    const analysis = analyzePoseSamples(
      recordedFrames(trace),
      trace.width,
      trace.height,
      trace.duration,
    );
    const phases = analysis.lift!.phases;
    expect(phases.filter((p) => p.start !== null)).toHaveLength(6);
    expect(phases[2].start).toBeNull();
    expect(phases[2].evidence).toContain('No distinct knee rebend');
    expect(phases[3].estimated).toBe(true);
    expect(phases[0].start).toBeLessThan(phases[1].start!);
    expect(phases[1].start).toBeLessThan(phases[3].start!);
    expect(phases[3].start).toBeLessThan(phases[4].start!);
    expect(phases[4].start).toBeLessThan(phases[5].start!);
    expect(phases[5].start).toBeLessThan(phases[6].start!);
    expect(analysis.lift!.checks).toHaveLength(5);
    expect(isVisionRecord({ id: 'trace', createdAt: 1, analysis })).toBe(true);
  },
);
