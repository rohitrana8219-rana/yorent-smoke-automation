const { test, expect } = require('@playwright/test');
const { fillLocalizedName } = require('../../helpers/localized-name');
const { randomBytes } = require('crypto');
const { attachRecords } = require('../../helpers/workflow-data');

test.describe.serial('Tax Structure + Tax Category + Tax Rule', () => {
  const suffix = randomBytes(4).toString('hex');
  const structure = { name: `QA Tax ${suffix}` };
  const category = { name: `QA Class ${suffix}`, code: suffix };
  const rule = { name: `QA Rule ${suffix}` };
  const exactRow = (page, selector, name) => page.locator(selector).filter({ has: page.getByText(name, { exact: true }) });
  async function capture(row, record) {
    await expect(row).toHaveCount(1);
    record.id = await row.getAttribute('id');
    expect(record.id).toMatch(/^[1-9]\d*$/);
  }
  test.afterEach(async ({}, testInfo) => {
    await attachRecords(testInfo, { structure, category, rule });
  });

  test('create and retain the tax structure', async ({ page }) => {
    await page.goto('/admin/tax-structure', { waitUntil: 'domcontentloaded' });
    await page.locator('a[onclick="addStructureForm(0)"]').click();
    const form = page.locator('form#frm_fat_id_frmTaxStructure');
    await expect(form.locator('input[name="taxstr_is_combined"]')).not.toBeChecked();
    await fillLocalizedName(form, 'taxstr_name', structure.name);
    await page.locator('button[form="frm_fat_id_frmTaxStructure"][name="btn_submit"]').click();
    const row = exactRow(page, '#taxStrListing tbody tr', structure.name);
    await capture(row, structure);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(row).toHaveAttribute('id', structure.id);
  });

  test('create and retain the tax category', async ({ page }) => {
    await page.goto('/admin/tax', { waitUntil: 'domcontentloaded' });
    const search = page.locator('form[name="frmTaxSearch"]');
    await search.locator('input[name="keyword"]').fill(category.name);
    await search.locator('[name="btn_submit"]').click();
    await page.locator('a[onclick="addTaxForm(0)"]').click();
    const form = page.locator('.modal.show form[name="frmTax"]');
    await form.locator('input[name="taxcat_identifier"]').fill(category.name);
    await form.locator('input[name="taxcat_code"]').fill(category.code);
    await page.locator('.modal.show [name="btn_submit"]').click();
    const row = exactRow(page, '#frmTaxListing tbody tr', category.name);
    await capture(row, category);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await search.locator('input[name="keyword"]').fill(category.name);
    await search.locator('[name="btn_submit"]').click();
    await expect(row).toHaveAttribute('id', category.id);
  });

  test('link and persist a five percent tax rule', async ({ page }) => {
    expect(structure.id).toMatch(/^[1-9]\d*$/);
    expect(category.id).toMatch(/^[1-9]\d*$/);
    await page.goto(`/admin/tax/rule-list/${category.id}`, { waitUntil: 'domcontentloaded' });
    await page.locator(`a[onclick="ruleForm('${category.id}')"]`).click();
    const form = page.locator('form[name="frmTaxRule"]');
    await form.locator('input[name="taxrule_name"]').fill(rule.name);
    await form.locator('input[name="trr_rate"]').fill('5');
    await form.locator('select[name="taxrule_taxstr_id"]').selectOption(structure.id);
    await form.locator('select[name="taxruleloc_from_country_id"]').selectOption({ label: 'Rest Of The World' });
    await expect(form.locator('select[name="taxruleloc_from_state_id[]"]')).toHaveValues(['-1']);
    await form.locator('select[name="taxruleloc_to_country_id"]').selectOption({ label: 'Rest Of The World' });
    await expect(form.locator('select[name="taxruleloc_type"]')).toHaveValue('-1');
    await form.locator('input[name="btn_submit"]').click();
    const row = exactRow(page, 'main table tbody tr', rule.name);
    await capture(row, rule);
    await expect(row).toContainText(structure.name);
    await expect(row).toContainText('5.00');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(row).toHaveAttribute('id', rule.id);
    await expect(row).toContainText(structure.name);
    await expect(row).toContainText('5.00');
  });
});
