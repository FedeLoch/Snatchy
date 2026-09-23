import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { snatchDemo } from '../../src/data/snatch';
import type { VisionAnalysis } from '../../src/domain/vision';
const analysis: VisionAnalysis = {
  version: 1,
  kind: 'measured-pose',
  simulated: false,
  engine: 'MediaPipe Pose Landmarker Lite',
  duration: 2,
  width: 640,
  height: 480,
  sampleRate: 15,
  sampledFrames: 30,
  usableFrames: 30,
  coverage: 1,
  side: 'left',
  status: 'tracked',
  frames: [],
  events: [],
  ranges: {
    elbow: { min: 80, max: 175, minTime: 1, maxTime: 0.5 },
    hip: { min: 70, max: 170, minTime: 1, maxTime: 0.5 },
    knee: { min: 60, max: 175, minTime: 1, maxTime: 0.5 },
  },
};
test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ({ analysis, demo }) => {
      if (localStorage.getItem('seeded')) return;
      localStorage.setItem('seeded', '1');
      localStorage.setItem(
        'snatchy-history-v2',
        JSON.stringify([
          { id: 'demo-test', createdAt: 1000, source: 'demo', analysis: demo },
        ]),
      );
      localStorage.setItem(
        'snatchy-vision-history-v1',
        JSON.stringify([{ id: 'vision-test', createdAt: 2000, analysis }]),
      );
    },
    { analysis, demo: snatchDemo },
  );
});
test('remove, undo, and persist deletions independently for both history types', async ({
  page,
}) => {
  await page.goto('/#history');
  await page
    .getByRole('button', { name: 'Remove video analysis from history' })
    .click();
  await expect(
    page.getByRole('link', { name: 'Open measured pose analysis' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Remove demo lift from history' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Undo removal' }).click();
  await expect(
    page.getByRole('link', { name: 'Open measured pose analysis' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Remove demo lift from history' })
    .click();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Remove demo lift from history' }),
  ).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Remove video analysis from history' })
    .click();
  await page.reload();
  await expect(page.getByText('Your next lift starts here.')).toBeVisible();
  await page.goto('/#vision/vision-test');
  await expect(
    page.getByText('That analysis is no longer available.'),
  ).toBeVisible();
});
test('failed persistence retains the entry and reports the failure', async ({
  page,
}) => {
  await page.goto('/#history');
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new Error('denied');
    };
  });
  await page
    .getByRole('button', { name: 'Remove video analysis from history' })
    .click();
  await expect(
    page.getByRole('link', { name: 'Open measured pose analysis' }),
  ).toBeVisible();
  await expect(
    page.getByText(
      'Could not remove this lift from device storage. Please try again.',
    ),
  ).toBeVisible();
});
test('radar shows actual values, accessible alternatives, and no invented improvement', async ({
  page,
}) => {
  await page.goto('/#vision/vision-test');
  await expect(
    page.getByRole('heading', { name: 'Movement profile' }),
  ).toBeVisible();
  await expect(page.locator('.radar-value')).toHaveCount(1);
  await expect(page.locator('.radar-values')).toContainText('95°');
  await expect(page.locator('.radar-review')).toContainText(
    'No technique improvement was established',
  );
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
});
test('insufficient tracking withholds radar and provides recording improvements', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() => {
    const records = JSON.parse(
      localStorage.getItem('snatchy-vision-history-v1')!,
    );
    records[0].analysis.status = 'insufficient';
    localStorage.setItem('snatchy-vision-history-v1', JSON.stringify(records));
  });
  await page.goto('/#vision/vision-test');
  await page.reload();
  await expect(page.locator('.radar-value')).toHaveCount(0);
  await expect(page.locator('.radar-values dd')).toHaveText(
    Array(5).fill('Unavailable'),
  );
  await expect(page.locator('.radar-review')).toContainText(
    'Improve the recording first',
  );
});
