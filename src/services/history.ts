import { isAnalysis } from '../domain/analysis';
import { getMovement } from '../domain/movements';
import { snatchDemo } from '../data/snatch';
import type { LiftRecord } from '../domain/types';
export const HISTORY_KEY = 'snatchy-history-v2';
export const MAX_HISTORY = 30;
export type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
export interface HistoryResult {
  records: LiftRecord[];
  warning: string;
}
function validRecord(v: unknown): v is LiftRecord {
  if (typeof v !== 'object' || !v) return false;
  const r = v as Partial<LiftRecord>;
  return (
    typeof r.id === 'string' &&
    /^[a-zA-Z0-9-]+$/.test(r.id) &&
    typeof r.createdAt === 'number' &&
    Number.isFinite(r.createdAt) &&
    r.createdAt > 0 &&
    r.createdAt <= 8640000000000000 &&
    (r.source === 'demo' || r.source === 'video') &&
    isAnalysis(r.analysis) &&
    !!getMovement(r.analysis.movementId)?.available
  );
}
export function loadHistory(storage: StoragePort): HistoryResult {
  try {
    const raw = storage.getItem(HISTORY_KEY);
    if (raw === null) {
      const legacy: unknown = JSON.parse(
        storage.getItem('snatchy-history') ?? '[]',
      );
      const records: LiftRecord[] = Array.isArray(legacy)
        ? legacy
            .filter(
              (v): v is { id: number } =>
                !!v &&
                typeof v.id === 'number' &&
                Number.isFinite(v.id) &&
                v.id > 0 &&
                v.id <= 8640000000000000,
            )
            .map((v) => ({
              id: 'legacy-' + v.id,
              createdAt: v.id,
              source: 'demo',
              analysis: structuredClone(snatchDemo),
            }))
        : [];
      return { records: records.slice(0, MAX_HISTORY), warning: '' };
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed))
      return {
        records: [],
        warning:
          'Saved history could not be read. New lifts can still be analyzed.',
      };
    const unique = new Map<string, LiftRecord>();
    for (const record of parsed.filter(validRecord))
      unique.set(record.id, record);
    const records = [...unique.values()]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, MAX_HISTORY);
    return {
      records,
      warning: parsed.some((v) => !validRecord(v))
        ? 'Some saved lifts could not be read. Your valid results are still available.'
        : '',
    };
  } catch {
    return {
      records: [],
      warning:
        'History is unavailable in this browser. You can still analyze a lift.',
    };
  }
}
export function saveHistory(
  storage: StoragePort,
  records: LiftRecord[],
): string {
  try {
    storage.setItem(HISTORY_KEY, JSON.stringify(records.slice(0, MAX_HISTORY)));
    return '';
  } catch {
    return 'This result is available for this session, but could not be saved on this device.';
  }
}
export function addRecord(
  records: LiftRecord[],
  record: LiftRecord,
): LiftRecord[] {
  return [record, ...records.filter((r) => r.id !== record.id)].slice(
    0,
    MAX_HISTORY,
  );
}
