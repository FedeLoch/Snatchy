import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { liftFrames } from '../fixtures/lift-pose';
test.setTimeout(120000);
async function poseFixture(page: import('@playwright/test').Page) {
  await page.route('**/assets/pose.worker-*.js', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `const frames=${JSON.stringify(liftFrames())};self.onmessage=event=>{const m=event.data;if(m.type==='init'){self.postMessage({id:m.id,people:0,landmarks:[]});return;}const f=frames[Math.min(frames.length-1,Math.round(m.time*15))];m.bitmap.close();self.postMessage({id:m.id,people:1,landmarks:f.landmarks});};`,
    }),
  );
  await page.goto('/#capture');
  await page
    .locator('#import')
    .setInputFiles(resolve('tests/fixtures/plate.mp4'));
  await page
    .getByRole('button', { name: 'Analyze this video', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Your movement.', exact: true }),
  ).toBeVisible();
}
test('real result exposes measured phases, seeking, checks and saved summaries', async ({
  page,
}) => {
  await poseFixture(page);
  await expect(
    page.getByRole('heading', { name: 'Movement phases', exact: true }),
  ).toBeVisible();
  await expect(page.locator('[data-cv-phase]')).toHaveCount(7);
  await expect(page.locator('.measured-score .score')).toContainText('100');
  await expect(page.locator('.measured-issue')).toHaveCount(5);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByLabel('Experimental movement check score'),
  ).toContainText('100');
  await page.locator('[data-cv-phase="Catch"]').click();
  await expect
    .poll(() =>
      page
        .locator('#cv-video')
        .evaluate((v) => (v as HTMLVideoElement).currentTime),
    )
    .toBeCloseTo(1, 1);
  await expect(page.locator('#cv-phase-reading')).toContainText('Catch');
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
  await expect(
    page.getByLabel('Experimental movement check score'),
  ).toContainText('100');
});
test('calibrates and tracks actual moving pixels, requires review, and persists bar measurements', async ({
  page,
}) => {
  await poseFixture(page);
  await page.getByRole('button', { name: 'Calibrate and track bar' }).click();
  await expect(
    page.getByRole('button', { name: 'Track marked plate' }),
  ).toBeEnabled();
  await page.getByLabel('Center X (%)', { exact: true }).fill('50');
  await page.getByLabel('Center Y (%)', { exact: true }).fill('75');
  await page
    .getByLabel('Plate radius (% of frame width)', { exact: true })
    .fill('6.25');
  await page
    .getByLabel('Actual plate diameter (cm)', { exact: true })
    .fill('40');
  await page.getByLabel('Track until (seconds)', { exact: true }).fill('1.8');
  await page.locator('#bar-static').check();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.getByRole('button', { name: 'Track marked plate' }).click();
  await expect(page.locator('#bar-review')).toBeVisible({ timeout: 30000 });
  await expect(
    page.getByRole('button', { name: 'Use reviewed measurements' }),
  ).toBeDisabled();
  await page.locator('#bar-scrub').press('ArrowRight');
  await expect(page.locator('#bar-time')).not.toHaveText('0.00 s');
  await page.locator('#bar-verified').check();
  await page.getByRole('button', { name: 'Use reviewed measurements' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const bar = page.getByRole('region', { name: 'Measured bar path' });
  await expect(bar).toContainText('0.54');
  await expect(bar).toContainText('0.30');
  await expect(bar.locator('svg')).toBeVisible();
  await page.reload();
  await expect(bar).toContainText('0.54');
});
test('demo retains its original score, phase numbers, feedback and bar values', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore the Snatch demo' }).click();
  await expect(page.getByLabel('Score 83 out of 100')).toBeVisible();
  await expect(page.locator('.timeline b')).toHaveText([
    '94',
    '91',
    '86',
    '72',
    '76',
    '84',
    '92',
  ]);
  await expect(
    page.getByRole('button', { name: /Early arm bend/ }),
  ).toBeVisible();
  await expect(page.locator('.bar-metrics')).toContainText('6.4');
  await expect(page.locator('.bar-metrics')).toContainText('1.24');
  await expect(page.locator('.bar-metrics')).toContainText('1.82');
});
