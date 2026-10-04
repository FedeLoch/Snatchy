import { it, expect } from 'vitest';
import { analyzePoseSamples } from '../../src/domain/vision';
import { liftFrames } from '../fixtures/lift-pose';
import {
  techniqueScore,
  techniqueFeedback,
  measuredSummary,
  barPanel,
} from '../../src/ui/lift-analysis';
it('changes the score and feedback when the recorded joint trajectory changes', () => {
  const clear = analyzePoseSamples(liftFrames(), 100, 100, 2);
  const bent = liftFrames();
  for (const i of [5, 6, 7])
    for (const joint of [13, 14])
      bent[i].landmarks[joint] = {
        ...bent[i].landmarks[joint],
        x: bent[i].landmarks[joint].x + 0.1,
      };

  const review = analyzePoseSamples(bent, 100, 100, 2);
  expect(clear.lift?.score).toBe(100);
  expect(review.lift?.score).toBe(80);
  expect(techniqueScore(clear)).toContain('data-measured-score>100');
  expect(techniqueScore(review)).toContain('data-measured-score>80');
  expect(measuredSummary(clear)).toContain('All 5');
  expect(measuredSummary(review)).toContain('1 measured check needs review');
  const dom = document.createElement('div');
  dom.innerHTML = techniqueFeedback(review, true);
  expect(dom.querySelector('details[open]')?.textContent).toContain(
    'Arms through the pull',
  );
  expect(dom.querySelectorAll('details.measured-issue[open]')).toHaveLength(1);
  expect(techniqueFeedback(clear, true)).not.toContain(
    'details class="issue measured-issue" open',
  );
});
it('renders automatic hand estimates without calibration controls or physical units', () => {
  const a = analyzePoseSamples(liftFrames(), 100, 100, 2);
  expect(barPanel(a)).toContain('HAND-CENTER ESTIMATE');
  expect(barPanel(a)).toContain('% frame height / s');
  expect(barPanel(a)).not.toContain('data-action="track-bar"');
  expect(barPanel(analyzePoseSamples([], 100, 100, 2))).toContain(
    'No full-recording path is substituted',
  );
});

it('marks even a 100 score as partial and names missing phases', () => {
  const a = analyzePoseSamples(liftFrames().slice(0, 20), 100, 100, 2);
  const dom = document.createElement('div');
  dom.innerHTML = techniqueScore(a);
  expect(dom.querySelector('[data-measured-score]')?.textContent).toContain(
    '100',
  );
  expect(dom.querySelector('summary')?.getAttribute('aria-label')).toBe(
    'Analysis evidence and coverage',
  );
  // The disclosure shows only the glyph; the name lives on aria-label.
  expect(dom.querySelector('summary')?.textContent?.trim()).toBe('ⓘ');
  expect(dom.textContent).toContain('Phases not recognized: Recovery');
  expect(dom.textContent).toContain('4 of 5 checks available');
  expect(
    techniqueScore(analyzePoseSamples(liftFrames(), 100, 100, 2)),
  ).not.toContain('partial-score-note');
});

it('renders stick figure athlete silhouette and expected trace comparison in barPanel', () => {
  const a = analyzePoseSamples(liftFrames(), 100, 100, 2);
  const html = barPanel(a);
  expect(html).toContain('Expected trace');
  expect(html).toContain('Your estimated hand path');
  expect(html).toContain('viewBox=');
});

it('keeps the bar path traces unfilled and the corridor band filled', () => {
  const html = barPanel(analyzePoseSamples(liftFrames(), 100, 100, 2));
  const stroked = [...html.matchAll(/<path\s([^>]*?)\/?>/g)].map((m) => m[1]);
  // Traces are open polylines: a fill class would render them as blobs.
  for (const attrs of stroked) {
    if (!/\bfill="none"/.test(attrs)) continue;
    expect(attrs).not.toMatch(/class="[^"]*-fill\b/);
  }
  // The corridor band is a closed shape and must stay filled.
  expect(html).toMatch(/class="figure-reference figure-reference-fill"/);
  // Every dotted marker is a fill.
  expect(html).toMatch(/class="figure-accent-fill"/);
  expect(html).toMatch(/class="figure-silhouette-fill"/);
  expect(html).not.toMatch(/#[0-9a-f]{3,8}\b/i);
});

it('keeps the chart independent of horizontal camera framing', () => {
  const a = analyzePoseSamples(liftFrames(), 100, 100, 2);
  const moved = structuredClone(a);
  for (const p of moved.wristBar!.points) {
    p.x += 20;
    p.left.x += 20;
    p.right.x += 20;
  }
  expect(barPanel(moved)).toEqual(barPanel(a));
});

it('excludes setup and lowering points from both the plotted path and metrics', () => {
  const a = analyzePoseSamples(liftFrames(), 100, 100, 2);
  const baseline = barPanel(a);
  const changed = structuredClone(a);
  const pull = a.lift!.phases[1].start!;
  const caught = a.lift!.phases[5].start!;
  for (const p of changed.wristBar!.points)
    if (p.time < pull || p.time > caught) {
      p.x += 1000;
      p.y += 1000;
    }
  expect(barPanel(changed)).toEqual(baseline);
  changed.lift!.phases[5].start = null;
  expect(barPanel(changed)).not.toContain('class="measured-bar-path"');
  expect(barPanel(changed)).toContain('No full-recording path is substituted');
});
