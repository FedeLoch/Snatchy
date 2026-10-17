import type { Landmark, PoseSample, Side } from './vision';

/** MediaPipe Hand Landmarker indices: 0 wrist, then four points per finger
 * from thumb (1–4) to pinky (17–20). */
export const HAND_POINTS = 21;
export const HAND_LINKS = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
] as const;

/** Pose landmarks per side: elbow, wrist, pinky, index, thumb, shoulder, hip. */
const POSE_HAND = {
  left: {
    elbow: 13,
    wrist: 15,
    pinky: 17,
    index: 19,
    thumb: 21,
    shoulder: 11,
    hip: 23,
  },
  right: {
    elbow: 14,
    wrist: 16,
    pinky: 18,
    index: 20,
    thumb: 22,
    shoulder: 12,
    hip: 24,
  },
} as const;

/** A crop only needs an approximate location, so it accepts weaker pose
 * confidence than measurements do. The hand model must confirm it. */
const LOCATE = 0.3;
const usable = (p: Landmark | undefined): p is Landmark =>
  !!p &&
  Number.isFinite(p.x) &&
  Number.isFinite(p.y) &&
  p.x > -0.1 &&
  p.x < 1.1 &&
  p.y > -0.1 &&
  p.y < 1.1 &&
  (p.visibility ?? 0) >= LOCATE;

export interface HandCrop {
  /** Top-left corner and side length in frame pixels. */
  x: number;
  y: number;
  size: number;
  /** Expected forearm length in frame pixels, used to validate the result. */
  forearm: number;
}

/** Square region around one hand, derived from the pose's arm landmarks. The
 * hand model then runs on this enlarged crop instead of the whole frame, where
 * a hand on a barbell is often only a few dozen pixels wide. */
export function handCrop(
  landmarks: Landmark[],
  side: Side,
  width: number,
  height: number,
): HandCrop | null {
  const ids = POSE_HAND[side];
  const px = (p: Landmark) => ({ x: p.x * width, y: p.y * height });
  const wristPoint = landmarks[ids.wrist];
  if (!usable(wristPoint)) return null;
  const wrist = px(wristPoint);
  const knuckles = [landmarks[ids.index], landmarks[ids.pinky]]
    .filter(usable)
    .map(px);
  const elbow = usable(landmarks[ids.elbow]) ? px(landmarks[ids.elbow]) : null;
  let forearm = elbow ? Math.hypot(wrist.x - elbow.x, wrist.y - elbow.y) : 0;
  if (knuckles.length) {
    const reach = Math.max(
      ...knuckles.map((k) => Math.hypot(k.x - wrist.x, k.y - wrist.y)),
    );
    // Wrist-to-knuckle is roughly a third of the forearm; use it when the
    // forearm is foreshortened or the elbow is missing.
    forearm = Math.max(forearm, reach * 3);
  }
  if (forearm < 1) {
    const s = landmarks[ids.shoulder],
      h = landmarks[ids.hip];
    if (usable(s) && usable(h))
      forearm = Math.hypot((s.x - h.x) * width, (s.y - h.y) * height) * 0.5;
  }
  if (forearm < 1) return null;
  let center = wrist;
  if (knuckles.length) {
    const k = {
      x: knuckles.reduce((sum, p) => sum + p.x, 0) / knuckles.length,
      y: knuckles.reduce((sum, p) => sum + p.y, 0) / knuckles.length,
    };
    center = {
      x: wrist.x + (k.x - wrist.x) * 0.8,
      y: wrist.y + (k.y - wrist.y) * 0.8,
    };
  } else if (elbow) {
    const length = Math.hypot(wrist.x - elbow.x, wrist.y - elbow.y) || 1;
    const reach = forearm * 0.3;
    center = {
      x: wrist.x + ((wrist.x - elbow.x) / length) * reach,
      y: wrist.y + ((wrist.y - elbow.y) / length) * reach,
    };
  }
  const size = Math.max(40, forearm * 1.6);
  return { x: center.x - size / 2, y: center.y - size / 2, size, forearm };
}

/** The same hand region with more surrounding context. Palm detection
 * misses some tightly cropped fists that it finds in a wider view. */
export function widenCrop(crop: HandCrop, factor: number): HandCrop {
  const size = crop.size * factor;
  return {
    x: crop.x + (crop.size - size) / 2,
    y: crop.y + (crop.size - size) / 2,
    size,
    forearm: crop.forearm,
  };
}

/** Map crop-normalized hand landmarks back to frame-normalized coordinates. */
export function mapHand(
  points: { x: number; y: number }[],
  crop: HandCrop,
  width: number,
  height: number,
  score: number,
): Landmark[] {
  return points.map((p) => ({
    x: (crop.x + p.x * crop.size) / width,
    y: (crop.y + p.y * crop.size) / height,
    visibility: score,
  }));
}

/** Pick the detected hand that belongs to this arm. The model's own
 * handedness label is unreliable on mirrored or rear views, so ownership
 * comes from geometry: its wrist must be closer to this arm's pose wrist than
 * to the other arm's, within reach of it, and its size plausible for the
 * forearm. The projected forearm is often foreshortened and the pose wrist
 * lags in fast motion, so the reach allowance is generous. */
export function matchHand(
  candidates: Landmark[][],
  landmarks: Landmark[],
  side: Side,
  crop: HandCrop,
  width: number,
  height: number,
): Landmark[] | null {
  const poseWrist = landmarks[POSE_HAND[side].wrist];
  if (!poseWrist) return null;
  const otherWrist =
    landmarks[POSE_HAND[side === 'left' ? 'right' : 'left'].wrist];
  const distance = (a: Landmark, b: Landmark) =>
    Math.hypot((a.x - b.x) * width, (a.y - b.y) * height);
  let best: Landmark[] | null = null,
    bestDistance = Infinity;
  for (const hand of candidates) {
    if (hand.length !== HAND_POINTS) continue;
    const palm = distance(hand[0], hand[9]);
    if (palm < crop.forearm * 0.08 || palm > crop.forearm * 1.2) continue;
    const gap = distance(hand[0], poseWrist);
    if (gap > crop.forearm * 0.8) continue;
    if (usable(otherWrist) && distance(hand[0], otherWrist) <= gap) continue;
    if (gap < bestDistance) {
      best = hand;
      bestDistance = gap;
    }
  }
  return best;
}

/** Replace the pose's coarse hand points with the dedicated hand model's
 * estimates. The hand model sees the hand at much higher resolution, so its
 * wrist and knuckles are the more precise observation; the pose model's
 * visibility is kept unless the hand model is more confident. */
export function fuseHand(
  landmarks: Landmark[],
  side: Side,
  hand: Landmark[],
): Landmark[] {
  const ids = POSE_HAND[side];
  const out = landmarks.map((p) => ({ ...p }));
  const replace = (id: number, from: Landmark) => {
    if (!out[id]) return;
    out[id] = {
      x: from.x,
      y: from.y,
      visibility: Math.max(out[id].visibility, from.visibility),
    };
  };
  replace(ids.wrist, hand[0]);
  replace(ids.index, hand[5]);
  replace(ids.pinky, hand[17]);
  replace(ids.thumb, hand[2]);
  return out;
}

/** A matched hand may only refine measurements when its wrist agrees with
 * the pose wrist. A farther match is still the athlete's hand and is drawn,
 * but moving the wrist that far on one model's word would change elbow
 * angles and phase timing without independent support. */
export function handAgrees(
  hand: Landmark[],
  landmarks: Landmark[],
  side: Side,
  crop: HandCrop,
  width: number,
  height: number,
): boolean {
  const wrist = landmarks[POSE_HAND[side].wrist];
  return (
    !!wrist &&
    Math.hypot((hand[0].x - wrist.x) * width, (hand[0].y - wrist.y) * height) <=
      crop.forearm * 0.35
  );
}
/** Display-only hands carry a confidence below the measurement threshold. */
export function displayOnly(hand: Landmark[]): Landmark[] {
  return hand.map((p) => ({
    ...p,
    visibility: Math.min(p.visibility, HAND_VISIBILITY / 2),
  }));
}

export const HAND_VISIBILITY = 0.5;
/** Any tracked hand, including display-only ones, for the replay overlay. */
export function drawnHand(frame: PoseSample, side: Side): Landmark[] | null {
  const hand = frame.hands?.[side];
  return hand?.length === HAND_POINTS ? hand : null;
}
export function handOf(frame: PoseSample, side: Side): Landmark[] | null {
  const hand = frame.hands?.[side];
  return hand &&
    hand.length === HAND_POINTS &&
    hand.every(
      (p) =>
        Number.isFinite(p.x) &&
        Number.isFinite(p.y) &&
        p.visibility >= HAND_VISIBILITY,
    )
    ? hand
    : null;
}

/** Where the bar sits in the hand: across the palm just below the knuckle
 * line, which is closer to the bar than the wrist joint. Frame pixels. */
export function gripCenter(
  hand: Landmark[],
  width: number,
  height: number,
): { x: number; y: number } {
  const knuckles = [5, 9, 13, 17].map((i) => hand[i]);
  const kx = knuckles.reduce((s, p) => s + p.x, 0) / 4,
    ky = knuckles.reduce((s, p) => s + p.y, 0) / 4;
  return {
    x: (hand[0].x * 0.25 + kx * 0.75) * width,
    y: (hand[0].y * 0.25 + ky * 0.75) * height,
  };
}

/** Projected wrist bend: 0° is a straight forearm-to-hand line, larger values
 * mean more flexion or extension. Image-plane only; the sign is not resolved. */
export function wristBend(
  frame: PoseSample,
  side: Side,
  width: number,
  height: number,
): number | null {
  const hand = handOf(frame, side);
  const elbow = frame.landmarks[POSE_HAND[side].elbow];
  if (!hand || !elbow || elbow.visibility < 0.65) return null;
  const w = hand[0],
    m = hand[9];
  const u = [(elbow.x - w.x) * width, (elbow.y - w.y) * height],
    v = [(m.x - w.x) * width, (m.y - w.y) * height];
  const d = Math.hypot(u[0], u[1]) * Math.hypot(v[0], v[1]);
  if (d < 1e-6) return null;
  const angle =
    (Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / d))) *
      180) /
    Math.PI;
  // Wrists extend or flex roughly 90° at most; a larger projected bend is
  // a mis-fit hand or an extreme camera angle, not a measurement.
  const bend = 180 - angle;
  return bend <= MAX_WRIST_BEND ? bend : null;
}
export const MAX_WRIST_BEND = 100;
