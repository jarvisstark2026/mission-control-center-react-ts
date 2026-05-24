import { expect, test } from '@playwright/test';

async function clickControl(locator: import('@playwright/test').Locator) {
  await locator.evaluate((element) => (element as HTMLButtonElement).click());
}

async function openWidgetMenu(page: import('@playwright/test').Page) {
  await clickControl(page.getByRole('button', { name: 'Open widget' }));
}

async function openWidget(page: import('@playwright/test').Page, widgetName: string) {
  await openWidgetMenu(page);
  await clickControl(page.getByRole('menuitem', { name: widgetName }));
}

async function ensureWidgetOpen(locator: import('@playwright/test').Locator) {
  if (await locator.evaluate((element) => element.classList.contains('is-closed'))) {
    await locator.getByRole('button', { name: /^Maximize / }).evaluate((element) => (element as HTMLButtonElement).click());
    await expect(locator).toHaveClass(/is-open/);
  }
}

test('operational core widgets launch and use mock live data', async ({ page }) => {
  await page.goto('/?role=admin');

  await openWidget(page, 'Command inbox');
  await expect(page.getByText('primary approval queue').first()).toBeVisible();

  await openWidget(page, 'Agent console');
  await expect(page.getByText('tasking / proposals').first()).toBeVisible();
  await page.getByRole('button', { name: 'Send to Jarvis' }).click();
  await expect(page.getByText(/prepared a gated command proposal/i)).toBeVisible();
  await expect(page.getByText(/Review current mission state and propose/i).first()).toBeVisible();

  await openWidget(page, 'Command inbox');
  await page.getByRole('button', { name: 'Approve' }).first().click();
  await expect(page.getByText(/Mock gateway completed/).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText('primary approval queue').first()).toBeVisible();
  await expect(page.getByText(/Mock gateway completed/).first()).toBeVisible();

  await openWidget(page, 'Notifications');
  await expect(page.getByText('live telemetry and alerts')).toBeVisible();
  await expect(page.getByText('mock', { exact: true }).first()).toBeVisible();

  await openWidget(page, 'Integration registry');
  await expect(page.getByText('devices, heartbeats, and permissions')).toBeVisible();
  await expect(page.getByText('Tailnet router')).toBeVisible();

  await openWidget(page, 'Agent control');
  await expect(page.getByText('identity / jobs / permissions').first()).toBeVisible();
  await expect(page.getByText('Jarvis Prime').last()).toBeVisible();
  await expect(page.getByText('Jarvis Workflow').last()).toBeVisible();

  await openWidget(page, 'Home systems');
  await expect(page.getByText('energy, safety, automation, and rooms').first()).toBeVisible();
  await expect(page.getByText('Daily load').first()).toBeVisible();
  await expect(page.getByText('Solar PV').first()).toBeVisible();
  await expect(page.getByText('Wall tablets').first()).toBeVisible();
  const homePoolLayer = page.locator('.workspace-widget.kind-home-systems .home-energy-series-toggle', { hasText: 'Pool' });
  await homePoolLayer.click();
  await expect(homePoolLayer).toHaveAttribute('aria-pressed', 'true');
  const solarSurplusProposal = page
    .locator('.workspace-widget.kind-home-systems .home-action-card', { hasText: 'Use solar surplus' })
    .getByRole('button', { name: 'Stage proposal' });
  await solarSurplusProposal.scrollIntoViewIfNeeded();
  await solarSurplusProposal.click();
  await expect(page.getByText('Sent to Command Inbox.')).toBeVisible();

  await openWidget(page, 'Command inbox');
  await expect(page.getByText('Use solar surplus').first()).toBeVisible();
  await page.locator('.mission-control-card', { hasText: 'Use solar surplus' }).getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText(/Mock gateway completed/).first()).toBeVisible();
});

test('workflow runbook can stage agent approval through Command Inbox', async ({ page }) => {
  await page.goto('/?role=admin');

  await openWidget(page, 'Workflows');
  await page.getByRole('button', { name: 'Start runbook' }).click();
  await page.getByRole('button', { name: 'Stage approval' }).first().click();

  await openWidget(page, 'Command inbox');
  await expect(page.getByText(/Workflow \//).first()).toBeVisible();
  await expect(page.getByText('Jarvis Workflow').first()).toBeVisible();
  await page.getByRole('button', { name: 'Approve' }).first().click();
  await expect(page.getByText(/Mock gateway completed/).first()).toBeVisible();
});

test('guest access can read command inbox but cannot approve commands', async ({ page }) => {
  await page.goto('/?role=guest');

  await openWidget(page, 'Command inbox');
  await expect(page.getByText('primary approval queue').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  await expect(page.getByText('Read-only for this access scope.').first()).toBeVisible();

  await openWidgetMenu(page);
  await expect(page.getByRole('menuitem', { name: 'Agent control' })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: 'Agent console' })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: 'Home systems' })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Home systems' }).click();
  await expect(page.getByText('This access scope can monitor Home Systems but cannot stage home actions.')).toBeVisible();
});

test('local productivity widgets persist useful browser-only state', async ({ page }) => {
  await page.goto('/?role=admin');

  const scheduleWidget = page.locator('.workspace-widget.kind-schedule');
  await ensureWidgetOpen(scheduleWidget);
  await scheduleWidget.getByLabel('Schedule block title').fill('E2E local block');
  await scheduleWidget.getByLabel('Schedule block note').fill('persists after reload');
  await scheduleWidget.getByRole('button', { name: 'Add block' }).click();
  await expect(scheduleWidget.getByText('E2E local block')).toBeVisible();

  const taskWidget = page.locator('.workspace-widget.kind-list');
  await ensureWidgetOpen(taskWidget);
  await expect(taskWidget.getByLabel('Task title')).toBeVisible();
  await taskWidget.getByLabel('Task title').fill('E2E local task');
  await taskWidget.getByLabel('Task note').fill('move to blocked');
  await taskWidget.getByLabel('Task title').press('Enter');
  const taskCard = taskWidget.locator('.task-card', { hasText: 'E2E local task' });
  await expect(taskCard).toHaveCount(1);
  await taskCard.getByLabel('Move E2E local task').selectOption('blocked');
  await taskWidget.getByRole('tab', { name: /Blocked/i }).evaluate((element) => (element as HTMLElement).click());
  await expect(taskWidget.getByText('E2E local task')).toBeVisible();

  const browserWidget = page.locator('.workspace-widget.kind-browser');
  await ensureWidgetOpen(browserWidget);
  await browserWidget.getByLabel('Browser URL').fill('openai.com');
  await browserWidget.getByRole('button', { name: 'Go' }).click({ force: true });
  await browserWidget.getByRole('button', { name: 'Save bookmark' }).click({ force: true });
  await expect(browserWidget.getByText('openai.com').first()).toBeVisible();

  const liveTvWidget = page.locator('.workspace-widget.kind-watch-video');
  await ensureWidgetOpen(liveTvWidget);
  await liveTvWidget.getByPlaceholder('Name this source').fill('E2E MP4');
  await liveTvWidget.getByPlaceholder('Paste an official HLS / MP4 source').fill('https://example.com/local.mp4');
  await liveTvWidget.getByRole('button', { name: 'Save favorite' }).click({ force: true });
  await expect(liveTvWidget.getByText('E2E MP4').first()).toBeVisible();

  await page.reload();
  await ensureWidgetOpen(page.locator('.workspace-widget.kind-schedule'));
  await expect(page.locator('.workspace-widget.kind-schedule').getByText('E2E local block')).toBeVisible();
  await ensureWidgetOpen(page.locator('.workspace-widget.kind-list'));
  await page.locator('.workspace-widget.kind-list').getByRole('tab', { name: /Blocked/i }).evaluate((element) => (element as HTMLElement).click());
  await expect(page.locator('.workspace-widget.kind-list').getByText('E2E local task')).toBeVisible();
  await ensureWidgetOpen(page.locator('.workspace-widget.kind-browser'));
  await expect(page.locator('.workspace-widget.kind-browser').getByText('openai.com').first()).toBeVisible();
  await ensureWidgetOpen(page.locator('.workspace-widget.kind-watch-video'));
  await expect(page.locator('.workspace-widget.kind-watch-video').getByText('E2E MP4').first()).toBeVisible();
});

test('layout admin saves modes per workspace and filters guest widgets', async ({ page }) => {
  await page.goto('/?role=admin');

  await page.getByRole('button', { name: 'Mode preset' }).click();
  await page.getByLabel('Preset name').fill('E2E admin mode');
  await page.getByRole('button', { name: 'Create preset' }).click();
  await expect(page.getByText('E2E admin mode mode created and active')).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /E2E admin mode Main workspace/i })).toBeVisible();
  await page.getByRole('button', { name: 'Save layout' }).click();
  await expect(page.getByText('Main workspace E2E admin mode saved')).toBeVisible();

  await page.goto('/?role=admin&workspace=extension&workspaceId=e2e-extension');
  await page.getByRole('button', { name: 'Mode preset' }).click();
  await page.getByRole('menuitem', { name: /Security mode/i }).click();
  await expect(page.locator('.workspace-widget.kind-command-inbox')).toHaveClass(/is-open/);
  await page.getByRole('button', { name: 'Save layout' }).click();
  await expect(page.getByText(/Workspace.*Security mode saved/)).toBeVisible();
  await page.reload();
  await expect(page.locator('.workspace-widget.kind-command-inbox')).toHaveClass(/is-open/);

  await page.goto('/?role=admin');
  await page.getByRole('button', { name: 'Permissions' }).click();
  await page.getByRole('tab', { name: 'Guest' }).click();
  const permissionsMenu = page.getByRole('menu', { name: 'Widget permissions' });
  await permissionsMenu.getByLabel(/Home systems/i).uncheck();
  await expect(page.getByText('Guest Home systems hidden')).toBeVisible();

  await page.goto('/?role=guest');
  await openWidgetMenu(page);
  await expect(page.getByRole('menuitem', { name: 'Home systems' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Mode preset' }).click();
  await page.getByRole('menuitem', { name: /Home mode/i }).click();
  await expect(page.locator('.workspace-widget.kind-home-systems')).toHaveCount(0);
});
