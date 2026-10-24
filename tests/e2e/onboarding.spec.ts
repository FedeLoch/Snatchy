import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({ storageState: { cookies: [], origins: [] } });

test('first visit shows the quick-start guide once and can start an analysis', async ({
  page,
}) => {
  await page.goto('/');
  const guide = page.getByRole('dialog', { name: 'Welcome to Snatchy' });
  await expect(guide).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  await expect(page.getByText('Step 1 of 4')).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Film from the side' }),
  ).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(
    page.getByRole('dialog', { name: 'Analyze a lift' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByText('Step 2 of 4')).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Analyze my first lift' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/#capture$/);
  await page.goto('/#home');
  await page.reload();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('the guide can be skipped, and reopened from Settings', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Skip' }).first().click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/#settings');
  const reopen = page.getByRole('button', {
    name: 'Show the quick start guide',
  });
  await reopen.click();
  await expect(
    page.getByRole('dialog', { name: 'Welcome to Snatchy' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(reopen).toBeFocused();
});

test('a deep link to a result is not interrupted by the guide', async ({
  page,
}) => {
  await page.goto('/#history');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
