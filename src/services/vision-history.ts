import { PHASE_NAMES } from '../domain/lift-phases';
import type { VisionRecord, VisionAnalysis } from '../domain/vision';
import type { StoragePort } from './history';
export const VISION_HISTORY_KEY = 'snatchy-vision-history-v1';
export function isVisionRecord(value: unknown): value is VisionRecord {
  if (!value || typeof value !== 'object') return false;
  const r = value as VisionRecord,
    a = r.analysis;
  if (
    typeof r.id !== 'string' ||
    !/^[a-zA-Z0-9-]+$/.test(r.id) ||
    !Number.isFinite(r.createdAt) ||
    r.createdAt <= 0 ||
    r.createdAt > 8640000000000000 ||
    !a
  )
    return false;
  if (
    a.kind !== 'measured-pose' ||
    a.version !== 1 ||
    a.simulated !== false ||
    a.engine !== 'MediaPipe Pose Landmarker Lite' ||
    !['tracked', 'insufficient'].includes(a.status) ||
    !['left', 'right'].includes(a.side)
  )
    return false;
  if (
    ![a.duration, a.width, a.height, a.sampleRate].every(
      (n) => Number.isFinite(n) && n > 0,
    ) ||
    !Number.isFinite(a.coverage) ||
    a.coverage < 0 ||
    a.coverage > 1 ||
    !Number.isInteger(a.sampledFrames) ||
    a.sampledFrames < 0 ||
    !Number.isInteger(a.usableFrames) ||
    a.usableFrames < 0 ||
    a.usableFrames > a.sampledFrames
  )
    return false;
  if (
    !a.ranges ||
    !['elbow', 'hip', 'knee'].every((key) => {
      const range = a.ranges[key as keyof VisionAnalysis['ranges']];
      return (
        range === null ||
        (!!range &&
          [range.min, range.max].every(
            (n) => Number.isFinite(n) && n >= 0 && n <= 180,
          ) &&
          [range.minTime, range.maxTime].every(
            (n) => Number.isFinite(n) && n >= 0 && n <= a.duration,
          ) &&
          range.min <= range.max)
      );
    })
  )
    return false;
  if (
    a.interval !== undefined &&
    (!a.interval ||
      !Number.isFinite(a.interval.start) ||
      !Number.isFinite(a.interval.end) ||
      a.interval.start < 0 ||
      a.interval.end <= a.interval.start ||
      a.interval.end > a.duration)
  )
    return false;
  if (
    a.repetitions !== undefined &&
    (!Array.isArray(a.repetitions) ||
      a.repetitions.length > 100 ||
      !a.repetitions.every(
        (rep, i) =>
          rep &&
          rep.repetitions === undefined &&
          rep.interval &&
          rep.duration <= a.duration &&
          rep.interval.start >= (i ? a.repetitions![i - 1].interval!.end : 0) &&
          isVisionRecord({ id: r.id, createdAt: r.createdAt, analysis: rep }),
      ))
  )
    return false;
  if (a.lift !== undefined) {
    const lift = a.lift;
    if (
      !lift ||
      lift.version !== 1 ||
      lift.method !== 'pose-heuristic' ||
      !Array.isArray(lift.phases) ||
      lift.phases.length !== 7 ||
      !Array.isArray(lift.checks)
    )
      return false;
    let previous = -1;
    for (const [index, phase] of lift.phases.entries()) {
      if (
        !phase ||
        phase.name !== PHASE_NAMES[index] ||
        typeof phase.evidence !== 'string' ||
        (phase.estimated !== undefined && typeof phase.estimated !== 'boolean')
      )
        return false;
      if (
        phase.start !== null &&
        (!Number.isFinite(phase.start) ||
          phase.start < 0 ||
          phase.start > a.duration ||
          phase.start <= previous)
      )
        return false;
      if (phase.start !== null) previous = phase.start;
      if (
        phase.end !== null &&
        (phase.start === null ||
          !Number.isFinite(phase.end) ||
          phase.end <= phase.start ||
          phase.end > a.duration)
      )
        return false;
      if (
        phase.coverage !== null &&
        (!Number.isFinite(phase.coverage) ||
          phase.coverage < 0 ||
          phase.coverage > 1)
      )
        return false;
    }
    if (
      lift.checks.length > 5 ||
      new Set(lift.checks.map((c) => c.name)).size !== lift.checks.length
    )
      return false;
    if (
      !lift.checks.every(
        (c) =>
          !!c &&
          typeof c.name === 'string' &&
          typeof c.detail === 'string' &&
          c.unit === '°' &&
          typeof c.passed === 'boolean' &&
          [c.value, c.target].every(
            (v) => Number.isFinite(v) && v >= 0 && v <= 180,
          ) &&
          c.passed === c.value >= c.target &&
          Number.isFinite(c.time) &&
          c.time >= 0 &&
          c.time <= a.duration,
      )
    )
      return false;
    if (
      lift.score !==
      (lift.checks.length
        ? Math.round(
            (lift.checks.filter((c) => c.passed).length / lift.checks.length) *
              100,
          )
        : null)
    )
      return false;
    const supports: Record<string, boolean> = {
      'Arms through the pull': lift.phases[1].start !== null,
      'Hip extension':
        lift.phases[3].start !== null || lift.phases[4].start !== null,
      'Knee extension':
        lift.phases[3].start !== null || lift.phases[4].start !== null,
      'Receiving arm extension': lift.phases[5].start !== null,
      'Standing recovery': lift.phases[6].start !== null,
    };
    if (lift.checks.some((c) => supports[c.name] !== true)) return false;
  }
  if (a.automaticBar !== undefined) {
    const b = a.automaticBar;
    if (
      !b ||
      b.method !== 'circle-template' ||
      ![b.width, b.height, b.radius].every(
        (v) => Number.isFinite(v) && v > 0,
      ) ||
      typeof b.stoppedEarly !== 'boolean' ||
      !Array.isArray(b.points) ||
      b.points.length < 6 ||
      b.points.length > 1801 ||
      !b.points.every(
        (p, i) =>
          p &&
          [p.x, p.y, p.time, p.confidence].every(Number.isFinite) &&
          p.x >= 0 &&
          p.x < b.width &&
          p.y >= 0 &&
          p.y < b.height &&
          p.time >= 0 &&
          p.time <= a.duration &&
          p.confidence >= 0.8 &&
          p.confidence <= 1.000001 &&
          (i === 0 || p.time > b.points[i - 1].time),
      )
    )
      return false;
  }
  if (a.bar !== undefined) {
    const b = a.bar;
    if (
      !b ||
      b.version !== 1 ||
      b.method !== 'seeded-template' ||
      b.reviewed !== true ||
      typeof b.stoppedEarly !== 'boolean' ||
      ![b.width, b.height, b.metersPerPixel, b.diameterCm].every(
        (v) => Number.isFinite(v) && v > 0,
      ) ||
      b.diameterCm < 5 ||
      b.diameterCm > 100 ||
      ![b.start, b.end, b.requestedEnd].every(
        (v) => Number.isFinite(v) && v >= 0 && v <= a.duration,
      ) ||
      b.start >= b.end ||
      b.end > b.requestedEnd ||
      !Array.isArray(b.points) ||
      b.points.length < 3 ||
      b.points.length > 451
    )
      return false;
    if (
      !b.points.every(
        (p, i) =>
          !!p &&
          [p.x, p.y, p.time, p.confidence].every(Number.isFinite) &&
          p.x >= 0 &&
          p.x < b.width &&
          p.y >= 0 &&
          p.y < b.height &&
          p.confidence >= 0.8 &&
          p.confidence <= 1.000001 &&
          p.time >= b.start &&
          p.time <= b.end &&
          (i === 0 || p.time > b.points[i - 1].time),
      )
    )
      return false;
    if (b.points[0].time !== b.start || b.points.at(-1)!.time !== b.end)
      return false;
  }
  return (
    Array.isArray(a.frames) &&
    Array.isArray(a.events) &&
    a.events.every(
      (e) =>
        typeof e.id === 'string' &&
        /^[a-z-]+$/.test(e.id) &&
        Number.isFinite(e.time) &&
        e.time >= 0 &&
        e.time <= a.duration &&
        typeof e.title === 'string' &&
        typeof e.detail === 'string' &&
        ['measurement', 'hypothesis'].includes(e.kind),
    )
  );
}
export function loadVisionHistory(storage: StoragePort): VisionRecord[] {
  try {
    const data: unknown = JSON.parse(
      storage.getItem(VISION_HISTORY_KEY) ?? '[]',
    );
    return Array.isArray(data)
      ? data
          .filter(isVisionRecord)
          .map((r) => ({ ...r, analysis: summary(r.analysis) }))
          .slice(0, 10)
      : [];
  } catch {
    return [];
  }
}
export function saveVisionHistory(
  storage: StoragePort,
  records: VisionRecord[],
): string {
  try {
    storage.setItem(
      VISION_HISTORY_KEY,
      JSON.stringify(
        records
          .slice(0, 10)
          .map((r) => ({ ...r, analysis: summary(r.analysis) })),
      ),
    );
    return '';
  } catch {
    return 'This analysis is available for this session, but the summary could not be saved on this device.';
  }
}

function summary(a: VisionAnalysis): VisionAnalysis {
  return {
    ...a,
    frames: [],
    ...(a.repetitions
      ? { repetitions: a.repetitions.map((rep) => ({ ...rep, frames: [] })) }
      : {}),
  };
}
