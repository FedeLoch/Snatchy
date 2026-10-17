import { expect, it } from 'vitest';
import {
  displayOnly,
  drawnHand,
  fuseHand,
  handAgrees,
  handOf,
  gripCenter,
  handCrop,
  mapHand,
  matchHand,
  wristBend,
} from '../../src/domain/hands';
import { selectAthlete } from '../../src/domain/pose-quality';
import { handBarPoint } from '../../src/domain/wrist-bar';
import type { Landmark, PoseSample } from '../../src/domain/vision';

const W = 1000,
  H = 1000;
function body(dx = 0, scale = 1, visibility = 0.9): Landmark[] {
  const points = Array.from({ length: 33 }, () => ({
    x: 0.5 + dx,
    y: 0.5,
    visibility,
  }));
  const set = (i: number, x: number, y: number) =>
    (points[i] = { x: 0.5 + dx + x * scale, y: 0.5 + y * scale, visibility });
  set(11, -0.05, -0.2);
  set(12, 0.05, -0.2);
  set(13, -0.08, -0.05);
  set(14, 0.08, -0.05);
  set(15, -0.1, 0.1);
  set(16, 0.1, 0.1);
  set(17, -0.11, 0.14);
  set(18, 0.11, 0.14);
  set(19, -0.1, 0.145);
  set(20, 0.1, 0.145);
  set(23, -0.04, 0.1);
  set(24, 0.04, 0.1);
  set(25, -0.04, 0.3);
  set(26, 0.04, 0.3);
  set(27, -0.04, 0.45);
  set(28, 0.04, 0.45);
  return points;
}
/** A synthetic straight hand continuing the forearm, in frame coordinates. */
function hand(wrist: Landmark, dy = 0.06, score = 0.95): Landmark[] {
  return Array.from({ length: 21 }, (_, i) => ({
    x: wrist.x + ((i % 4) - 1.5) * 0.004,
    y: wrist.y + (i === 0 ? 0 : dy * (0.4 + Math.ceil(i / 4) * 0.1)),
    visibility: score,
  }));
}

it('crops around the hand, sized from the forearm, and maps points back', () => {
  const pose = body();
  const crop = handCrop(pose, 'left', W, H)!;
  expect(crop.forearm).toBeGreaterThan(100);
  expect(crop.size).toBeGreaterThan(crop.forearm);
  const wrist = { x: pose[15].x * W, y: pose[15].y * H };
  expect(wrist.x).toBeGreaterThan(crop.x);
  expect(wrist.x).toBeLessThan(crop.x + crop.size);
  expect(wrist.y).toBeGreaterThan(crop.y);
  const mapped = mapHand([{ x: 0.5, y: 0.5 }], crop, W, H, 0.9)[0];
  expect(mapped.x * W).toBeCloseTo(crop.x + crop.size / 2);
  expect(mapped.visibility).toBe(0.9);
  pose[15] = { ...pose[15], visibility: 0.1 };
  expect(handCrop(pose, 'left', W, H)).toBeNull();
});

it('keeps only a hand whose wrist and size fit this arm', () => {
  const pose = body();
  const crop = handCrop(pose, 'left', W, H)!;
  const own = hand(pose[15]);
  const other = hand({ ...pose[15], x: pose[15].x + 0.15 });
  const tiny = hand(pose[15], 0.002);
  expect(matchHand([other, own], pose, 'left', crop, W, H)).toBe(own);
  expect(matchHand([other, tiny], pose, 'left', crop, W, H)).toBeNull();
});

it('refines pose hand points from the hand model without losing confidence', () => {
  const pose = body();
  pose[15] = { ...pose[15], visibility: 0.4 };
  const h = hand({ ...pose[15], x: pose[15].x + 0.01 });
  const fused = fuseHand(pose, 'left', h);
  expect(fused[15]).toEqual({ x: h[0].x, y: h[0].y, visibility: 0.95 });
  expect(fused[19].x).toBe(h[5].x);
  expect(fused[17].x).toBe(h[17].x);
  expect(fused[16]).toEqual(pose[16]);
  expect(pose[15].visibility).toBe(0.4);
});

it('uses both tracked palms for the bar estimate and measures wrist bend', () => {
  const pose = body();
  const left = hand(pose[15]),
    right = hand(pose[16]);
  const frame: PoseSample = {
    time: 0,
    people: 1,
    landmarks: pose,
    hands: { left, right },
  };
  const bar = handBarPoint(frame, W, H)!;
  expect(bar.left).toEqual(gripCenter(left, W, H));
  expect(bar.y).toBeGreaterThan(pose[15].y * H);
  const bend = wristBend(frame, 'left', W, H)!;
  expect(bend).toBeGreaterThanOrEqual(0);
  expect(bend).toBeLessThan(30);
  // A single tracked hand never replaces the two-hand pose fallback.
  const one = handBarPoint({ ...frame, hands: { left } }, W, H)!;
  expect(one.left.x).toBeCloseTo(
    ((pose[15].x + pose[17].x + pose[19].x) / 3) * W,
  );
});

it('selects the lifter among several detections instead of dropping the frame', () => {
  const athlete = body(0, 1);
  const bystander = body(0.35, 0.5);
  expect(selectAthlete([athlete], null)).toBe(athlete);
  expect(selectAthlete([bystander, athlete], null)).toBe(athlete);
  // A duplicate detection of the same body is not a second person.
  const duplicate = body(0.005, 1, 0.8);
  expect(selectAthlete([duplicate, athlete], null)).toBe(athlete);
  // Two similar-sized people with no history stay ambiguous.
  const twin = body(0.35, 1);
  expect(selectAthlete([athlete, twin], null)).toBeNull();
  // Continuity resolves them once the lifter has been identified.
  const moved = body(0.01, 1);
  expect(selectAthlete([twin, moved], athlete)).toBe(moved);
});

it('marks far matches display-only and rejects impossible wrist bends', () => {
  const pose = body();
  const crop = handCrop(pose, 'left', W, H)!;
  const near = hand({ ...pose[15], x: pose[15].x + 0.01 });
  const far = hand({ ...pose[15], x: pose[15].x + (crop.forearm * 0.6) / W });
  expect(handAgrees(near, pose, 'left', crop, W, H)).toBe(true);
  expect(handAgrees(far, pose, 'left', crop, W, H)).toBe(false);
  const shown = displayOnly(far);
  const frame: PoseSample = {
    time: 0,
    people: 1,
    landmarks: pose,
    hands: { left: shown },
  };
  expect(drawnHand(frame, 'left')).toBe(shown);
  expect(handOf(frame, 'left')).toBeNull();
  // A hand folded back along the forearm is a mis-fit, not a measurement.
  const folded = hand(pose[15], -0.06);
  expect(
    wristBend({ ...frame, hands: { left: folded } }, 'left', W, H),
  ).toBeNull();
});
