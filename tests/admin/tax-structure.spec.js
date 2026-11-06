const { test, expect } = require('@playwright/test');
const { fillLocalizedName } = require('../../helpers/localized-name');
const { randomUUID } = require('crypto');

test('admin can navigate to Tax Structure', async ({ page }, testInfo) => {
  await page.goto('/admin/home');

  await page.locator('button[data-bs-target="#nav-tax"]').click();
  const taxStructureLink = page.locator('a[href="/admin/tax-structure"]');
  await expect(taxStructureLink).toHaveAttribute('href', '/admin/tax-structure');
  await taxStructureLink.click();

  await expect(page).toHaveURL(
    new URL('/admin/tax-structure', testInfo.project.use.baseURL).toString(),
  );
  await expect(page.getByRole('heading', { name: 'Tax Structure', exact: true })).toBeVisible();
});

test('admin can create and persist a tax structure', async ({ page }, testInfo) => {
  const taxName = `QA-${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const taxStructureURL = new URL(
    '/admin/tax-structure',
    testInfo.project.use.baseURL,
  ).toString();
  let createdTaxId = null;
  let submissionAttempted = false;

  try {
    await page.goto('/admin/home');
    await expect(page).toHaveURL(
      new URL('/admin/home', testInfo.project.use.baseURL).toString(),
    );

    await page.locator('button[data-bs-target="#nav-tax"]').click();
    await page.locator('a[href="/admin/tax-structure"]').click();
    await expect(page).toHaveURL(taxStructureURL);

    const taxList = page.locator('#taxStrListing');
    await expect(taxList).toBeVisible();
    const taxRows = page.locator('#taxStrListing tbody tr');
    const taxRow = taxRows.filter({
      has: page.getByText(taxName, { exact: true }),
    });
    await expect(taxRow).toHaveCount(0);

    await page.locator('a[onclick="addStructureForm(0)"]').click();
    const taxForm = page.locator('.modal.show form#frm_fat_id_frmTaxStructure');
    await expect(taxForm).toBeVisible();
    await expect(taxForm.locator('input[name="taxstr_is_combined"]')).not.toBeChecked();
    await fillLocalizedName(taxForm, 'taxstr_name', taxName);
    submissionAttempted = true;
    await page
      .locator(
        'button[type="submit"][name="btn_submit"][form="frm_fat_id_frmTaxStructure"]',
      )
      .click();

    await expect(page).toHaveURL(taxStructureURL);
    await expect(taxRow).toHaveCount(1);
    createdTaxId = await taxRow.getAttribute('id');
    expect(createdTaxId).toMatch(/^\d+$/);

    await page.reload();
    await expect(page).toHaveURL(taxStructureURL);
    await expect(taxList).toBeVisible();
    await expect(taxRow).toHaveCount(1);
    await expect(taxRow).toHaveAttribute('id', createdTaxId);
    await expect(taxRow).toContainText(taxName);
  } finally {
    const records = { taxStructure: { name: taxName, id: createdTaxId, submitted: submissionAttempted } };
    console.log('Retained demo records: ' + JSON.stringify(records));
    await testInfo.attach('retained-records', {
      body: JSON.stringify(records, null, 2),
      contentType: 'application/json',
    });
  }
});
