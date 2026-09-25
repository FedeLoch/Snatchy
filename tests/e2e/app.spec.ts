import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { resolve } from 'node:path';
import { snatchDemo } from '../../src/data/snatch';
const videoPath = resolve('tests/fixtures/lift.mp4');
const shortVideoPath = resolve('tests/fixtures/short.mp4');
async function seedResult(page: Page, overrides: Record<string, unknown> = {}) {
  const record = {
    id: 'custom',
    createdAt: 1234,
    // 'demo' is the legacy source; such records still load and render.
    source: 'demo',
    analysis: { ...snatchDemo, ...overrides },
  };
  // The app reads history once at boot (see `loadHistory` in src/app.ts), so a
  // hash-only `goto` is not enough: it neither re-runs init scripts nor re-reads
  // storage. Seed, then force a full document load before routing.
  await page.goto('/');
  await page.evaluate(
    (r) => localStorage.setItem('snatchy-history-v2', JSON.stringify([r])),
    record,
  );
  await page.reload();
  await page.goto('/#result/custom');
  await expect(page.getByRole('heading', { name: 'Good lift.' })).toBeVisible();
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
test('home → capture exposes the movement catalog', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Every lift. A little better.' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Analyze a lift', exact: true }).click();
  await expect(page.getByLabel('Movement')).toHaveValue('auto');
  await expect(page.getByLabel('Movement').locator('option')).toHaveCount(12);
  await expect(
    page.getByRole('button', { name: 'Record a video' }),
  ).toBeVisible();
  await noOverflow(page);
});

test('uploaded footage stays in review without demo scores or skeletons', async ({
  page,
}) => {
  await capture(page);
  await page.locator('#import').setInputFiles(videoPath);
  await expect(page.getByLabel('Review your lift video')).toBeVisible();
  await expect(page.getByText('Ready for real pose analysis.')).toBeVisible();
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
  await seedResult(page);
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
  // Pin the theme: Playwright defaults to a light colour scheme, and the light
  // palette is covered separately below.
  await page.emulateMedia({ colorScheme: 'dark' });
  for (const route of ['/#home', '/#capture', '/#history']) {
    await page.goto(route);
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(result.violations).toEqual([]);
    await noOverflow(page);
  }
  await seedResult(page);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  // Drill links only render inside an expanded issue, so open one first.
  await page.locator('.issue-toggle').first().click();
  await page.getByRole('button', { name: 'Snatch Pull', exact: true }).click();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
});
test('theme toggles, persists across reloads, and stays accessible', async ({
  page,
}) => {
  // Pin the starting preference: Playwright defaults to a light colour scheme,
  // which would otherwise decide the first paint.
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'Switch to light theme' });
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  // The label must follow the current theme, so query it by action rather than
  // by the name it had a moment ago.
  const control = page.locator('[data-action="theme"]');
  await expect(control).toHaveAccessibleName('Switch to dark theme');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    'content',
    '#f2f5f8',
  );
  // A stored choice must win over the operating system on reload.
  await page.emulateMedia({ colorScheme: 'light' });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    'content',
    '#0d1117',
  );
  // The system must not override a deliberate choice while the app is open.
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('light mode is the default when the system prefers light', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(
    page.getByRole('button', { name: 'Switch to dark theme' }),
  ).toBeVisible();
});

test('light mode passes accessibility checks and does not overflow', async ({
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
  await page.emulateMedia({ colorScheme: 'light' });
  for (const route of ['/#home', '/#capture', '/#history', '/#result/custom']) {
    await page.goto(route);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await noOverflow(page);
  }
});

test('the theme control stays touch-sized on the narrowest screen', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  const box = await page
    .getByRole('button', { name: 'Switch to light theme' })
    .boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await noOverflow(page);
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
