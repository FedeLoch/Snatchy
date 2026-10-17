import { detectBarShaft } from '../domain/shaft-detector';
import { grayscale } from '../domain/bar-track';
import {
  FilesetResolver,
  HandLandmarker,
  PoseLandmarker,
} from '@mediapipe/tasks-vision';
import type { Landmark, Side } from '../domain/vision';
import { selectAthlete } from '../domain/pose-quality';
import {
  displayOnly,
  fuseHand,
  handAgrees,
  handCrop,
  mapHand,
  matchHand,
  widenCrop,
} from '../domain/hands';
/** Shaft detection thresholds are tuned in pixels at this frame size. */
const SHAFT_EDGE = 640;
/** The hand model's input is 224 px; a slightly larger crop keeps detail. */
const HAND_CROP = 256;
let shaftCanvas: OffscreenCanvas | null = null;
let handCanvas: OffscreenCanvas | null = null;
let detector: PoseLandmarker | null = null;
let hands: HandLandmarker | null = null;
let previous: Landmark[] | null = null;
// In a module worker MediaPipe loads its WASM factory with a dynamic import,
// which only runs once, and the factory global is cleared after each task is
// created. Re-publishing the module's default export lets a second task (the
// hand model) start after the pose model.
(self as unknown as { import: (url: string) => Promise<void> }).import = async (
  url,
) => {
  const loader = (await import(/* @vite-ignore */ url)) as {
    default: unknown;
  };
  (self as unknown as { ModuleFactory: unknown }).ModuleFactory =
    loader.default;
};
function canvas2d(
  current: OffscreenCanvas | null,
  width: number,
  height: number,
): OffscreenCanvas {
  const c = current ?? new OffscreenCanvas(width, height);
  if (c.width !== width || c.height !== height) {
    c.width = width;
    c.height = height;
  }
  return c;
}
/** Run the hand model on an enlarged crop around each pose wrist. Failures
 * leave the pose result untouched. */
function trackHands(
  bitmap: ImageBitmap,
  landmarks: Landmark[],
): { landmarks: Landmark[]; hands: Partial<Record<Side, Landmark[]>> } {
  const found: Partial<Record<Side, Landmark[]>> = {};
  if (!hands) return { landmarks, hands: found };
  handCanvas = canvas2d(handCanvas, HAND_CROP, HAND_CROP);
  const ctx = handCanvas.getContext('2d');
  if (!ctx) return { landmarks, hands: found };
  let fused = landmarks;
  for (const side of ['left', 'right'] as const) {
    const base = handCrop(landmarks, side, bitmap.width, bitmap.height);
    if (!base) continue;
    let hand: Landmark[] | null = null;
    let crop = base;
    for (let attempt = 0; attempt < 2; attempt++) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, HAND_CROP, HAND_CROP);
      ctx.drawImage(
        bitmap,
        crop.x,
        crop.y,
        crop.size,
        crop.size,
        0,
        0,
        HAND_CROP,
        HAND_CROP,
      );
      const result = hands.detect(handCanvas);
      const candidates = result.landmarks.map((points, i) =>
        mapHand(
          points,
          crop,
          bitmap.width,
          bitmap.height,
          result.handedness[i]?.[0]?.score ?? 0,
        ),
      );
      hand = matchHand(
        candidates,
        landmarks,
        side,
        crop,
        bitmap.width,
        bitmap.height,
      );
      // Widen only when nothing was detected, not when the match failed.
      if (hand || candidates.length) break;
      crop = widenCrop(base, 1.8);
    }
    if (!hand) continue;
    if (handAgrees(hand, landmarks, side, crop, bitmap.width, bitmap.height)) {
      found[side] = hand;
      fused = fuseHand(fused, side, hand);
    } else found[side] = displayOnly(hand);
  }
  return { landmarks: fused, hands: found };
}
self.onmessage = async (
  event: MessageEvent<{
    id: number;
    type: 'init' | 'frame';
    bitmap?: ImageBitmap;
    time?: number;
    origin?: string;
    model?: 'lite' | 'full';
  }>,
) => {
  const { id, type, bitmap, time, origin } = event.data;
  try {
    if (type === 'init') {
      const files = await FilesetResolver.forVisionTasks(
        `${origin}/vision`,
        true,
      );
      previous = null;
      detector = await PoseLandmarker.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: `${origin}/models/pose_landmarker_${event.data.model === 'full' ? 'full' : 'lite'}.task`,
          delegate: 'CPU',
        },
        runningMode: 'VIDEO',
        numPoses: 2,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputSegmentationMasks: false,
      });
      // Hand tracking refines wrists and adds finger landmarks; the body
      // analysis still works if this optional model cannot load.
      try {
        hands = await HandLandmarker.createFromOptions(files, {
          baseOptions: {
            modelAssetPath: `${origin}/models/hand_landmarker.task`,
            delegate: 'CPU',
          },
          runningMode: 'IMAGE',
          numHands: 2,
          minHandDetectionConfidence: 0.4,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      } catch {
        hands = null;
      }
      self.postMessage({ id, ready: true, hands: hands !== null });
    } else {
      if (!detector || !bitmap || time === undefined)
        throw new Error('Pose detector is not ready.');
      const result = detector.detectForVideo(bitmap, time * 1000);
      const poses = result.landmarks.map((pose) =>
        pose.map((p) => ({
          x: p.x,
          y: p.y,
          visibility: p.visibility ?? 0,
        })),
      );
      const athlete = selectAthlete(poses, previous);
      if (athlete) previous = athlete;
      const world = athlete
        ? result.worldLandmarks[poses.indexOf(athlete)]?.map((p) => ({
            x: p.x,
            y: p.y,
            z: p.z,
          }))
        : undefined;
      let landmarks: Landmark[] = athlete ?? [];
      let handLandmarks: Partial<Record<Side, Landmark[]>> | undefined;
      if (athlete) {
        try {
          const tracked = trackHands(bitmap, athlete);
          landmarks = tracked.landmarks;
          if (tracked.hands.left || tracked.hands.right)
            handLandmarks = tracked.hands;
        } catch {
          handLandmarks = undefined;
        }
      }
      let barShaft = null;
      // Pixel tracking is optional: unsupported canvas readback must not
      // discard the pose analysis or its clearly labeled hand fallback.
      try {
        const scale = Math.min(
          1,
          SHAFT_EDGE / Math.max(bitmap.width, bitmap.height),
        );
        shaftCanvas = canvas2d(
          shaftCanvas,
          Math.round(bitmap.width * scale),
          Math.round(bitmap.height * scale),
        );
        const ctx = shaftCanvas.getContext('2d', { willReadFrequently: true });
        if (ctx && athlete) {
          ctx.drawImage(bitmap, 0, 0, shaftCanvas.width, shaftCanvas.height);
          barShaft = detectBarShaft(
            grayscale(
              ctx.getImageData(0, 0, shaftCanvas.width, shaftCanvas.height)
                .data,
              shaftCanvas.width,
              shaftCanvas.height,
            ),
            { time, people: 1, landmarks },
          );
        }
      } catch {
        barShaft = null;
      }
      self.postMessage({
        id,
        people: athlete ? 1 : result.landmarks.length,
        landmarks,
        hands: handLandmarks,
        world,
        barShaft: barShaft ?? undefined,
      });
    }
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : 'Pose inference failed.',
    });
  } finally {
    bitmap?.close();
  }
};
