const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const LoginPage = require('../pages/LoginPage');

const authFile = path.join(__dirname, '..', '.auth', 'admin.json');

test('authenticate admin and save browser state', async ({ page }, testInfo) => {
  fs.rmSync(authFile, { force: true });

  const username = process.env.YORENT_ADMIN_USERNAME;
  const password = process.env.YORENT_ADMIN_PASSWORD;

  if (!username || !password) {
    throw new Error(
      'YORENT_ADMIN_USERNAME and YORENT_ADMIN_PASSWORD must be set to generate admin storage state.',
    );
  }

  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(username, password);
  await expect(page).toHaveURL(
    new URL('/admin/home', testInfo.project.use.baseURL).toString(),
  );

  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  await page.context().storageState({ path: authFile });
});
