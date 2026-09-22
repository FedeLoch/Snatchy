import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { resolve } from 'node:path';
import { snatchDemo } from '../../src/data/snatch';
const videoPath = resolve('tests/fixtures/lift.mp4');
const shortVideoPath = resolve('tests/fixtures/short.mp4');
async function demo(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore the Snatch demo' }).click();
  await expect(page.getByRole('heading', { name: 'Good lift.' })).toBeVisible();
  await expect(page.locator('#time-label')).toHaveText('0.00 s');
  await page.getByRole('button', { name: /01 Early arm bend/ }).click();
}
async function capture(page: Page) {
  await page.goto('/#capture');
  await expect(
    page.getByRole('button', { name: 'Record a video' }),
  ).toBeVisible();
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}
test.beforeEach(async ({ page }) => {
  page.on('pageerror', (error) => {
    throw error;
  });
});
test('home → capture → processing → result → history survives reload', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Every lift. A little better.' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Analyze a lift', exact: true }).click();
  await expect(page.getByLabel('Movement')).toHaveValue('snatch');
  await expect(page.getByLabel('Movement').locator('option')).toHaveCount(1);
  await page.getByRole('button', { name: 'Try the demo lift' }).click();
  await expect(
    page.getByRole('heading', { name: 'Analyzing your snatch.' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Good lift.' })).toBeVisible();
  await expect(page.getByLabel('Score 83 out of 100')).toBeVisible();
  await expect(page.locator('.timeline button')).toHaveCount(7);
  await expect(page.locator('.issue')).toHaveCount(3);
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'History' })
    .click();
  await expect(
    page.getByRole('link', { name: 'Open Snatch result, score 83' }),
  ).toHaveCount(1);
  await page.reload();
  await page
    .getByRole('link', { name: 'Open Snatch result, score 83' })
    .click();
  await expect(page.getByRole('heading', { name: 'Good lift.' })).toBeVisible();
  await noOverflow(page);
});
test('cancelled processing creates no result or stale navigation', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore the Snatch demo' }).click();
  await page.getByRole('button', { name: 'Cancel analysis' }).click();
  await expect(
    page.getByRole('heading', { name: 'One lift. New perspective.' }),
  ).toBeVisible();
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'History' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Your next lift starts here.' }),
  ).toBeVisible();
  await page.waitForTimeout(2100);
  await expect(
    page.getByRole('heading', { name: 'Lift history.' }),
  ).toBeVisible();
  await expect(page.locator('.lift-row')).toHaveCount(0);
});
test('selecting an issue seeks, preserves the player and exposes drills', async ({
  page,
}) => {
  await demo(page);
  await page.getByRole('button', { name: /02 Forward bar drift/ }).click();
  await expect(page.locator('#time-label')).toHaveText('1.08 s');
  await expect(page.locator('#phase-label')).toHaveText('Transition');
  await expect(
    page.getByRole('button', { name: /02 Forward bar drift/ }),
  ).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#reading')).toContainText('6.4 cm');
  await page.getByRole('button', { name: 'Snatch Pull', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Snatch Pull' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Snatch Pull', exact: true }),
  ).toBeFocused();
  await page.getByRole('button', { name: 'View this moment' }).click();
  await expect(page.locator('.video-stage')).toBeFocused();
  await expect(page.locator('#time-label')).toHaveText('1.08 s');
});
test('playback, speed, looping, pose, phases and keyboard stepping work', async ({
  page,
}) => {
  await demo(page);
  await page.getByRole('button', { name: 'Play lift', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Pause lift', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Pause lift', exact: true }).click();
  await page.getByRole('button', { name: 'Playback speed, 0.5 times' }).click();
  await expect(
    page.getByRole('button', { name: 'Playback speed, 1 times' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Loop selected issue' }).click();
  await expect(
    page.getByRole('button', { name: 'Loop selected issue' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page
    .getByRole('button', { name: 'Show illustrative pose overlay' })
    .click();
  await expect(
    page.getByRole('button', { name: 'Show illustrative pose overlay' }),
  ).toHaveAttribute('aria-pressed', 'false');
  await page
    .getByRole('button', { name: 'Catch, score 84', exact: true })
    .click();
  await expect(page.locator('#time-label')).toHaveText('2.15 s');
  await expect(
    page.getByRole('button', { name: 'Loop selected issue' }),
  ).toHaveAttribute('aria-pressed', 'false');
  await page.locator('.video-stage').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#time-label')).toHaveText('2.20 s');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#time-label')).toHaveText('2.15 s');
  await page.keyboard.press('Space');
  await expect(
    page.getByRole('button', { name: 'Pause lift', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Space');
  await expect(
    page.getByRole('button', { name: 'Play lift', exact: true }),
  ).toBeVisible();
});
test('collapse clears selection and disables issue looping', async ({
  page,
}) => {
  await demo(page);
  await page.getByRole('button', { name: /01 Early arm bend/ }).click();
  await expect(
    page.getByRole('button', { name: 'Loop selected issue' }),
  ).toBeDisabled();
  await expect(page.locator('#reading')).toContainText('Select a phase');
});
test('uploaded footage stays in review without demo scores or skeletons', async ({
  page,
}) => {
  await capture(page);
  await page.locator('#import').setInputFiles(videoPath);
  await expect(page.getByLabel('Review your lift video')).toBeVisible();
  await expect(
    page.getByText('Technique analysis is not available yet.'),
  ).toBeVisible();
  await expect(page.locator('.score, .issue, .athlete, .timeline')).toHaveCount(
    0,
  );
  await expect(
    page.getByRole('button', { name: 'Analyze this lift' }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Playback speed: 1×' }).click();
  await expect
    .poll(() =>
      page
        .locator('.review-video video')
        .evaluate((v) => (v as HTMLVideoElement).playbackRate),
    )
    .toBe(0.5);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('snatchy-history-v2') ?? '[]').length,
    ),
  ).toBe(0);
  await page.reload();
  await expect(page.locator('.score, .issue')).toHaveCount(0);
});
test('short uploads keep their own duration without demo phase timing', async ({
  page,
}) => {
  await capture(page);
  await page.locator('#import').setInputFiles(shortVideoPath);
  await expect(
    page.getByRole('button', { name: 'Playback speed: 1×' }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator('.review-video video')
        .evaluate((v) => (v as HTMLVideoElement).duration),
    )
    .toBeLessThan(1);
  await expect(page.locator('.timeline, #pose-frame, .score')).toHaveCount(0);
});
test('old uploaded records no longer show fabricated scores or replay the demo', async ({
  page,
}) => {
  await page.addInitScript(
    (analysis) =>
      localStorage.setItem(
        'snatchy-history-v2',
        JSON.stringify([
          { id: 'old-upload', createdAt: 1234, source: 'video', analysis },
        ]),
      ),
    snatchDemo,
  );
  await page.goto('/#history');
  await expect(page.getByText('Not analyzed', { exact: true })).toBeVisible();
  await expect(page.locator('.lift-score')).toHaveCount(0);
  await page
    .getByRole('link', { name: 'Open Snatch upload, not analyzed' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Not analyzed.' }),
  ).toBeVisible();
  await expect(
    page.locator('.score, .athlete, .issues, #pose-frame'),
  ).toHaveCount(0);
  await expect(page.getByText(/not calculated from your video/)).toBeVisible();
});
test('invalid and corrupt files display recoverable errors', async ({
  page,
}) => {
  await capture(page);
  await page.locator('#import').setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not video'),
  });
  await expect(page.getByRole('alert')).toContainText('Choose a video file');
  await page.locator('#import').setInputFiles({
    name: 'broken.mp4',
    mimeType: 'video/mp4',
    buffer: Buffer.from('broken'),
  });
  await expect(page.getByRole('alert')).toContainText('cannot play');
  await expect(
    page.getByRole('button', { name: 'Import from gallery' }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Try the demo lift' }).click();
  await expect(page.getByRole('heading', { name: 'Good lift.' })).toBeVisible();
});
test('replace video returns to a playable review', async ({ page }) => {
  await capture(page);
  await page.locator('#import').setInputFiles(videoPath);
  await expect(
    page.getByRole('button', { name: 'Choose another video' }),
  ).toBeVisible();
  await page.locator('#import').setInputFiles(shortVideoPath);
  await expect(page.locator('.file-meta')).toContainText('short.mp4');
});
test('record control requests camera capture where supported', async ({
  page,
}) => {
  await capture(page);
  await expect(page.locator('#record')).toHaveAttribute(
    'capture',
    'environment',
  );
  await expect(page.locator('#record')).toHaveAttribute('accept', 'video/*');
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Record a video' }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles(videoPath);
  await expect(
    page.getByRole('heading', { name: 'Ready when you are.' }),
  ).toBeVisible();
});
test('corrupt history and missing result routes recover safely', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem('snatchy-history-v2', 'broken'),
  );
  await page.goto('/#history');
  await expect(page.getByText(/History is unavailable/)).toBeVisible();
  await page.goto('/#result/missing');
  await expect(
    page.getByText('That saved result is no longer available.'),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Analyze a lift', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Record a video' }),
  ).toBeVisible();
});
test('denied persistence keeps the completed result available in-session', async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('Storage denied');
      },
    }),
  );
  await demo(page);
  await expect(page.getByText(/could not be saved/)).toBeVisible();
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'History' })
    .click();
  await expect(page.locator('.lift-row')).toHaveCount(1);
});
test('legacy history migrates and browser back navigation works', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem('snatchy-history', JSON.stringify([{ id: 1234 }])),
  );
  await page.goto('/#history');
  await expect(page.locator('.lift-row')).toHaveCount(1);
  await page.locator('.lift-row').click();
  await expect(page.getByRole('heading', { name: 'Good lift.' })).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole('heading', { name: 'Lift history.' }),
  ).toBeVisible();
});
test('small screens do not overflow and controls remain touch-sized', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await demo(page);
  await noOverflow(page);
  const dimensions = await page.locator('.player button').evaluateAll((nodes) =>
    nodes.map((n) => ({
      width: n.getBoundingClientRect().width,
      height: n.getBoundingClientRect().height,
    })),
  );
  expect(dimensions.every((d) => d.width >= 44 && d.height >= 44)).toBe(true);
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'Analyze' })
    .click();
  await noOverflow(page);
});
test('all main screens and the drill dialog pass accessibility checks', async ({
  page,
}) => {
  for (const route of ['/#home', '/#capture', '/#history']) {
    await page.goto(route);
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(result.violations).toEqual([]);
    await noOverflow(page);
  }
  await demo(page);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.getByRole('button', { name: 'Snatch Pull', exact: true }).click();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
});
test('saved movement data controls rendering instead of hardcoded scores', async ({
  page,
}) => {
  const analysis = {
    ...snatchDemo,
    score: 91,
    verdict: 'Strong lift',
    phases: snatchDemo.phases.map((p) => ({ ...p, score: 90 })),
  };
  await page.addInitScript(
    (record) =>
      localStorage.setItem('snatchy-history-v2', JSON.stringify([record])),
    { id: 'custom', createdAt: 1234, source: 'demo', analysis },
  );
  await page.goto('/#result/custom');
  await expect(page.getByLabel('Score 91 out of 100')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Strong lift.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Setup, score 90', exact: true }),
  ).toBeVisible();
});

test('demo starts at setup and the trace advances with the bar through the catch', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore the Snatch demo' }).click();
  await expect(page.getByRole('heading', { name: 'Good lift.' })).toBeVisible();
  await expect(page.locator('#time-label')).toHaveText('0.00 s');
  const start = await page.locator('[data-bar-trace]').getAttribute('d');
  expect(start?.match(/L/g) ?? []).toHaveLength(0);
  await page
    .getByRole('button', { name: 'Catch, score 84', exact: true })
    .click();
  await expect(page.locator('#time-label')).toHaveText('2.15 s');
  await expect(page.locator('[data-motion-time]')).toHaveAttribute(
    'data-motion-time',
    '2.15',
  );
  expect(
    (await page.locator('[data-bar-trace]').getAttribute('d'))?.length,
  ).toBeGreaterThan(start?.length ?? 0);
  await expect(page.locator('[data-barbell]')).toBeVisible();
  await page
    .getByRole('button', { name: 'Setup, score 94', exact: true })
    .click();
  await expect(page.locator('[data-bar-trace]')).toHaveAttribute('d', start!);
});
