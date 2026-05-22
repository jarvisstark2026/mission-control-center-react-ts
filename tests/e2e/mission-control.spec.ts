import { expect, test } from '@playwright/test';

async function openWidget(page: import('@playwright/test').Page, widgetName: string) {
  await page.getByRole('button', { name: 'Open widget' }).click();
  await page.getByRole('menuitem', { name: widgetName }).click();
}

test('operational core widgets launch and use mock live data', async ({ page }) => {
  await page.goto('/?role=admin');

  await openWidget(page, 'Command inbox');
  await expect(page.getByText('primary approval queue').first()).toBeVisible();

  await openWidget(page, 'Agent console');
  await expect(page.getByText('tasking / proposals').first()).toBeVisible();
  await page.getByRole('button', { name: 'Send to Jarvis' }).click();
  await expect(page.getByText(/I prepared a gated command proposal/i)).toBeVisible();
  await expect(page.getByText(/Review current mission state and propose/i).first()).toBeVisible();

  await openWidget(page, 'Command inbox');
  await page.getByRole('button', { name: 'Approve' }).first().click();
  await expect(page.getByText('succeeded', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Mock gateway completed/).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText('primary approval queue').first()).toBeVisible();
  await expect(page.getByText('succeeded', { exact: true }).first()).toBeVisible();

  await openWidget(page, 'Notifications');
  await expect(page.getByText('live telemetry and alerts')).toBeVisible();
  await expect(page.getByText('mock', { exact: true }).first()).toBeVisible();

  await openWidget(page, 'Integration registry');
  await expect(page.getByText('devices, heartbeats, and permissions')).toBeVisible();
  await expect(page.getByText('Tailnet router')).toBeVisible();

  await openWidget(page, 'Agent control');
  await expect(page.getByText('identity / jobs / permissions').first()).toBeVisible();
  await expect(page.getByText('Jarvis Prime').last()).toBeVisible();
});

test('guest access can read command inbox but cannot approve commands', async ({ page }) => {
  await page.goto('/?role=guest');

  await openWidget(page, 'Command inbox');
  await expect(page.getByText('primary approval queue').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  await expect(page.getByText('Read-only for this access scope.').first()).toBeVisible();

  await page.getByRole('button', { name: 'Open widget' }).click();
  await expect(page.getByRole('menuitem', { name: 'Agent control' })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: 'Agent console' })).toHaveCount(0);
});
