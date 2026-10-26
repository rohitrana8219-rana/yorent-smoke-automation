const { test, expect } = require('@playwright/test');
const { randomBytes } = require('crypto');
const { addProductOption, saveCatalogForm } = require('../../helpers/catalog-ui');
const { createShippingProfile } = require('../../helpers/shipping-ui');
const { writeData } = require('../../helpers/workflow-data');

test('admin can create a catalog product with its own category, brand and tax data', async ({ page }, testInfo) => {
  test.setTimeout(300000);
  page.setDefaultTimeout(15000);
  const suffix = randomBytes(4).toString('hex');
  const category = { name: `QA Tools ${suffix}`, identifier: `qa-tools-${suffix}` };
  const brand = { name: `QA Brand ${suffix}`, slug: `qa-brand-${suffix}` };
  const structure = { name: `QA Tax ${suffix}` };
  const taxCategory = { name: `QA Tax Class ${suffix}`, code: suffix };
  const rule = { name: `QA Rule ${suffix}` };
  const product = { name: `Cordless Drill ${suffix}`, identifier: `QA-DRILL-${suffix}` };
  const option = { name: `QA Size ${suffix}`, value: 'Standard' };
  let shipping;
  let complete = false;
  writeData('admin-workflow', { origin: testInfo.project.use.baseURL, complete });

  // These small helpers keep the repeated UI operations consistent within this test.
  const exactRow = (selector, name) => page.locator(selector).filter({
    has: page.getByText(name, { exact: true }),
  });
  async function captureId(row, record) {
    await expect(row).toHaveCount(1);
    const id = await row.getAttribute('id');
    expect(id).toMatch(/^[1-9]\d*$/);
    record.id = id;
  }
  async function search(form, keyword) {
    await expect(page.locator('.loaderJs')).toHaveCount(0);
    await form.locator('input[name="keyword"]').fill(keyword);
    await form.locator('[name="btn_submit"]').click();
    await expect(page.locator('.loaderJs')).toHaveCount(0);
  }
  async function chooseSearchResult(field, name, id) {
    await page.locator(`#select2-${field}-container`).click();
    await page.locator('.select2-container--open input.select2-search__field').fill(name);
    await page.getByRole('treeitem', { name, exact: true }).click();
    await expect(page.locator(`select[name="${field}"]`)).toHaveValue(id);
  }

  try {
    await test.step('Create the product and its prerequisites', async () => {
      await test.step('Create a root category', async () => {
        await page.goto('/admin/product-categories');
        await expect(page.locator('#sorting-categories')).toBeVisible();
        await expect(exactRow('#sorting-categories > li', category.name)).toHaveCount(0);
        await page.locator('a[href="/admin/product-categories/form/0"]').click();
        const form = page.locator('#frmProdCategory');
        await expect(form.locator('input[name="parent_category_name"]')).toHaveValue('Root Category');
        await expect(form.locator('input[name="prodcat_parent"]')).toHaveValue('0');
        await form.locator('input[name="prodcat_identifier"]').fill(category.identifier);
        await form.locator('input[name="prodcat_name[1]"]').fill(category.name);
        category.submitted = true;
        await form.locator('input[name="btn_submit"]').click();
        await expect(page).toHaveURL(/\/admin\/product-categories\/form\/[1-9]\d*$/);
        await expect(form.locator('input[name="prodcat_identifier"]')).toHaveValue(category.identifier);
        await expect(form.locator('input[name="prodcat_name[1]"]')).toHaveValue(category.name);
        category.id = new URL(page.url()).pathname.match(/\/form\/([1-9]\d*)$/)[1];
      });

      await test.step('Create a brand', async () => {
        await page.goto('/admin/brands');
        await search(page.locator('form[name="frmSearch"]'), brand.name);
        const row = exactRow('#frmBrandListing tbody tr', brand.name);
        await expect(row).toHaveCount(0);
        await page.locator('a[onclick="addBrandForm(0)"]').click();
        const form = page.locator('.modal.show form#prodBrand');
        await form.locator('input[name="brand_identifier"]').fill(brand.name);
        await form.locator('input[name="urlrewrite_custom"]').fill(brand.slug);
        brand.submitted = true;
        await page.locator('button[form="prodBrand"][name="btn_submit"]').click();
        await captureId(row, brand);
      });

      await test.step('Create a tax structure', async () => {
        await page.goto('/admin/tax-structure');
        const row = exactRow('#taxStrListing tbody tr', structure.name);
        await expect(page.locator('#taxStrListing')).toBeVisible();
        await expect(row).toHaveCount(0);
        await page.locator('a[onclick="addStructureForm(0)"]').click();
        const form = page.locator('.modal.show form#frm_fat_id_frmTaxStructure');
        await expect(form.locator('input[name="taxstr_is_combined"]')).not.toBeChecked();
        await form.locator('input[name="taxstr_name[1]"]').fill(structure.name);
        structure.submitted = true;
        await page.locator('button[form="frm_fat_id_frmTaxStructure"][name="btn_submit"]').click();
        await captureId(row, structure);
      });

      await test.step('Create a tax category and link its rule to the new structure', async () => {
        await page.goto('/admin/tax');
        await search(page.locator('form[name="frmTaxSearch"]'), taxCategory.name);
        const row = exactRow('#frmTaxListing tbody tr', taxCategory.name);
        await expect(row).toHaveCount(0);
        await page.locator('a[onclick="addTaxForm(0)"]').click();
        const form = page.locator('.modal.show form[name="frmTax"]');
        await form.locator('input[name="taxcat_identifier"]').fill(taxCategory.name);
        await form.locator('input[name="taxcat_code"]').fill(taxCategory.code);
        taxCategory.submitted = true;
        await page.locator('.modal.show [name="btn_submit"]').click();
        await captureId(row, taxCategory);
        await page.goto(`/admin/tax/rule-list/${taxCategory.id}`);
        await page.locator(`a[onclick="ruleForm('${taxCategory.id}')"]`).click();
        const ruleForm = page.locator('form[name="frmTaxRule"]');
        await ruleForm.locator('input[name="taxrule_name"]').fill(rule.name);
        await ruleForm.locator('input[name="trr_rate"]').fill('5');
        await ruleForm.locator('select[name="taxrule_taxstr_id"]').selectOption({ label: structure.name });
        await expect(ruleForm.locator('select[name="taxrule_taxstr_id"]')).toHaveValue(structure.id);
        await ruleForm.locator('select[name="taxruleloc_from_country_id"]').selectOption({ label: 'Rest Of The World' });
        await expect(ruleForm.locator('select[name="taxruleloc_from_state_id[]"]')).toHaveValues(['-1']);
        await ruleForm.locator('select[name="taxruleloc_to_country_id"]').selectOption({ label: 'Rest Of The World' });
        await expect(ruleForm.locator('select[name="taxruleloc_type"]')).toHaveValue('-1');
        rule.submitted = true;
        await ruleForm.locator('input[name="btn_submit"]').click();
        const ruleRow = exactRow('main table tbody tr', rule.name);
        await captureId(ruleRow, rule);
        await expect(ruleRow).toContainText(structure.name);
        await expect(ruleRow).toContainText('5.00');
      });

      await test.step('Create a product option with a Standard value', async () => {
        await page.goto('/admin/options', { waitUntil: 'domcontentloaded' });
        await page.locator('a[onclick="addOptionFormNew(0)"]').click();
        const form = page.locator('form[name="frmOptions"]');
        await form.locator('input[name="option_identifier"]').fill(option.name);
        await form.locator('input[name="option_name1"]').fill(option.name);
        await form.locator('select[name="option_is_separate_images"]').selectOption('0');
        await form.locator('select[name="option_is_color"]').selectOption('0');
        await form.locator('select[name="option_display_in_filter"]').selectOption('1');
        await form.locator('input[name="btn_submit"]').click();
        const values = page.locator('form[name="frmOptionValues"]');
        await expect(values).toBeVisible();
        option.id = await values.locator('input[name="optionvalue_option_id"]').inputValue();
        expect(option.id).toMatch(/^[1-9]\d*$/);
        await values.locator('input[name="optionvalue_identifier"]').fill(option.value);
        await values.locator('input[name="optionvalue_name1"]').fill(option.value);
        await values.locator('input[name="btn_submit"]').click();
        await expect(page.locator('#optionvalues')).toContainText(option.value);
      });

      await test.step('Create and verify a shipping profile and its two-day rate', async () => {
        shipping = {
          admin: true, name: `QA Ship ${suffix}`, rateName: `QA Delivery ${suffix}`,
          cost: '12.50', days: '2',
        };
        await createShippingProfile(page, shipping);
      });

      await test.step('Create a cordless drill using the new category, brand and tax category', async () => {
        await page.goto('/admin/products');
        await search(page.locator('#frmSearch'), product.identifier);
        await expect(page.locator('#frmProdListing input[name="product_ids[]"]')).toHaveCount(0);
        await page.locator('a[href="/admin/products/single-form"]').click();
        const form = page.locator('#addProductfrm');
        await form.locator('input[name="product_identifier"]').fill(product.identifier);
        await form.locator('input[name="product_name"]').fill(product.name);
        await chooseSearchResult('ptc_prodcat_id', category.name, category.id);
        await chooseSearchResult('product_brand_id', brand.name, brand.id);
        await form.locator('input[name="product_min_selling_price"]').fill('149.99');
        await form.locator('select[name="ptt_taxcat_id_rent"]').selectOption({ label: taxCategory.name });
        await form.locator('select[name="ptt_taxcat_id"]').selectOption({ label: taxCategory.name });
        await form.locator('input[name="product_model"]').fill(`CD18-${suffix}`);
        await form.locator('input[name="product_warranty"]').fill('365');
        await form.locator('input[name="product_weight"]').fill('1.8');
        await form.locator('select[name="product_weight_unit"]').selectOption({ label: 'Kilogram' });
        await form.locator('select[name="shipping_profile"]').selectOption(shipping.id);
        await form.locator('select[name="product_fulfillment_type"]').selectOption({ label: 'Ship Only' });
        await addProductOption(page, option);
        await form.locator('input[name="product_active"]').check();
        await form.locator('input[name="product_approved"]').check();
        product.submitted = true;
        await form.locator('input[name="btn_submit"]').click();
        await expect(page).toHaveURL(/\/admin\/products\/single-form\/[1-9]\d*$/);
        product.id = new URL(page.url()).pathname.match(/\/single-form\/([1-9]\d*)$/)[1];
        await page.reload();
        await expect(form.locator('input[name="product_identifier"]')).toHaveValue(product.identifier);
        await expect(form.locator('input[name="product_name"]')).toHaveValue(product.name);
        await expect(form.locator('select[name="ptc_prodcat_id"]')).toHaveValue(category.id);
        await expect(form.locator('select[name="product_brand_id"]')).toHaveValue(brand.id);
        await expect(form.locator('select[name="ptt_taxcat_id_rent"]')).toHaveValue(taxCategory.id);
        await expect(form.locator('select[name="ptt_taxcat_id"]')).toHaveValue(taxCategory.id);
        await expect(form.locator('select[name="shipping_profile"]')).toHaveValue(shipping.id);
        await expect(form.locator('input[name="prod_options[]"]')).toHaveValue(option.id);
        await expect(form.locator('input[name="product_active"]')).toBeChecked();
        await expect(form.locator('input[name="product_approved"]')).toBeChecked();
        product.model = `CD18-${suffix}-v2`;
        await form.locator('input[name="product_model"]').fill(product.model);
        await saveCatalogForm(page);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(form.locator('input[name="product_model"]')).toHaveValue(product.model);
        await expect(form.locator('select[name="product_fulfillment_type"]')).toHaveValue('2');
        await page.goto('/admin/products');
        await search(page.locator('#frmSearch'), product.identifier);
        const row = page.locator('#frmProdListing tbody tr').filter({ has: page.locator(`img[alt="${product.name}"]`) });
        await expect(row).toHaveCount(1);
        await expect(row).toContainText(product.name);
        await expect(row).toContainText(product.identifier);
        await expect(row).toContainText('Admin');
        await expect(row).toContainText('Approved');
        await expect(row.locator('a[title="Edit"]')).toHaveAttribute('href', `/admin/products/single-form/${product.id}`);
        complete = true;
      });
    }, { timeout: 180000 });
  } finally {
    const records = { category, brand, structure, taxCategory, rule, option, shipping, product };
    const workflow = { origin: testInfo.project.use.baseURL, complete, ...records };
    writeData('admin-workflow', workflow);
    writeData(`admin-workflow-${suffix}`, workflow);
    console.log('Retained demo records: ' + JSON.stringify(records));
    await testInfo.attach('retained-records', {
      body: JSON.stringify(records, null, 2),
      contentType: 'application/json',
    });
  }
});
