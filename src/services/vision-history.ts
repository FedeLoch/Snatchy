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
          .map((r) => ({ ...r, analysis: { ...r.analysis, frames: [] } }))
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
          .map((r) => ({ ...r, analysis: { ...r.analysis, frames: [] } })),
      ),
    );
    return '';
  } catch {
    return 'This analysis is available for this session, but the summary could not be saved on this device.';
  }
}
