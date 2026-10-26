const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/admin/home');
});

test('admin can navigate to Shops', async ({ page }, testInfo) => {
  const shopsLink = page
    .getByRole('link', { name: 'Shops', exact: true })
    .and(page.locator('a[href="/admin/shops"]'));

  await expect(shopsLink).toBeVisible();
  await shopsLink.click();

  await expect(page).toHaveURL(
    new URL('/admin/shops', testInfo.project.use.baseURL).toString(),
  );
  await expect(page.getByRole('heading', { name: 'Shop List', exact: true })).toBeVisible();
});

test('admin can navigate to Configurations', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: 'System Settings', exact: true }).click();
  const generalSettingsLink = page.getByRole('link', {
    name: 'General Settings',
    exact: true,
  });

  await expect(generalSettingsLink).toHaveAttribute('href', '/admin/configurations');
  await generalSettingsLink.click();

  await expect(page).toHaveURL(
    new URL('/admin/configurations', testInfo.project.use.baseURL).toString(),
  );
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByText('Configurations', { exact: true })).toBeVisible();
});

test('admin can navigate to Catalog Products', async ({ page }, testInfo) => {
  await page.locator('button[data-bs-target="#Catalog"]').click();
  const productsLink = page.locator('#Catalog a[href="/admin/products"]');
  await expect(productsLink).toHaveAttribute('href', '/admin/products');
  await productsLink.click();

  await expect(page).toHaveURL(
    new URL('/admin/products', testInfo.project.use.baseURL).toString(),
  );
  await expect(page.getByRole('heading', { name: 'Catalog Products', exact: true })).toBeVisible();
});

test('admin can navigate to Users List', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: 'Users', exact: true }).click();
  const usersLink = page.getByRole('link', { name: 'Users', exact: true });
  await expect(usersLink).toHaveAttribute('href', '/admin/users');
  await usersLink.click();

  await expect(page).toHaveURL(
    new URL('/admin/users', testInfo.project.use.baseURL).toString(),
  );
  await expect(page.getByRole('heading', { name: 'Users List', exact: true })).toBeVisible();
});

test('admin can navigate to Shipping Profile', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: 'Shipping', exact: true }).click();
  const shippingProfileLink = page.getByRole('link', {
    name: 'Shipping Profile',
    exact: true,
  });
  await expect(shippingProfileLink).toHaveAttribute('href', '/admin/shipping-profile');
  await shippingProfileLink.click();

  await expect(page).toHaveURL(
    new URL('/admin/shipping-profile', testInfo.project.use.baseURL).toString(),
  );
  await expect(
    page.locator('h4').filter({ hasText: 'Shipping Profile' }),
  ).toBeVisible();
});

test('admin can select Rental statistics tab', async ({ page }, testInfo) => {
  const rentalTab = page
    .locator('a.nav-tabs-link')
    .filter({ hasText: /^\s*Rental\s*$/ });
  await rentalTab.click();

  await expect(rentalTab).toHaveClass(/active/);
  await expect(page).toHaveURL(
    new URL('/admin/home', testInfo.project.use.baseURL).toString(),
  );
});

test('admin can access product search controls', async ({ page }, testInfo) => {
  await page.locator('button[data-bs-target="#Catalog"]').click();
  await page.locator('#Catalog a[href="/admin/products"]').click();

  await expect(page.getByRole('heading', { name: 'Catalog Products', exact: true })).toBeVisible();

  const keywordField = page.getByLabel('Keyword', { exact: true });
  await expect(keywordField).toBeVisible();
  await expect(keywordField).toBeEnabled();

  const searchButton = page.getByRole('button', { name: 'Search', exact: true });
  await expect(searchButton).toBeVisible();
  await expect(searchButton).toBeEnabled();
});

test('admin can navigate to Commission Settings', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: 'System Settings', exact: true }).click();
  const commissionSettingsLink = page.getByRole('link', {
    name: 'Commission Settings',
    exact: true,
  });
  await expect(commissionSettingsLink).toHaveAttribute('href', '/admin/commission');
  await commissionSettingsLink.click();

  await expect(page).toHaveURL(
    new URL('/admin/commission', testInfo.project.use.baseURL).toString(),
  );
  await expect(
    page.getByRole('heading', { name: 'Commission Settings List', exact: true }),
  ).toBeVisible();
});
