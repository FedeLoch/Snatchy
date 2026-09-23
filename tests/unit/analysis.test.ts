import { describe, expect, it } from 'vitest';
import { snatchDemo } from '../../src/data/snatch';
import {
  clampTime,
  isAnalysis,
  loopWindow,
  phaseAt,
} from '../../src/domain/analysis';
import {
  availableMovements,
  getMovement,
  movements,
  requireMovement,
} from '../../src/domain/movements';
import { escapeHtml } from '../../src/ui/html';
describe('movement registry', () => {
  it('enables supported recorded movements while retaining the Snatch demo', () => {
    expect(availableMovements().map((m) => m.id)).toEqual(
      expect.arrayContaining([
        'snatch',
        'high-hang-snatch',
        'clean',
        'power-clean',
        'hang-clean',
      ]),
    );
    expect(movements).toHaveLength(15);
    expect(requireMovement('snatch').drills).toHaveLength(3);
  });
  it('rejects unknown and planned movements', () => {
    expect(getMovement('unknown')).toBeUndefined();
    expect(() => requireMovement('jerk')).toThrow('not available');
    expect(() => requireMovement('unknown')).toThrow();
  });
  it('has unique ids and all demo drill references resolve', () => {
    expect(new Set(movements.map((m) => m.id)).size).toBe(movements.length);
    const movement = requireMovement(snatchDemo.movementId);
    for (const issue of snatchDemo.issues)
      for (const id of issue.drillIds)
        expect(movement.drills.some((d) => d.id === id)).toBe(true);
  });
});
describe('analysis contract and timeline', () => {
  it('retains every score and issue from the brief', () => {
    expect(isAnalysis(snatchDemo)).toBe(true);
    expect(snatchDemo.score).toBe(83);
    expect(snatchDemo.phases.map((p) => p.score)).toEqual([
      94, 91, 86, 72, 76, 84, 92,
    ]);
    expect(snatchDemo.issues.map((i) => i.name)).toEqual([
      'Early arm bend',
      'Forward bar drift',
      'Slow turnover',
    ]);
  });
  it('selects exact boundaries and issue timestamps', () => {
    for (const p of snatchDemo.phases)
      expect(phaseAt(snatchDemo, p.start).id).toBe(p.id);
    for (const i of snatchDemo.issues)
      expect(phaseAt(snatchDemo, i.time).id).toBe(i.phaseId);
    expect(phaseAt(snatchDemo, -10).id).toBe('setup');
    expect(phaseAt(snatchDemo, 99).id).toBe('recovery');
  });
  it.each([
    [NaN, 3.6, 0],
    [Infinity, 3.6, 0],
    [-1, 3.6, 0],
    [8, 3.6, 3.6],
    [1.34, 3.6, 1.34],
    [1, 0, 0],
    [1, -1, 0],
    [1, NaN, 0],
  ])('clamps %s with duration %s', (t, d, expected) =>
    expect(clampTime(t, d)).toBe(expected),
  );
  it('keeps slow-motion loops inside short and end-of-clip bounds', () => {
    expect(loopWindow(0.1, 3.6)).toEqual([0, 0.5]);
    expect(loopWindow(3.5, 3.6)).toEqual([3.1, 3.6]);
    expect(loopWindow(1.34, 0.5)).toEqual([0.09999999999999998, 0.5]);
  });
  it.each([
    null,
    {},
    [],
    { ...snatchDemo, version: 2 },
    { ...snatchDemo, simulated: false },
    { ...snatchDemo, score: 101 },
    { ...snatchDemo, duration: 0 },
    { ...snatchDemo, phases: [] },
    { ...snatchDemo, phases: [{ ...snatchDemo.phases[0], start: 0.2 }] },
    { ...snatchDemo, phases: [snatchDemo.phases[0], snatchDemo.phases[0]] },
    {
      ...snatchDemo,
      issues: [{ ...snatchDemo.issues[0], phaseId: 'unknown' }],
    },
    { ...snatchDemo, issues: [{ ...snatchDemo.issues[0], time: 9 }] },
    { ...snatchDemo, issues: [snatchDemo.issues[0], snatchDemo.issues[0]] },
    { ...snatchDemo, metrics: [{ label: 'x', value: NaN, unit: 'm' }] },
  ])('rejects malformed persisted analysis %#', (value) =>
    expect(isAnalysis(value)).toBe(false),
  );
  it('escapes imported text before inserting HTML', () =>
    expect(escapeHtml(`<script title="'">&`)).toBe(
      '&lt;script title=&quot;&#39;&quot;&gt;&amp;',
    ));
});

it('rejects unsafe persisted identifiers before they reach DOM attributes', () => {
  expect(
    isAnalysis({
      ...snatchDemo,
      phases: [{ ...snatchDemo.phases[0], id: 'bad" onclick="alert(1)' }],
    }),
  ).toBe(false);
});
