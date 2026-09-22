import { describe, expect, it } from 'vitest';
import {
  barTrace,
  distance,
  elbowDegrees,
  MOTION,
  snatchPose,
} from '../../src/domain/snatch-motion';
import { poseSvg, snatchBarPathSvg } from '../../src/ui/pose';
describe('Snatch demo physical invariants', () => {
  it('keeps body segments fixed throughout the entire lift', () => {
    for (let t = 0; t <= 3.6; t += 0.01) {
      const p = snatchPose(t);
      expect(distance(p.hip, p.shoulder), `torso at ${t}`).toBeCloseTo(
        MOTION.torso,
        5,
      );
      expect(distance(p.hip, p.knee), `thigh at ${t}`).toBeCloseTo(
        MOTION.thigh,
        5,
      );
      expect(distance(p.knee, p.ankle), `shin at ${t}`).toBeCloseTo(
        MOTION.shin,
        5,
      );
      expect(distance(p.shoulder, p.elbow), `upper arm at ${t}`).toBeCloseTo(
        MOTION.upperArm,
        5,
      );
      expect(distance(p.elbow, p.wrist), `forearm at ${t}`).toBeCloseTo(
        MOTION.forearm,
        5,
      );
      expect(p.wrist).toEqual(p.bar);
      expect(p.bar[1] + MOTION.plateRadius).toBeLessThanOrEqual(
        MOTION.floor + 0.001,
      );
      for (const joint of [
        p.head,
        p.shoulder,
        p.hip,
        p.knee,
        p.ankle,
        p.elbow,
        p.bar,
      ])
        expect(joint.every(Number.isFinite)).toBe(true);
    }
  });
  it('holds setup with plates on the floor and straight arms until the pull', () => {
    expect(snatchPose(0)).toEqual(snatchPose(0.44));
    expect(snatchPose(0).bar[1] + MOTION.plateRadius).toBeCloseTo(
      MOTION.floor,
      5,
    );
    for (const t of [0, 0.45, 0.8, 0.95, 1.08, 1.25])
      expect(elbowDegrees(snatchPose(t))).toBeCloseTo(180, 4);
  });
  it('reproduces the selected early arm bend at its timestamp', () =>
    expect(elbowDegrees(snatchPose(1.34))).toBeCloseTo(153, 5));
  it('extends before pulling under, instead of pressing from a squat', () => {
    const extension = snatchPose(1.6),
      turnover = snatchPose(1.85),
      caught = snatchPose(2.15);
    expect(turnover.hip[1]).toBeGreaterThan(extension.hip[1]);
    expect(turnover.bar[1]).toBeLessThan(extension.bar[1]);
    expect(caught.hip[1]).toBeGreaterThan(caught.knee[1]);
    expect(caught.bar[1]).toBeLessThan(caught.head[1]);
    expect(elbowDegrees(caught)).toBeCloseTo(180, 4);
  });
  it('holds the overhead catch and stands with the elbows locked and bar balanced', () => {
    expect(snatchPose(2.15)).toEqual(snatchPose(2.7));
    for (let t = 2.15; t <= 3.6; t += 0.01) {
      const p = snatchPose(t);
      expect(elbowDegrees(p)).toBeCloseTo(180, 4);
      expect(p.bar[0]).toBeCloseTo(p.ankle[0], 5);
    }
    const final = snatchPose(3.6);
    expect(final.hip[0]).toBe(final.ankle[0]);
    expect(final.shoulder[0]).toBe(final.hip[0]);
    expect(final.bar[1]).toBeLessThan(snatchPose(2.8).bar[1]);
  });
  it('does not teleport at phase/keyframe boundaries', () => {
    for (const t of [
      0.45, 0.85, 0.95, 1.08, 1.25, 1.34, 1.46, 1.6, 1.65, 1.85, 2.02, 2.15,
      2.8, 3.45,
    ]) {
      const before = snatchPose(t - 0.0001),
        after = snatchPose(t + 0.0001);
      for (const key of ['hip', 'shoulder', 'knee', 'elbow', 'bar'] as const)
        expect(
          distance(before[key], after[key]),
          `${key} at ${t}`,
        ).toBeLessThan(0.1);
    }
  });
  it('clamps invalid and out-of-range timestamps', () => {
    expect(snatchPose(-1)).toEqual(snatchPose(0));
    expect(snatchPose(NaN)).toEqual(snatchPose(0));
    expect(snatchPose(50)).toEqual(snatchPose(3.6));
  });
  it('draws only elapsed bar positions and ends exactly at the visible bar', () => {
    expect(barTrace(0)).toEqual([snatchPose(0).bar]);
    for (const t of [0.45, 1.34, 2.15, 3.6]) {
      const points = barTrace(t);
      expect(points.at(-1)).toEqual(snatchPose(t).bar);
      expect(points.length).toBeLessThanOrEqual(Math.ceil(t / 0.04) + 2);
    }
  });
  it('renders a visible barbell, a computed elbow angle, and a switchable overlay', () => {
    const html = poseSvg(1.34, true, 'elbow');
    expect(html).toContain('153°');
    expect(html).toContain('data-barbell');
    expect(html).not.toMatch(/NaN|Infinity/);
    expect(poseSvg(0, false)).toContain('data-overlay="false"');
    expect(poseSvg(1.08, true, 'bar')).toContain('BAR');
    expect(poseSvg(1.85, true, 'shoulder')).not.toContain('153°');
    expect(snatchBarPathSvg()).toContain('matching the demo motion');
  });
});
