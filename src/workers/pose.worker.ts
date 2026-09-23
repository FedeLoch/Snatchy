import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import type { Landmark } from '../domain/vision';
let detector: PoseLandmarker | null = null;
self.onmessage = async (
  event: MessageEvent<{
    id: number;
    type: 'init' | 'frame';
    bitmap?: ImageBitmap;
    time?: number;
    origin?: string;
  }>,
) => {
  const { id, type, bitmap, time, origin } = event.data;
  try {
    if (type === 'init') {
      const files = await FilesetResolver.forVisionTasks(
        `${origin}/vision`,
        true,
      );
      detector = await PoseLandmarker.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: `${origin}/models/pose_landmarker_lite.task`,
          delegate: 'CPU',
        },
        runningMode: 'VIDEO',
        numPoses: 2,
        minPoseDetectionConfidence: 0.6,
        minPosePresenceConfidence: 0.6,
        minTrackingConfidence: 0.6,
        outputSegmentationMasks: false,
      });
      self.postMessage({ id, ready: true });
    } else {
      if (!detector || !bitmap || time === undefined)
        throw new Error('Pose detector is not ready.');
      const result = detector.detectForVideo(bitmap, time * 1000);
      const landmarks: Landmark[] =
        result.landmarks.length === 1
          ? result.landmarks[0].map((p) => ({
              x: p.x,
              y: p.y,
              visibility: p.visibility ?? 0,
            }))
          : [];
      self.postMessage({ id, people: result.landmarks.length, landmarks });
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
