import { expect, project, test } from '../../fixtures/test';

test('opens legacy websites and keeps new websites in the selected workspace', async ({ page }) => {
  const legacy = JSON.stringify(project().page('<div data-id="root">Existing project</div>').build());
  await page.addInitScript(data => {
    localStorage.setItem('revyme-onboarding-completed', 'true');
    if (sessionStorage.getItem('dashboard-seeded')) return;
    sessionStorage.setItem('dashboard-seeded', '1');
    localStorage.setItem('revyme-project-local', data);
    localStorage.setItem('revyme:project-name:local', 'Existing website');
  }, legacy);

  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: '1 website' })).toBeVisible();
  await page.getByRole('link', { name: 'Open Existing website' }).click();
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await page.getByText('Go to Dashboard', { exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  // Opening a legacy site can add generated support files. Its authored
  // source must survive, and dashboard actions must leave the saved record alone.
  const original = await page.evaluate(() => localStorage.getItem('revyme-project-local'));
  expect(JSON.parse(original ?? '{}').files).toMatchObject(JSON.parse(legacy).files);

  await page.getByRole('button', { name: 'Workspace menu' }).click();
  await page.getByText('Add workspace', { exact: true }).click();
  await page.getByLabel('Add workspace').fill('Test workspace');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\?ws=/);
  await expect(page.getByRole('heading', { name: '0 websites' })).toBeVisible();
  const workspaceUrl = page.url();

  await page.getByRole('button', { name: 'New Folder…' }).click();
  await page.getByLabel('New folder').fill('Design drafts');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByText('No websites in this folder yet.')).toBeVisible();

  await page.getByRole('button', { name: 'New Website', exact: true }).click();
  await page.getByLabel('New website').fill('New website fixture');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page).toHaveURL(/\/builder\/[\w-]+$/);
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await page.getByText('Go to Dashboard', { exact: true }).click();
  await expect(page).toHaveURL(workspaceUrl);
  await expect(page.getByRole('link', { name: 'Open New website fixture' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open Existing website' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Design drafts' }).click();
  await expect(page.getByRole('link', { name: 'Open New website fixture' })).toBeVisible();

  await page.getByRole('button', { name: 'Actions for New website fixture' }).click();
  await page.getByText('Rename', { exact: true }).click();
  await page.getByLabel('Rename website').fill('Renamed website');
  await page.getByRole('button', { name: 'Save name' }).click();
  await expect(page.getByRole('link', { name: 'Open Renamed website' })).toBeVisible();
  await page.getByRole('button', { name: 'Actions for Renamed website', exact: true }).click();
  await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
  const copy = page.getByRole('link', { name: 'Open Renamed website copy', exact: true });
  await expect(copy).toBeVisible();
  expect(await copy.getAttribute('href')).not.toBe(await page.getByRole('link', { name: 'Open Renamed website', exact: true }).getAttribute('href'));

  await page.getByRole('searchbox', { name: 'Search websites' }).fill('not found');
  await expect(page.getByText('No websites match your search.')).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search websites' }).clear();
  await page.getByRole('button', { name: 'Actions for Renamed website', exact: true }).click();
  await page.getByRole('button', { name: 'Archive', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Open Renamed website', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Archive', exact: true }).click();
  await page.getByRole('button', { name: 'Actions for Renamed website', exact: true }).click();
  await page.getByRole('button', { name: 'Restore', exact: true }).click();
  await expect(page.getByText('No archived websites.')).toBeVisible();

  await page.getByRole('button', { name: 'Workspace menu' }).click();
  await page.getByText('Light mode', { exact: true }).click();
  await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
  await page.getByRole('button', { name: 'Workspace menu' }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Local Settings' })).toBeVisible();
  await page.getByRole('link', { name: 'API Tokens', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'MCP tokens' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Settings tabs' }).getByRole('link', { name: 'Workspace' }).click();
  await page.getByRole('link', { name: 'AI & MCP', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ollama on this computer' })).toBeVisible();
  await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);

  await page.getByRole('button', { name: 'Workspace menu' }).click();
  await page.getByText('Local Workspace', { exact: true }).click();
  await page.getByRole('link', { name: 'Back to websites', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Open Existing website' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('revyme-project-local'))).toBe(original);
});

test('opens the remaining dashboard screens and saves local drafts and preferences', async ({ page }) => {
  await page.addInitScript(data => {
    if (sessionStorage.getItem('creator-seeded')) return;
    sessionStorage.setItem('creator-seeded', '1');
    localStorage.setItem('revyme-project-local', data);
    localStorage.setItem('revyme:project-name:local', 'Template source');
  }, JSON.stringify(project().page('<div data-id="root">Template source</div>').build()));
  await page.goto('/dashboard');
  const menu = page.getByRole('button', { name: 'Workspace menu' });

  await menu.click();
  await page.getByRole('button', { name: 'Invite to workspace', exact: true }).click();
  const invite = page.getByRole('dialog', { name: 'Invite to workspace' });
  await invite.getByLabel('Email address').fill('example@example.test');
  await invite.getByLabel('Role').selectOption('viewer');
  await expect(invite.getByRole('button', { name: 'Send invite' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(invite).toHaveCount(0);

  await menu.click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  const signOut = page.getByRole('dialog', { name: 'Sign out' });
  await expect(signOut.getByRole('button', { name: 'Sign out', exact: true })).toBeDisabled();
  await signOut.getByRole('button', { name: 'Close dialog' }).click();

  await page.getByRole('button', { name: 'Actions for Template source' }).click();
  await page.getByRole('button', { name: 'Copy Remix Link' }).click();
  const remix = page.getByRole('dialog', { name: 'Copy Remix Link' });
  await expect(remix.getByRole('button', { name: 'Create remix link' })).toBeDisabled();
  await remix.getByRole('button', { name: 'Close dialog' }).click();

  await menu.click();
  await page.getByRole('button', { name: 'Switch to Creator' }).click();
  await page.getByRole('button', { name: 'New template draft' }).click();
  await page.getByLabel('Source website').selectOption('local');
  await page.getByLabel('Template name').fill('My template draft');
  await page.getByLabel('Description').fill('Draft description');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByText('Template draft saved in this browser.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit for review' })).toBeDisabled();
  await page.reload();
  await page.getByRole('button', { name: 'Edit draft' }).click();
  await expect(page.getByLabel('Template name')).toHaveValue('My template draft');
  await expect(page.getByLabel('Description')).toHaveValue('Draft description');

  await menu.click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const tabs = page.getByRole('navigation', { name: 'Settings tabs' });
  const account = page.getByRole('navigation', { name: 'Account settings', exact: true });
  const workspace = page.getByRole('navigation', { name: 'Workspace settings', exact: true });
  await expect(tabs.getByRole('link', { name: 'Account', exact: true })).toHaveAttribute('aria-current', 'true');
  await expect(account.getByRole('link')).toHaveText(['Account', 'Security', 'API Tokens']);
  await expect(workspace).toHaveCount(0);
  await page.getByLabel('First name').fill('Local tester');
  await page.getByRole('button', { name: 'Save account information' }).click();
  await page.getByLabel('Public tag').fill('local-tester');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await page.reload();
  await expect(page.getByLabel('First name')).toHaveValue('Local tester');
  await expect(page.getByLabel('Public tag')).toHaveValue('local-tester');
  await account.getByRole('link', { name: 'Security' }).click();
  await expect(page.getByRole('heading', { name: 'Active sessions' })).toBeVisible();

  await tabs.getByRole('link', { name: 'Workspace', exact: true }).click();
  await expect(tabs.getByRole('link', { name: 'Workspace' })).toHaveAttribute('aria-current', 'true');
  await expect(workspace.getByRole('link')).toHaveText(['General', 'Members', 'Plans', 'Credits', 'Fonts']);
  await expect(account).toHaveCount(0);
  await page.getByLabel('Workspace name').fill('Renamed local workspace');
  await page.getByRole('button', { name: 'Save workspace' }).click();
  await expect(menu).toContainText('Renamed local workspace');

  await workspace.getByRole('link', { name: 'Members' }).click();
  await expect(page.getByRole('heading', { name: 'Invite members' })).toBeVisible();
  await workspace.getByRole('link', { name: 'Plans' }).click();
  await expect(page.getByRole('heading', { name: 'Plans', exact: true })).toBeVisible();
  await workspace.getByRole('link', { name: 'Credits' }).click();
  await expect(page.getByRole('heading', { name: 'Credits', exact: true })).toBeVisible();
  await workspace.getByRole('link', { name: 'Fonts' }).click();
  await expect(page.getByRole('heading', { name: 'Custom fonts' })).toBeVisible();
  await page.getByRole('button', { name: 'Upload font' }).click();
  const fontDialog = page.getByRole('dialog', { name: 'Upload font' });
  await expect(fontDialog.getByRole('button', { name: 'Upload', exact: true })).toBeDisabled();
  await fontDialog.getByRole('button', { name: 'Close dialog' }).click();

  await tabs.getByRole('link', { name: 'Account', exact: true }).click();
  await account.getByRole('link', { name: 'API Tokens', exact: true }).click();
  await page.getByRole('button', { name: 'Create MCP token' }).click();
  const token = page.getByRole('dialog', { name: 'Create MCP token' });
  await token.getByLabel('Token name').fill('Codex test');
  await token.getByLabel('Expiration').selectOption('90');
  await expect(token.getByRole('button', { name: 'Create token', exact: true })).toBeDisabled();
  await token.getByRole('button', { name: 'Close dialog' }).click();

  await tabs.getByRole('link', { name: 'Workspace' }).click();
  await page.getByRole('link', { name: 'AI & MCP' }).click();
  await page.getByLabel('Preferred Vibe provider').selectOption('Claude Code');
  await page.getByRole('button', { name: 'Save preference' }).click();
  await page.reload();
  await expect(page.getByLabel('Preferred Vibe provider')).toHaveValue('Claude Code');
});
