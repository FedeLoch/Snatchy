import type { Analysis, Phase } from './types';
export function clampTime(value: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(duration, value));
}
export function phaseAt(analysis: Analysis, time: number): Phase {
  return (
    analysis.phases.findLast(
      (p) => clampTime(time, analysis.duration) >= p.start,
    ) ?? analysis.phases[0]
  );
}
export function loopWindow(time: number, duration: number): [number, number] {
  const center = clampTime(time, duration);
  return [clampTime(center - 0.4, duration), clampTime(center + 0.4, duration)];
}
const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;
const text = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= 2000;
const identifier = (v: unknown): v is string =>
  text(v) && /^[a-z0-9-]+$/.test(v);
const score = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;
const time = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0;
export function isAnalysis(value: unknown): value is Analysis {
  if (
    !object(value) ||
    value.version !== 1 ||
    value.simulated !== true ||
    !identifier(value.movementId) ||
    !score(value.score) ||
    !text(value.verdict) ||
    !text(value.summary) ||
    !time(value.duration) ||
    value.duration <= 0
  )
    return false;
  const { phases, issues, metrics } = value;
  if (
    !Array.isArray(phases) ||
    !phases.length ||
    !phases.every(
      (p: unknown) =>
        object(p) &&
        identifier(p.id) &&
        text(p.name) &&
        score(p.score) &&
        time(p.start) &&
        p.start < (value.duration as number),
    )
  )
    return false;
  if (
    phases[0].start !== 0 ||
    phases.some((p, i) => i > 0 && p.start <= phases[i - 1].start) ||
    new Set(phases.map((p) => p.id)).size !== phases.length
  )
    return false;
  if (
    !Array.isArray(issues) ||
    !issues.every(
      (i: unknown) =>
        object(i) &&
        identifier(i.id) &&
        text(i.name) &&
        identifier(i.phaseId) &&
        phases.some((p) => p.id === i.phaseId) &&
        ['minor', 'moderate'].includes(String(i.severity)) &&
        time(i.time) &&
        i.time <= (value.duration as number) &&
        text(i.measurement) &&
        text(i.what) &&
        text(i.why) &&
        text(i.how) &&
        ['elbow', 'bar', 'shoulder'].includes(String(i.highlight)) &&
        Array.isArray(i.drillIds) &&
        i.drillIds.every(identifier),
    )
  )
    return false;
  if (new Set(issues.map((i) => i.id)).size !== issues.length) return false;
  return (
    Array.isArray(metrics) &&
    metrics.every(
      (m: unknown) =>
        object(m) && text(m.label) && time(m.value) && text(m.unit),
    )
  );
}
