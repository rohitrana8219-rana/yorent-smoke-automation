const { test, expect } = require('@playwright/test');
const LoginPage = require('../../pages/LoginPage');

test('admin can sign in with valid credentials', async ({ page }, testInfo) => {
  const loginPage = new LoginPage(page);
  const username = process.env.YORENT_ADMIN_USERNAME;
  const password = process.env.YORENT_ADMIN_PASSWORD;

  test.skip(
    !username || !password,
    'Set YORENT_ADMIN_USERNAME and YORENT_ADMIN_PASSWORD to run this test.',
  );

  await loginPage.goto();
  await loginPage.login(username, password);
  await expect(page).toHaveURL(
    new URL('/admin/home', testInfo.project.use.baseURL).toString(),
  );
});

test('admin cannot sign in with invalid credentials', async ({ page }, testInfo) => {
  const loginPage = new LoginPage(page);

  await loginPage.goto();
  await loginPage.login('qa-invalid-user-not-a-real-account', 'invalid-password-for-qa');

  await expect(page.getByText('Invalid Username Or Password', { exact: true })).toBeVisible();
  await expect(page).not.toHaveURL(
    new URL('/admin/home', testInfo.project.use.baseURL).toString(),
  );
});

test('admin dashboard loads after login', async ({ page }, testInfo) => {
  const username = process.env.YORENT_ADMIN_USERNAME;
  const password = process.env.YORENT_ADMIN_PASSWORD;

  test.skip(
    !username || !password,
    'Set YORENT_ADMIN_USERNAME and YORENT_ADMIN_PASSWORD to run this test.',
  );

  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(username, password);

  await expect(page).toHaveURL(
    new URL('/admin/home', testInfo.project.use.baseURL).toString(),
  );
  await expect(page.getByRole('heading', { name: 'Statistics', exact: true })).toBeVisible();
});
