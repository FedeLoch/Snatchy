import traces from './recorded-phase-traces.json' with { type: 'json' };
import { SIDES, type PoseSample } from '../../src/domain/vision';
export const recordedTraces = traces;
export function recordedFrames(
  trace: (typeof recordedTraces)[number],
): PoseSample[] {
  return trace.rows.map((row) => {
    const landmarks = Array.from({ length: 33 }, () => ({
      x: 0,
      y: 0,
      visibility: 0,
    }));
    SIDES[trace.side as 'left' | 'right'].forEach((id, index) => {
      const p = row[index + 1];
      if (Array.isArray(p))
        landmarks[id] = { x: p[0], y: p[1], visibility: p[2] };
    });
    return {
      time: row[0] as number,
      people: row.length > 1 ? 1 : 0,
      landmarks,
    };
  });
}
