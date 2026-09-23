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
  bent[5].landmarks[13] = {
    ...bent[5].landmarks[13],
    x: bent[5].landmarks[13].x + 0.1,
  };
  bent[5].landmarks[14] = {
    ...bent[5].landmarks[14],
    x: bent[5].landmarks[14].x + 0.1,
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
it('renders automatic wrist estimates without calibration controls or physical units', () => {
  const a = analyzePoseSamples(liftFrames(), 100, 100, 2);
  expect(barPanel(a, true)).toContain('WRIST-LINE ESTIMATE');
  expect(barPanel(a, true)).toContain('% frame height / s');
  expect(barPanel(a, true)).not.toContain('data-action="track-bar"');
  expect(barPanel(analyzePoseSamples([], 100, 100, 2), true)).toContain(
    'Both wrists must be visible',
  );
});

it('marks even a 100 score as partial and names missing phases', () => {
  const a = analyzePoseSamples(liftFrames().slice(0, 20), 100, 100, 2);
  const dom = document.createElement('div');
  dom.innerHTML = techniqueScore(a);
  expect(dom.querySelector('[data-measured-score]')?.textContent).toContain(
    '100',
  );
  expect(dom.querySelector('summary')?.textContent).toContain(
    'Partial analysis',
  );
  expect(dom.textContent).toContain('Phases not recognized: Recovery');
  expect(dom.textContent).toContain('4 of 5 checks available');
  expect(
    techniqueScore(analyzePoseSamples(liftFrames(), 100, 100, 2)),
  ).not.toContain('partial-score-note');
});
