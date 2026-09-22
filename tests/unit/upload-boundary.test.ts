import { expect, it } from 'vitest';
import { result, capture, history } from '../../src/ui/views';
import { snatch, snatchDemo } from '../../src/data/snatch';
import type { LiftRecord } from '../../src/domain/types';
it('refuses to render demo analysis for an upload, even with a supplied media URL', () => {
  const record: LiftRecord = {
    id: 'old',
    createdAt: 1234,
    source: 'video',
    analysis: snatchDemo,
  };
  const html = result(
    record,
    snatch,
    { url: 'blob:actual', name: 'lift.mp4', duration: 4 },
    'arms',
    '',
  );
  expect(html).toContain('Not analyzed');
  expect(html).not.toContain('83');
  expect(html).not.toContain('data-motion-time');
  expect(html).not.toContain('Early arm bend');
  expect(history([record], '')).not.toContain('score 83');
});
it('uploaded capture offers review and speed controls without a fake analyze action', () => {
  const html = capture(snatch, {
    url: 'blob:actual',
    name: 'lift.mp4',
    duration: 4,
  });
  expect(html).toContain('blob:actual');
  expect(html).toContain('review-speed');
  expect(html).not.toContain('data-action="analyze"');
  expect(html).not.toContain('data-motion-time');
});
