import { anglesAt } from './vision';
import {
  analyzePoseSamples,
  SIDES,
  visible,
  type VisionAnalysis,
} from './vision';
export interface RepWindow {
  start: number;
  end: number;
}
/** Candidate low-to-overhead repetitions, not exercise classification. Times stay in source coordinates. */
export function detectRepetitions(a: VisionAnalysis): RepWindow[] {
  const [, , wrist, hip] = SIDES[a.side];
  const [shoulder] = SIDES[a.side];
  const rows = a.frames.map((f) => {
    const w = f.landmarks[wrist],
      h = f.landmarks[hip],
      s = f.landmarks[shoulder];
    const valid = f.people === 1 && visible(w) && visible(h) && visible(s);
    return {
      time: f.time,
      y: valid ? w.y : null,
      low: valid && w.y > h.y + 0.03,
      high:
        valid &&
        (w.y < s.y - 0.06 ||
          (Math.abs(w.y - s.y) < 0.1 &&
            (anglesAt(f, a.side, a.width, a.height).elbow ?? 180) < 120)),
    };
  });
  const windows: RepWindow[] = [];
  let low = -1,
    onset = -1,
    high = -1,
    lastHigh = -1,
    highCount = 0;
  const finish = (end: number) => {
    if (high >= 0 && low >= 0 && end - rows[low].time >= 0.5) {
      const start = Math.max(windows.at(-1)?.end ?? 0, rows[low].time - 0.6);
      windows.push({ start, end: Math.min(a.duration, end) });
    }
    low = onset = high = lastHigh = -1;
    highCount = 0;
  };
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (high >= 0) {
      if (r.high) lastHigh = i;
      if (r.low || r.time - rows[lastHigh].time > 0.4)
        finish(Math.min(r.time, rows[lastHigh].time + 0.3));
      else continue;
    }
    // Keep the final stationary low point, then freeze it once the ascent starts.
    if (r.low && (low < 0 || (onset < 0 && r.y! >= rows[low].y! - 0.025)))
      low = i;
    if (low >= 0 && onset < 0 && r.y !== null && rows[low].y! - r.y > 0.035)
      onset = i;
    if (low >= 0 && r.time - rows[low].time > 12) {
      low = onset = -1;
      highCount = 0;
    }
    if (low >= 0 && onset >= 0 && r.high && rows[low].y! - r.y! > 0.15) {
      highCount++;
      if (highCount >= 3) {
        high = i - 2;
        lastHigh = i;
      }
    } else highCount = 0;
  }
  if (high >= 0) finish(a.duration);
  return windows;
}
export function analyzeRepetitions(a: VisionAnalysis): VisionAnalysis[] {
  return detectRepetitions(a).map((interval) => {
    const frames = a.frames.filter(
      (f) => f.time >= interval.start && f.time <= interval.end,
    );
    return {
      ...analyzePoseSamples(
        frames,
        a.width,
        a.height,
        interval.end,
        a.sampleRate,
        a.exercise?.source === 'manual' ? (a.exercise.id ?? 'snatch') : 'auto',
      ),
      interval,
    };
  });
}
