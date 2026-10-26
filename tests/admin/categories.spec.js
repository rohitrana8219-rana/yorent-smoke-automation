const { test, expect } = require('@playwright/test');
const { randomUUID } = require('crypto');

test('admin can navigate to Categories', async ({ page }, testInfo) => {
  await page.goto('/admin/home');

  await page.locator('button[data-bs-target="#Catalog"]').click();
  const categoriesLink = page.locator('#Catalog a[href="/admin/product-categories"]');
  await expect(categoriesLink).toHaveAttribute('href', '/admin/product-categories');
  await categoriesLink.click();

  await expect(page).toHaveURL(
    new URL('/admin/product-categories', testInfo.project.use.baseURL).toString(),
  );
  await expect(page.getByRole('heading', { name: 'Categories', exact: true })).toBeVisible();
});

test('admin can create and persist a category', async ({ page }, testInfo) => {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 8);
  const categoryName = `QA Category ${suffix}`;
  const categoryIdentifier = `qa-category-${suffix}`;
  const categoriesURL = new URL(
    '/admin/product-categories',
    testInfo.project.use.baseURL,
  ).toString();
  let createdCategoryId = null;
  let submissionAttempted = false;

  try {
    await page.goto('/admin/home');
    await expect(page).toHaveURL(
      new URL('/admin/home', testInfo.project.use.baseURL).toString(),
    );

    await page.locator('button[data-bs-target="#Catalog"]').click();
    await page.locator('#Catalog a[href="/admin/product-categories"]').click();
    await expect(page).toHaveURL(categoriesURL);
    await expect(page.locator('#sorting-categories')).toBeVisible();
    await expect(page.locator('#sorting-categories > li').first()).toBeVisible();

    const categoryRow = page
      .locator('#sorting-categories > li')
      .filter({ has: page.getByText(categoryName, { exact: true }) });
    await expect(categoryRow).toHaveCount(0);

    await page.locator('a[href="/admin/product-categories/form/0"]').click();
    await expect(page).toHaveURL(
      new URL('/admin/product-categories/form/0', testInfo.project.use.baseURL).toString(),
    );

    const parentCategory = page.locator(
      '#frmProdCategory input[name="parent_category_name"]',
    );
    await expect(parentCategory).not.toHaveValue('');
    await page.locator('#frmProdCategory input[name="prodcat_identifier"]').fill(categoryIdentifier);
    await page.locator('#frmProdCategory input[name="prodcat_name[1]"]').fill(categoryName);
    submissionAttempted = true;
    await page.locator('#frmProdCategory input[name="btn_submit"]').click();

    await expect(page).toHaveURL(/\/admin\/product-categories\/form\/\d+$/);
    await expect(page).toHaveURL(url =>
      url.origin === new URL(categoriesURL).origin &&
      /^\/admin\/product-categories\/form\/[1-9]\d*$/.test(url.pathname),
    );
    await expect(
      page.locator('#frmProdCategory input[name="prodcat_identifier"]'),
    ).toHaveValue(categoryIdentifier);
    await expect(
      page.locator('#frmProdCategory input[name="prodcat_name[1]"]'),
    ).toHaveValue(categoryName);

    const savedCategoryURL = new URL(page.url());
    expect(savedCategoryURL.origin).toBe(new URL(categoriesURL).origin);
    const savedCategoryId = savedCategoryURL.pathname.match(
      /^\/admin\/product-categories\/form\/([1-9]\d*)$/,
    )?.[1];
    expect(savedCategoryId).toMatch(/^\d+$/);
    createdCategoryId = savedCategoryId;

    await page.goto(categoriesURL);
    await expect(page).toHaveURL(categoriesURL);
    await expect(categoryRow).toHaveCount(1);
    await expect(categoryRow.locator('.sorting-title > span')).toHaveText(categoryName);
    expect(createdCategoryId).toMatch(/^\d+$/);
    await expect(categoryRow).toHaveAttribute('id', createdCategoryId);

    await page.reload();
    await expect(page).toHaveURL(categoriesURL);
    await expect(categoryRow).toHaveCount(1);
    await expect(categoryRow).toHaveAttribute('id', createdCategoryId);
    await expect(categoryRow.locator('.sorting-title > span')).toHaveText(categoryName);
  } finally {
    const records = { category: { name: categoryName, id: createdCategoryId, submitted: submissionAttempted } };
    console.log('Retained demo records: ' + JSON.stringify(records));
    await testInfo.attach('retained-records', {
      body: JSON.stringify(records, null, 2),
      contentType: 'application/json',
    });
  }
});
