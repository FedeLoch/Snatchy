import type { Landmark, PoseSample, WorldPoint } from '../domain/vision';
import type { WristBarPoint } from '../domain/wrist-bar';

/** Per-frame pose (body, hands, 3D, bar detection) kept on this device so a
 * saved result can replay its skeleton and be re-analyzed without the
 * video. Stored in IndexedDB as typed arrays, keyed by the record id; the
 * localStorage history keeps only summaries. Unfiltered landmarks are stored
 * so reanalysis repeats the same reliability filtering. */
const DB = 'snatchy-pose-v1';
const STORE = 'frames';

interface StoredFrame {
  t: number;
  p: number;
  /** x, y, visibility per landmark. */
  l: Float32Array;
  w?: Float32Array;
  hl?: Float32Array;
  hr?: Float32Array;
  /** left x/y, right x/y, center x/y of a detected bar shaft. */
  s?: Float32Array;
}
interface StoredPose {
  id: string;
  version: 1;
  frames: StoredFrame[];
}

const flat = (points: Landmark[]) =>
  Float32Array.from(points.flatMap((p) => [p.x, p.y, p.visibility]));
const landmarks = (data: Float32Array): Landmark[] =>
  Array.from({ length: data.length / 3 }, (_, i) => ({
    x: data[i * 3],
    y: data[i * 3 + 1],
    visibility: data[i * 3 + 2],
  }));
const world = (data: Float32Array): WorldPoint[] =>
  Array.from({ length: data.length / 3 }, (_, i) => ({
    x: data[i * 3],
    y: data[i * 3 + 1],
    z: data[i * 3 + 2],
  }));

export function encodePose(frames: PoseSample[]): StoredFrame[] {
  return frames.map((f) => {
    const out: StoredFrame = {
      t: f.time,
      p: f.people,
      l: flat(f.rawLandmarks ?? f.landmarks),
    };
    if (f.world)
      out.w = Float32Array.from(f.world.flatMap((p) => [p.x, p.y, p.z]));
    if (f.hands?.left) out.hl = flat(f.hands.left);
    if (f.hands?.right) out.hr = flat(f.hands.right);
    if (f.barShaft)
      out.s = Float32Array.from([
        f.barShaft.left.x,
        f.barShaft.left.y,
        f.barShaft.right.x,
        f.barShaft.right.y,
        f.barShaft.x,
        f.barShaft.y,
      ]);
    return out;
  });
}

export function decodePose(frames: StoredFrame[]): PoseSample[] {
  return frames.map((f) => {
    const sample: PoseSample = {
      time: f.t,
      people: f.p,
      landmarks: landmarks(f.l),
    };
    if (f.w) sample.world = world(f.w);
    if (f.hl || f.hr)
      sample.hands = {
        ...(f.hl ? { left: landmarks(f.hl) } : {}),
        ...(f.hr ? { right: landmarks(f.hr) } : {}),
      };
    if (f.s) {
      const s = f.s;
      sample.barShaft = {
        time: f.t,
        left: { x: s[0], y: s[1] },
        right: { x: s[2], y: s[3] },
        x: s[4],
        y: s[5],
      } satisfies WristBarPoint;
    }
    return sample;
  });
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await open();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = action(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request ? request.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** Saves the recording's frames; false when storage is unavailable or full. */
export async function savePose(
  id: string,
  frames: PoseSample[],
): Promise<boolean> {
  if (!frames.length) return false;
  try {
    const value: StoredPose = { id, version: 1, frames: encodePose(frames) };
    await run('readwrite', (store) => store.put(value));
    return true;
  } catch {
    return false;
  }
}

export async function loadPose(id: string): Promise<PoseSample[] | null> {
  try {
    const value = (await run('readonly', (store) => store.get(id))) as
      StoredPose | undefined;
    return value?.version === 1 && Array.isArray(value.frames)
      ? decodePose(value.frames)
      : null;
  } catch {
    return null;
  }
}

/** Removes stored frames of records that are no longer in history. */
export async function prunePoses(keep: string[]): Promise<void> {
  try {
    const ids = ((await run('readonly', (store) => store.getAllKeys())) ??
      []) as IDBValidKey[];
    const stale = ids.filter((id) => !keep.includes(String(id)));
    if (stale.length)
      await run('readwrite', (store) => {
        for (const id of stale) store.delete(id);
      });
  } catch {
    /* Pose replay is optional; history works without it. */
  }
}
