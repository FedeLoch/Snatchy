import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
test.setTimeout(120000);
test('real local model detects a person, overlays actual frames, and saves measured summaries', async ({
  page,
}) => {
  const outbound: string[] = [];
  page.on('request', (request) => {
    if (
      !request.url().startsWith('http://127.0.0.1:4173') &&
      !request.url().startsWith('blob:') &&
      !request.url().startsWith('data:')
    )
      outbound.push(request.url());
  });
  await page.goto('/#capture');
  await page
    .locator('#import')
    .setInputFiles(resolve('tests/fixtures/person.mp4'));
  await page
    .getByRole('button', { name: 'Analyze this video', exact: true })
    .click();
  await expect(
    page.locator('#cv-video, #capture-error:not(:empty)'),
  ).toHaveCount(1, { timeout: 90000 });
  await expect(page.locator('#capture-error')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Your movement.', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Your analyzed lift video')).toBeVisible();
  await expect
    .poll(() => page.locator('#cv-overlay circle').count())
    .toBeGreaterThan(0);
  await expect(page.getByText('No technique score assigned')).toBeVisible();
  await expect(
    page.locator('.score, #pose-frame, [data-motion-time]'),
  ).toHaveCount(0);
  await expect(page.locator('.live-angles')).toContainText('°');
  await page.getByRole('button', { name: 'Playback speed: 1×' }).click();
  expect(
    await page
      .locator('#cv-video')
      .evaluate((v) => (v as HTMLVideoElement).playbackRate),
  ).toBe(0.5);
  await page.getByRole('button', { name: 'Tracked pose on' }).click();
  await expect(page.locator('#cv-overlay circle')).toHaveCount(0);
  await page.getByRole('button', { name: 'Tracked pose off' }).click();
  await expect
    .poll(() => page.locator('#cv-overlay circle').count())
    .toBeGreaterThan(0);
  expect(outbound).toEqual([]);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.reload();
  await expect(page.getByText('Saved measurement summary')).toBeVisible();
  await expect(page.locator('#cv-video')).toHaveCount(0);
  await expect(page.locator('.score, [data-motion-time]')).toHaveCount(0);
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'History' })
    .click();
  await expect(
    page.getByRole('link', { name: 'Open measured pose analysis' }),
  ).toHaveCount(1);
});
test('blank video receives no pose, technique score or invented observations', async ({
  page,
}) => {
  await page.goto('/#capture');
  await page
    .locator('#import')
    .setInputFiles(resolve('tests/fixtures/short.mp4'));
  await page
    .getByRole('button', { name: 'Analyze this video', exact: true })
    .click();
  await expect(
    page.locator('#cv-video, #capture-error:not(:empty)'),
  ).toHaveCount(1, { timeout: 90000 });
  await expect(page.locator('#capture-error')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Limited tracking.', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Not enough reliable evidence')).toBeVisible();
  await expect(
    page.locator('.measured-event, #cv-overlay circle, .score'),
  ).toHaveCount(0);
  await expect(page.locator('.quality-summary')).toContainText('0%');
});
test('cancelling real inference keeps the clip reviewable and saves no result', async ({
  page,
}) => {
  await page.goto('/#capture');
  await page
    .locator('#import')
    .setInputFiles(resolve('tests/fixtures/person.mp4'));
  await page
    .getByRole('button', { name: 'Analyze this video', exact: true })
    .click();
  await page.getByRole('button', { name: 'Cancel analysis' }).click();
  await expect(page.getByLabel('Review your lift video')).toBeVisible();
  expect(
    await page.evaluate(() =>
      localStorage.getItem('snatchy-vision-history-v1'),
    ),
  ).toBeNull();
});
test('model loading failures preserve the clip and offer a retry', async ({
  page,
}) => {
  await page.route('**/models/*.task', (route) => route.abort());
  await page.goto('/#capture');
  await page
    .locator('#import')
    .setInputFiles(resolve('tests/fixtures/person.mp4'));
  await page
    .getByRole('button', { name: 'Analyze this video', exact: true })
    .click();
  await expect(page.locator('#capture-error')).not.toHaveText('', {
    timeout: 90000,
  });
  await expect(page.getByLabel('Review your lift video')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Analyze this video', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.score')).toHaveCount(0);
});
