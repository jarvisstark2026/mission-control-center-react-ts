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

test('operational core widgets launch and use local live data', async ({ page }) => {
  await page.goto('/?role=admin');
  await page.evaluate(() => {
    window.localStorage.removeItem('agent-tasking-state:v1');
    window.localStorage.removeItem('mission-control.agent-bridge-settings.v1');
  });
  await page.reload();

  await openWidget(page, 'Command inbox');
  await expect(page.getByText('primary approval queue').first()).toBeVisible();

  await openWidget(page, 'Agent console');
  await expect(page.getByText('chat / proposals').first()).toBeVisible();
  await page.getByRole('button', { name: 'Stage local proposal' }).click();
  await expect(page.getByText(/prepared a gated command proposal/i)).toBeVisible();
  await expect(page.getByText(/Review current mission state and propose/i).first()).toBeVisible();
  await clickControl(page.locator('.workspace-widget.kind-agent-console').getByRole('button', { name: 'Attach evidence' }));

  await openWidget(page, 'Command inbox');
  await clickControl(page.locator('.workspace-widget.kind-command-inbox').getByRole('button', { name: 'Attach evidence' }));
  await page.getByRole('button', { name: 'Approve' }).first().click();
  await expect(page.getByText(/Local dry-run gateway completed/).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText('primary approval queue').first()).toBeVisible();
  await expect(page.getByText(/Local dry-run gateway completed/).first()).toBeVisible();

  await openWidget(page, 'Notifications');
  await expect(page.getByText('live telemetry and alerts')).toBeVisible();
  await expect(page.getByText('local seed events').first()).toBeVisible();

  await openWidget(page, 'Integration registry');
  await expect(page.getByText('devices, heartbeats, and permissions')).toBeVisible();
  await expect(page.getByText('Tailnet router')).toBeVisible();

  await openWidget(page, 'Agent control');
  await expect(page.getByText('identity / jobs / permissions').first()).toBeVisible();
  await expect(page.getByText('Hermes / OpenClaw connectors').first()).toBeVisible();
  await expect(page.getByText(/connection cockpit/i)).toHaveCount(0);
  await expect(page.getByText(/Mission Control Center/i)).toHaveCount(0);
  await expect(page.getByText(/Ask Jarvis/i)).toHaveCount(0);
  await expect(page.getByText(/mock channel/i)).toHaveCount(0);
  await expect(page.getByText(/mocked systems/i)).toHaveCount(0);
  await page.getByRole('button', { name: 'Agents' }).click();
  await expect(page.getByText('Mission Control Coordinator').last()).toBeVisible();
  await expect(page.getByText('Workflow Agent').last()).toBeVisible();

  await openWidget(page, 'Home systems');
  await expect(page.getByText('energy, safety, automation, and rooms').first()).toBeVisible();
  await expect(page.getByText(/home backend not connected/i).first()).toBeVisible();
  await expect(page.getByText('Live energy/device values appear only after a backend responds').first()).toBeVisible();
  const solarSurplusProposal = page
    .locator('.workspace-widget.kind-home-systems .home-action-card', { hasText: 'Use solar surplus' })
    .getByRole('button', { name: 'Stage proposal' });
  await solarSurplusProposal.scrollIntoViewIfNeeded();
  await solarSurplusProposal.click();
  await expect(page.getByText('Sent to Command Inbox.')).toBeVisible();

  await openWidget(page, 'Command inbox');
  await expect(page.getByText('Use solar surplus').first()).toBeVisible();
  await page.locator('.mission-control-card', { hasText: 'Use solar surplus' }).getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText(/Local dry-run gateway completed/).first()).toBeVisible();
});

test('workflow runbook can stage agent approval through Command Inbox', async ({ page }) => {
  await page.goto('/?role=admin');

  await openWidget(page, 'Workflows');
  await page.getByRole('button', { name: 'Start runbook' }).click();
  await clickControl(page.locator('.workspace-widget.kind-flow').getByRole('button', { name: 'Attach evidence' }));
  await page.getByRole('button', { name: 'Stage approval' }).first().click();

  await openWidget(page, 'Command inbox');
  await expect(page.getByText(/Workflow \//).first()).toBeVisible();
  await expect(page.getByText('Workflow Agent').first()).toBeVisible();
  await page.getByRole('button', { name: 'Approve' }).first().click();
  await expect(page.getByText(/Local dry-run gateway completed/).first()).toBeVisible();
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
  await clickControl(scheduleWidget.getByRole('button', { name: 'Attach evidence' }));

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
  await clickControl(taskWidget.getByRole('button', { name: 'Attach evidence' }));

  const docsWidget = page.locator('.workspace-widget.kind-docs');
  await ensureWidgetOpen(docsWidget);
  await docsWidget.getByLabel('Document body').fill('E2E evidence note from Docs.');
  await clickControl(docsWidget.getByRole('button', { name: 'Attach evidence' }));

  const sheetWidget = page.locator('.workspace-widget.kind-sheet');
  await ensureWidgetOpen(sheetWidget);
  await sheetWidget.getByLabel('Q1 row 1').fill('42.5');
  await clickControl(sheetWidget.getByRole('button', { name: 'Add row' }));
  await clickControl(sheetWidget.getByRole('button', { name: 'Attach evidence' }));

  await openWidget(page, 'Presentation');
  const slidesWidget = page.locator('.workspace-widget.kind-slides');
  await ensureWidgetOpen(slidesWidget);
  await clickControl(slidesWidget.getByRole('button', { name: 'Add frame' }));
  await slidesWidget.getByLabel('Slide title').fill('E2E slide');
  await slidesWidget.getByLabel('Slide body').fill('Slide evidence persists.');
  await clickControl(slidesWidget.getByRole('button', { name: 'Attach evidence' }));

  await openWidget(page, 'Goals');
  await expect(page.locator('.workspace-widget.kind-goals').getByText(/evidence/i).first()).toBeVisible();

  const browserWidget = page.locator('.workspace-widget.kind-browser');
  await ensureWidgetOpen(browserWidget);
  await browserWidget.getByLabel('Browser URL').fill('openai.com');
  await clickControl(browserWidget.getByRole('button', { name: 'Go' }));
  await clickControl(browserWidget.getByRole('button', { name: 'Save bookmark' }));
  await expect(browserWidget.getByText('openai.com').first()).toBeVisible();
  await clickControl(browserWidget.getByRole('button', { name: 'Attach evidence' }));

  const tradingWidget = page.locator('.workspace-widget.kind-trading-graph');
  await ensureWidgetOpen(tradingWidget);
  await clickControl(tradingWidget.getByRole('button', { name: 'Attach evidence' }));
  await openWidget(page, 'Goals');
  await expect(page.locator('.workspace-widget.kind-goals').getByText(/evidence/i).first()).toBeVisible();

  const liveTvWidget = page.locator('.workspace-widget.kind-watch-video');
  await ensureWidgetOpen(liveTvWidget);
  await liveTvWidget.getByPlaceholder('Name this source').fill('E2E MP4');
  await liveTvWidget.getByPlaceholder('Paste an official HLS / MP4 source').fill('https://example.com/local.mp4');
  await liveTvWidget.getByRole('button', { name: 'Save favorite' }).click({ force: true });
  await expect(liveTvWidget.getByText('E2E MP4').first()).toBeVisible();
  await clickControl(liveTvWidget.getByRole('button', { name: 'Attach evidence' }));

  const mapWidget = page.locator('.workspace-widget.kind-map');
  await ensureWidgetOpen(mapWidget);
  await mapWidget.getByPlaceholder('Workshop, site, address').fill('E2E site');
  await mapWidget.getByPlaceholder('Why this place matters').fill('local map note');
  await mapWidget.getByRole('button', { name: 'Save place' }).click({ force: true });
  await expect(mapWidget.getByText('E2E site').first()).toBeVisible();
  await clickControl(mapWidget.getByRole('button', { name: 'Attach evidence' }));

  await openWidget(page, 'Diagram preview');
  const diagramWidget = page.locator('.workspace-widget.kind-diagram');
  await ensureWidgetOpen(diagramWidget);
  await diagramWidget.getByPlaceholder('System, room, workflow').fill('E2E topology');
  await clickControl(diagramWidget.getByRole('button', { name: 'Create diagram' }));
  await expect(diagramWidget.getByText('E2E topology').first()).toBeVisible();
  await expect(diagramWidget.getByPlaceholder('API, sensor, app, step')).toBeEnabled();
  await diagramWidget.getByPlaceholder('API, sensor, app, step').fill('Bridge');
  await clickControl(diagramWidget.getByRole('button', { name: 'Add node' }));
  await expect(diagramWidget.getByText('E2E topology').first()).toBeVisible();
  await clickControl(diagramWidget.getByRole('button', { name: 'Attach evidence' }));

  const audioWidget = page.locator('.workspace-widget.kind-audio');
  await ensureWidgetOpen(audioWidget);
  await audioWidget.getByPlaceholder('Mic mix, sample, feed').fill('E2E audio');
  await audioWidget.getByPlaceholder('https://...mp3 or WAV').fill('https://example.com/sample.mp3');
  await clickControl(audioWidget.getByRole('button', { name: 'Save source' }));
  await expect(audioWidget.getByText('E2E audio').first()).toBeVisible();
  await clickControl(audioWidget.getByRole('button', { name: 'Attach evidence' }));

  await openWidget(page, 'Media frame');
  const videoWidget = page.locator('.workspace-widget.kind-video');
  await ensureWidgetOpen(videoWidget);
  await videoWidget.getByPlaceholder('Camera, render, stream').fill('E2E video');
  await videoWidget.getByPlaceholder('https://...mp4 or WebM').fill('https://example.com/video.mp4');
  await clickControl(videoWidget.getByRole('button', { name: 'Save source' }));
  await expect(videoWidget.getByText('E2E video').first()).toBeVisible();
  await clickControl(videoWidget.getByRole('button', { name: 'Attach evidence' }));

  const nativeAppWidget = page.locator('.workspace-widget.kind-native-app');
  await ensureWidgetOpen(nativeAppWidget);
  await nativeAppWidget.getByPlaceholder('Codex, Hermes, Notes').fill('E2E portal');
  await nativeAppWidget.getByPlaceholder('https://..., codex://, or manual path').fill('codex://');
  await clickControl(nativeAppWidget.getByRole('button', { name: 'Save profile' }));
  await expect(nativeAppWidget.getByText('E2E portal').first()).toBeVisible();
  await clickControl(nativeAppWidget.getByRole('button', { name: 'Attach evidence' }));

  await openWidget(page, 'App Portal');
  const appPortalWidget = page.locator('.workspace-widget.kind-app-portal');
  await ensureWidgetOpen(appPortalWidget);
  await clickControl(appPortalWidget.getByRole('button', { name: 'Attach evidence' }));

  await openWidget(page, 'JSON Surface');
  const jsonWidget = page.locator('.workspace-widget.kind-json-surface');
  await ensureWidgetOpen(jsonWidget);
  await jsonWidget.getByPlaceholder('Bridge payload, task result, custom table...').fill('E2E JSON');
  await jsonWidget.locator('textarea').fill('{"status":"ready","items":[{"title":"Evidence"}]}');
  await clickControl(jsonWidget.getByRole('button', { name: 'Render JSON' }));
  await expect(jsonWidget.getByText('E2E JSON').first()).toBeVisible();
  await clickControl(jsonWidget.getByRole('button', { name: 'Attach evidence' }));

  await openWidget(page, 'Manager');
  const managerWidget = page.locator('.workspace-widget.kind-window-manager');
  await ensureWidgetOpen(managerWidget);
  await clickControl(managerWidget.getByRole('button', { name: 'Attach evidence' }));

  await openWidget(page, 'Goals');
  await expect(page.locator('.workspace-widget.kind-goals').getByText(/evidence/i).first()).toBeVisible();

  await openWidget(page, '3D studio');
  const modelWidget = page.locator('.workspace-widget.kind-3d-studio');
  await ensureWidgetOpen(modelWidget);
  await expect(modelWidget.getByText('GLB and GLTF files appear after local import.')).toBeVisible();

  await page.reload();
  await ensureWidgetOpen(page.locator('.workspace-widget.kind-schedule'));
  await expect(page.locator('.workspace-widget.kind-schedule').getByText('E2E local block')).toBeVisible();
  await ensureWidgetOpen(page.locator('.workspace-widget.kind-list'));
  await page.locator('.workspace-widget.kind-list').getByRole('tab', { name: /Blocked/i }).evaluate((element) => (element as HTMLElement).click());
  await expect(page.locator('.workspace-widget.kind-list').getByText('E2E local task')).toBeVisible();
  await ensureWidgetOpen(page.locator('.workspace-widget.kind-docs'));
  await expect(page.locator('.workspace-widget.kind-docs').getByLabel('Document body')).toHaveValue('E2E evidence note from Docs.');
  await ensureWidgetOpen(page.locator('.workspace-widget.kind-sheet'));
  await expect(page.locator('.workspace-widget.kind-sheet').getByLabel('Q1 row 1')).toHaveValue('42.5');
  await ensureWidgetOpen(page.locator('.workspace-widget.kind-slides'));
  await expect(page.locator('.workspace-widget.kind-slides').getByLabel('Slide title')).toHaveValue('E2E slide');
  await ensureWidgetOpen(page.locator('.workspace-widget.kind-browser'));
  await expect(page.locator('.workspace-widget.kind-browser').getByText('openai.com').first()).toBeVisible();
  await ensureWidgetOpen(page.locator('.workspace-widget.kind-watch-video'));
  await expect(page.locator('.workspace-widget.kind-watch-video').getByText('E2E MP4').first()).toBeVisible();
  await ensureWidgetOpen(page.locator('.workspace-widget.kind-map'));
  await expect(page.locator('.workspace-widget.kind-map').getByText('E2E site').first()).toBeVisible();
  await ensureWidgetOpen(page.locator('.workspace-widget.kind-diagram'));
  await expect(page.locator('.workspace-widget.kind-diagram').getByText('E2E topology').first()).toBeVisible();
  await ensureWidgetOpen(page.locator('.workspace-widget.kind-audio'));
  await expect(page.locator('.workspace-widget.kind-audio').getByText('E2E audio').first()).toBeVisible();
  await ensureWidgetOpen(page.locator('.workspace-widget.kind-video'));
  await expect(page.locator('.workspace-widget.kind-video').getByText('E2E video').first()).toBeVisible();
  await ensureWidgetOpen(page.locator('.workspace-widget.kind-native-app'));
  await expect(page.locator('.workspace-widget.kind-native-app').getByText('E2E portal').first()).toBeVisible();
}, 90000);

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

test('browser workspace extension opens as a loaded workspace window', async ({ page }) => {
  await page.goto('/?role=admin');

  const [extensionPage] = await Promise.all([
    page.waitForEvent('popup'),
    (async () => {
      await page.getByLabel('Open workspace setup').click();
      await page.getByLabel('Create workspace instance').click();
    })(),
  ]);

  await extensionPage.waitForLoadState('domcontentloaded');
  await expect(extensionPage).toHaveURL(/workspace=extension/);
  await expect(extensionPage.getByLabel('Close workspace extension')).toBeVisible();
  await expect(extensionPage.getByLabel('Main workspace HUD')).toHaveCount(0);
  await extensionPage.close();
});
