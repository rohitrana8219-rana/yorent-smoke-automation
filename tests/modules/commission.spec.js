const { test, expect } = require('@playwright/test');

test('admin can inspect persisted default commission fees without changing them', async ({ page }) => {
  test.setTimeout(60000);
  async function readDefaults() {
    await page.goto('/admin/commission', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Commission Settings List', exact: true })).toBeVisible();
    const rows = page.locator('main table tbody tr').filter({
      has: page.locator('a[title="Edit"]'), hasNot: page.locator('a[title="Delete"]'),
    });
    await expect(rows).toHaveCount(2);
    const actions = await rows.locator('a[title="Edit"]').evaluateAll(es => es.map(e => e.getAttribute('onclick')));
    const fees = {};
    for (const action of actions) {
      expect(action).toMatch(/^editCommissionForm\([1-9]\d*\)$/);
      await page.locator(`a[onclick='${action}']`).click();
      const form = page.locator('form[name="frmCommission"]');
      await expect(form).toBeVisible();
      for (const field of ['commsetting_prodcat_id', 'commsetting_user_id', 'commsetting_product_id']) {
        // The verified default dialog has no category/seller/product targeting controls.
        await expect(form.locator(`input[name="${field}"]`)).toHaveCount(0);
      }
      const type = await form.locator('select[name="commsetting_type"]').inputValue();
      expect(['1', '2']).toContain(type);
      const fee = Number(await form.locator('input[name="commsetting_fees"]').inputValue());
      expect(Number.isFinite(fee)).toBe(true);
      expect(fee).toBeGreaterThanOrEqual(0);
      expect(fee).toBeLessThanOrEqual(100);
      fees[type] = fee;
      // Read only: close the dialog without touching Save.
      await page.locator('.modal.show [data-bs-dismiss="modal"]').click();
      await expect(form).toBeHidden();
    }
    expect(Object.keys(fees).sort()).toEqual(['1', '2']);
    return fees;
  }
  const before = await readDefaults();
  expect(await readDefaults()).toEqual(before);
});
