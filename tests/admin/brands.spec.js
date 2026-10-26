const { test, expect } = require('@playwright/test');
const { randomUUID } = require('crypto');

test('admin can create and persist a brand', async ({ page }, testInfo) => {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 8);
  const brandName = `QA Brand ${suffix}`;
  const brandSlug = `qa-brand-${suffix}`;
  const brandsURL = new URL('/admin/brands', testInfo.project.use.baseURL).toString();
  let createdBrandId = null;
  let submissionAttempted = false;

  try {
    await page.goto('/admin/home', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(
      new URL('/admin/home', testInfo.project.use.baseURL).toString(),
    );

    await page.locator('button[data-bs-target="#Catalog"]').click();
    await page.locator('#Catalog a[href="/admin/brands"]').click();
    await expect(page).toHaveURL(brandsURL);

    const brandRows = page.locator('#frmBrandListing tbody tr');
    await expect(brandRows.first()).toBeVisible();
    const brandRow = brandRows.filter({
      has: page.getByText(brandName, { exact: true }),
    });
    await expect(brandRow).toHaveCount(0);

    await page.locator('a[onclick="addBrandForm(0)"]').click();
    const brandForm = page.locator('.modal.show form#prodBrand');
    await expect(brandForm).toBeVisible();
    await brandForm.locator('input[name="brand_identifier"]').fill(brandName);
    await brandForm.locator('input[name="urlrewrite_custom"]').fill(brandSlug);
    submissionAttempted = true;
    await page.locator('button[type="submit"][name="btn_submit"][form="prodBrand"]').click();

    await expect(page).toHaveURL(brandsURL);
    await expect(brandRow).toHaveCount(1);
    createdBrandId = await brandRow.getAttribute('id');
    expect(createdBrandId).toMatch(/^\d+$/);
    await expect(brandRow.locator('.brand-profile-data .title')).toHaveText(brandName);

    await page.reload();
    await expect(page).toHaveURL(brandsURL);
    await expect(brandRows.first()).toBeVisible();
    await expect(brandRow).toHaveCount(1);
    await expect(brandRow).toHaveAttribute('id', createdBrandId);
    await expect(brandRow.locator('.brand-profile-data .title')).toHaveText(brandName);
  } finally {
    const records = { brand: { name: brandName, id: createdBrandId, submitted: submissionAttempted } };
    console.log('Retained demo records: ' + JSON.stringify(records));
    await testInfo.attach('retained-records', {
      body: JSON.stringify(records, null, 2),
      contentType: 'application/json',
    });
  }
});
