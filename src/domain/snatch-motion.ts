/** Simplified sagittal-plane choreography, not measured athlete keypoints.
 * Fixed projected segment lengths prevent the stretching in free-joint interpolation.
 * Phase timing follows the Snatch demo fixture. The deliberate early bend is retained.
 */
import { clampTime } from './analysis';
export type Point = readonly [number, number];
export const MOTION = {
  duration: 3.6,
  floor: 354,
  plateRadius: 30,
  thigh: 62,
  shin: 62,
  torso: 76,
  upperArm: 48,
  forearm: 48,
  catchTime: 2.15,
  recoveryTime: 2.8,
} as const;
export interface SnatchPose {
  hip: Point;
  shoulder: Point;
  knee: Point;
  ankle: Point;
  elbow: Point;
  wrist: Point;
  bar: Point;
  head: Point;
  heelLift: number;
}
interface Keyframe {
  time: number;
  hip: Point;
  tilt: number;
  heel: number;
  barX: number;
  elbowAngle: number;
  barY?: number;
}
const frames: Keyframe[] = [
  {
    time: 0,
    hip: [152, 266],
    tilt: 60,
    heel: 0,
    barX: 152 + 76 * Math.sin(Math.PI / 3),
    elbowAngle: 180,
  },
  {
    time: 0.45,
    hip: [152, 266],
    tilt: 60,
    heel: 0,
    barX: 152 + 76 * Math.sin(Math.PI / 3),
    elbowAngle: 180,
  },
  {
    time: 0.85,
    hip: [174, 231],
    tilt: 60,
    heel: 0,
    barX: 218,
    elbowAngle: 180,
  },
  {
    time: 0.95,
    hip: [178, 224],
    tilt: 50,
    heel: 0,
    barX: 212,
    elbowAngle: 180,
  },
  {
    time: 1.08,
    hip: [180, 228],
    tilt: 35,
    heel: 0,
    barX: 221,
    elbowAngle: 180,
  },
  {
    time: 1.25,
    hip: [183, 225],
    tilt: 18,
    heel: 0,
    barX: 214,
    elbowAngle: 180,
  },
  { time: 1.34, hip: [187, 221], tilt: 8, heel: 0, barX: 211, elbowAngle: 153 },
  {
    time: 1.46,
    hip: [190, 211],
    tilt: -1,
    heel: 9,
    barX: 205,
    elbowAngle: 134,
  },
  {
    time: 1.6,
    hip: [190, 209],
    tilt: -4,
    heel: 10,
    barX: 213,
    elbowAngle: 85,
    barY: 189,
  },
  {
    time: 1.65,
    hip: [184, 221],
    tilt: 6,
    heel: 4,
    barX: 211,
    elbowAngle: 60,
    barY: 179,
  },
  {
    time: 1.85,
    hip: [163, 267],
    tilt: 20,
    heel: 0,
    barX: 204,
    elbowAngle: 60,
    barY: 158,
  },
  {
    time: 2.02,
    hip: [150, 294],
    tilt: 25,
    heel: 0,
    barX: 196,
    elbowAngle: 120,
    barY: 142,
  },
  {
    time: 2.15,
    hip: [151, 301],
    tilt: 23,
    heel: 0,
    barX: 194,
    elbowAngle: 180,
  },
  { time: 2.8, hip: [151, 301], tilt: 23, heel: 0, barX: 194, elbowAngle: 180 },
  { time: 3.45, hip: [194, 218], tilt: 0, heel: 0, barX: 194, elbowAngle: 180 },
  { time: 3.6, hip: [194, 218], tilt: 0, heel: 0, barX: 194, elbowAngle: 180 },
];
export function distance(a: Point, b: Point): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}
function jointBetween(a: Point, b: Point, length: number): Point {
  const d = distance(a, b);
  const h = Math.sqrt(Math.max(0, length * length - (d * d) / 4));
  return [
    (a[0] + b[0]) / 2 + ((b[1] - a[1]) / d) * h,
    (a[1] + b[1]) / 2 - ((b[0] - a[0]) / d) * h,
  ];
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function shoulder(frame: Pick<Keyframe, 'hip' | 'tilt'>): Point {
  const angle = (frame.tilt * Math.PI) / 180;
  return [
    frame.hip[0] + MOTION.torso * Math.sin(angle),
    frame.hip[1] - MOTION.torso * Math.cos(angle),
  ];
}
function barHeight(frame: Keyframe): number {
  if (frame.barY !== undefined) return frame.barY;
  const s = shoulder(frame),
    reach = 96 * Math.sin((frame.elbowAngle * Math.PI) / 360);
  const dy = Math.sqrt(Math.max(0, reach * reach - (frame.barX - s[0]) ** 2));
  return s[1] + (frame.time >= MOTION.catchTime ? -dy : dy);
}
export function snatchPose(time: number): SnatchPose {
  const t = clampTime(time, MOTION.duration);
  let end = frames.findIndex((f) => f.time >= t);
  if (end < 0) end = frames.length - 1;
  const a = frames[Math.max(0, end - 1)],
    b = frames[end];
  const progress = a.time === b.time ? 0 : (t - a.time) / (b.time - a.time);
  const mix = progress * progress * (3 - 2 * progress);
  const hip: Point = [
    lerp(a.hip[0], b.hip[0], mix),
    lerp(a.hip[1], b.hip[1], mix),
  ];
  const tilt = lerp(a.tilt, b.tilt, mix),
    s = shoulder({ hip, tilt }),
    heelLift = lerp(a.heel, b.heel, mix);
  const ankle: Point = [194, 342 - heelLift];
  const barX = lerp(a.barX, b.barX, mix);
  // Keep straight arms in the pull and locked elbows through catch/recovery.
  let barY: number;
  if (t <= 1.46) {
    const reach =
      96 * Math.sin((lerp(a.elbowAngle, b.elbowAngle, mix) * Math.PI) / 360);
    barY = s[1] + Math.sqrt(Math.max(0, reach * reach - (barX - s[0]) ** 2));
  } else if (t >= MOTION.catchTime)
    barY = s[1] - Math.sqrt(96 ** 2 - (barX - s[0]) ** 2);
  else barY = lerp(barHeight(a), barHeight(b), mix);
  const bar: Point = [barX, barY];
  const knee = jointBetween(hip, ankle, MOTION.thigh),
    elbow = jointBetween(s, bar, MOTION.upperArm);
  return {
    hip,
    shoulder: s,
    knee,
    ankle,
    elbow,
    wrist: bar,
    bar,
    head: [s[0] + 8, s[1] - 28],
    heelLift,
  };
}
export function elbowDegrees(pose: SnatchPose): number {
  const d = distance(pose.shoulder, pose.wrist);
  return (
    (Math.acos(
      Math.max(-1, Math.min(1, (48 ** 2 + 48 ** 2 - d * d) / (2 * 48 ** 2))),
    ) *
      180) /
    Math.PI
  );
}
/** The final point is the current bar position, never a future frame. */
export function barTrace(time: number): Point[] {
  const end = clampTime(time, MOTION.duration),
    points: Point[] = [];
  for (let t = 0; t < end; t += 0.04) points.push(snatchPose(t).bar);
  points.push(snatchPose(end).bar);
  return points;
}
