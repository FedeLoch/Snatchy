import { cp, mkdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url);
await mkdir(new URL('public/vision/', root), { recursive: true });
await cp(
  new URL('node_modules/@mediapipe/tasks-vision/wasm/', root),
  new URL('public/vision/', root),
  { recursive: true },
);
const model = await readFile(
  new URL('public/models/pose_landmarker_lite.task', root),
);
if (
  createHash('sha256').update(model).digest('hex') !==
  '59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a'
)
  throw new Error('Pose model integrity check failed.');
console.log('Local vision runtime ready; model checksum verified.');
