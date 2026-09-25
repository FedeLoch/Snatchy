import { cleanFrames } from '../fixtures/clean-pose';
import { recordedTraces, recordedFrames } from '../fixtures/recorded-pose';
import { analyzePoseSamples } from '../../src/domain/vision';
import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { liftFrames } from '../fixtures/lift-pose';
test.setTimeout(120000);
async function poseFixture(
  page: import('@playwright/test').Page,
  frames = liftFrames(),
  file = 'plate.mp4',
  exercise = 'auto',
) {
  await page.route('**/assets/pose.worker-*.js', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `const frames=${JSON.stringify(frames)};self.onmessage=event=>{const m=event.data;if(m.type==='init'){self.postMessage({id:m.id,people:0,landmarks:[]});return;}const f=frames[Math.min(frames.length-1,Math.round(m.time*15))];m.bitmap.close();self.postMessage({id:m.id,people:1,landmarks:f.landmarks});};`,
    }),
  );
  await page.goto('/#capture');
  await page
    .locator('#import')
    .setInputFiles(resolve('tests/fixtures/' + file));
  await page.getByLabel('Movement', { exact: true }).selectOption(exercise);
  await page
    .getByRole('button', { name: 'Analyze this video', exact: true })
    .click();
  await expect(page.locator('.result-heading h1')).toBeVisible();
}
test('real result exposes measured phases, seeking, checks and saved summaries', async ({
  page,
}) => {
  await poseFixture(page);
  await expect(
    page.getByRole('heading', { name: 'Movement phases', exact: true }),
  ).toBeVisible();
  await expect(page.locator('[data-cv-phase]')).toHaveCount(7);
  await expect(page.locator('[data-measured-score]')).toHaveText(
    /^80\s*\/\s*100$/,
  );
  await expect(page.locator('.measured-issue')).toHaveCount(5);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(page.locator('[data-measured-score]')).toHaveText(
    /^80\s*\/\s*100$/,
  );
  await page.locator('[data-cv-phase="Catch"]').click();
  await expect
    .poll(() =>
      page
        .locator('#cv-video')
        .evaluate((v) => (v as HTMLVideoElement).currentTime),
    )
    .toBeCloseTo(1, 1);
  await expect(
    page.getByRole('heading', { name: 'Follow the bar', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'The details that matter' }),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.reload();
  await expect(page.locator('[data-cv-phase="Catch"]')).toBeDisabled();
  await expect(page.locator('[data-cv-phase="Catch"]')).toContainText('1.00 s');
  await expect(page.locator('[data-measured-score]')).toHaveText(
    /^80\s*\/\s*100$/,
  );
});
test('automatic wrist metrics appear first, mobile score aligns with title, and history retains scores', async ({
  page,
}) => {
  await poseFixture(page);
  const bar = page.getByRole('region', { name: 'Estimated bar path' });
  await expect(bar).toContainText('WRIST-LINE ESTIMATE');
  await expect(
    page.getByRole('button', { name: 'Calibrate and track bar' }),
  ).toHaveCount(0);
  const b = await bar.boundingBox(),
    details = await page
      .getByRole('region', { name: 'Technique observations' })
      .boundingBox();
  // Both cards live in the same feedback column: the observations card is
  // authored first, so the estimated bar path follows it.
  expect(b!.y).toBeGreaterThan(details!.y);
  const title = await page.locator('.result-heading h1').boundingBox(),
    score = await page.locator('[data-measured-score]').boundingBox();
  expect(Math.abs(title!.y - score!.y)).toBeLessThan(8);
  await expect(page.locator('.result-heading h1')).toHaveText('Good lift.');
  await page.getByRole('link', { name: 'Your lifts', exact: true }).click();
  await expect(page.locator('.lift-score')).toHaveText(/^80\s*\/100$/);
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Home' })
    .click();
  await expect(page.locator('.recent-section .lift-score')).toHaveText(
    /^80\s*\/100$/,
  );
});
test('partial scores list missing phases, remain accessible and survive reload', async ({
  page,
}) => {
  await poseFixture(page, liftFrames().slice(0, 20));
  await expect(page.locator('[data-measured-score]')).toHaveText(
    /^100\*\s*\/\s*100$/,
  );
  await expect(
    page.getByLabel('Partial analysis', { exact: true }),
  ).toBeVisible();
  await page.locator('.partial-score-note summary').click();
  await expect(page.locator('.partial-score-note')).toContainText(
    'Phases not recognized: Recovery',
  );
  await expect(page.locator('.partial-score-note')).toContainText(
    '4 of 5 checks available',
  );
  await expect(page.locator('[data-cv-phase="Recovery"]')).toBeDisabled();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.reload();
  await expect(page.locator('[data-measured-score]')).toHaveText(
    /^100\*\s*\/\s*100$/,
  );
  await page.locator('.partial-score-note summary').click();
  await expect(page.locator('.partial-score-note')).toContainText(
    'Phases not recognized: Recovery',
  );
  await page.getByRole('link', { name: 'Your lifts', exact: true }).click();
  await expect(page.locator('.lift-score')).toHaveText(/^100\s*\/100$/);
  await expect(page.locator('.lift-description')).toContainText(
    'Partial analysis',
  );
});

test('isolates multiple repetitions, switches measured results, and preserves per-rep summaries', async ({
  page,
}) => {
  const frames = Array.from({ length: 60 }, (_, i) => ({
    time: i / 15,
    people: 0,
    landmarks: [] as ReturnType<typeof liftFrames>[number]['landmarks'],
  }));
  for (const offset of [0, 33])
    liftFrames().forEach((f, i) => {
      frames[offset + i] = { ...f, time: (offset + i) / 15 };
    });
  await poseFixture(page, frames, 'lift.mp4');
  const selector = page.getByRole('navigation', {
    name: 'Detected repetitions',
  });
  await expect(selector.getByRole('button')).toHaveCount(2);
  await selector
    .getByRole('button', { name: /Rep 2/ })
    .click({ timeout: 10000 });
  await expect(page.locator('[data-cv-phase="Catch"]')).toContainText('3.20 s');
  await expect(page.locator('[data-measured-score]')).toHaveText(
    /^80\*\s*\/\s*100$/,
  );
  await page.locator('[data-cv-phase="Catch"]').click();
  await expect
    .poll(() =>
      page
        .locator('#cv-video')
        .evaluate((v) => (v as HTMLVideoElement).currentTime),
    )
    .toBeCloseTo(3.2);
  await page.reload();
  await selector
    .getByRole('button', { name: /Rep 2/ })
    .click({ timeout: 10000 });
  await expect(page.locator('[data-cv-phase="Catch"]')).toContainText('3.20 s');
  await expect(page.locator('[data-cv-phase="Catch"]')).toBeDisabled();
});

test('auto-detects cleans and recalculates the selected variant without uploading again', async ({
  page,
}) => {
  await poseFixture(page, cleanFrames());
  await expect(page.locator('#result-exercise option:checked')).toContainText(
    'Clean',
  );
  await expect(
    page.getByRole('region', { name: 'Technique observations' }),
  ).toContainText('Front-rack arm flexion');
  await page.locator('#result-exercise').selectOption('high-hang-clean');
  await expect(page.locator('[data-cv-phase="First pull"]')).toContainText(
    'N/A',
  );
  await expect(page.locator('[data-cv-phase="Transition"]')).toContainText(
    'N/A',
  );
  await expect(page.locator('#result-exercise')).toBeFocused();
  await page.reload();
  await expect(page.locator('#result-exercise')).toHaveValue('high-hang-clean');
  await expect(page.locator('[data-cv-phase="First pull"]')).toContainText(
    'N/A',
  );
});

for (const trace of recordedTraces) {
  test(`recorded ${trace.name} summary explains missing transition and estimated upper pull`, async ({
    page,
  }) => {
    const analysis = analyzePoseSamples(
      recordedFrames(trace),
      trace.width,
      trace.height,
      trace.duration,
    );
    await page.addInitScript(
      (record) => {
        localStorage.setItem(
          'snatchy-vision-history-v1',
          JSON.stringify([record]),
        );
      },
      {
        id: 'recorded-phase-case',
        createdAt: 1234,
        analysis: { ...analysis, frames: [] },
      },
    );
    await page.goto('/#vision/recorded-phase-case');
    await expect(page.locator('[data-cv-phase="Setup"]')).not.toContainText(
      '—',
    );
    await expect(page.locator('[data-cv-phase="Second pull"]')).toContainText(
      'Timing estimate',
    );
    await expect(page.locator('[data-cv-phase="Transition"]')).toContainText(
      '—',
    );
    await page
      .getByText('Phase evidence and missing-phase explanations', {
        exact: true,
      })
      .click();
    await expect(page.locator('.phase-evidence')).toContainText(
      'No distinct knee rebend',
    );
    await page.locator('.partial-score-note summary').click();
    await expect(page.locator('.partial-score-note')).toContainText(
      'Estimated phase timing:',
    );
    await expect(page.locator('.partial-score-note')).toContainText(
      '6 of 7 phases recognized',
    );
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
  });
}
