const { test, expect } = require('@playwright/test');
const { randomUUID } = require('crypto');

test('admin can create and persist a brand', async ({ page }, testInfo) => {
  const suffix = randomUUID();
  const brandName = `QA Smoke Brand ${suffix}`;
  const brandSlug = `qa-smoke-brand-${suffix}`;
  const brandsURL = new URL('/admin/brands', testInfo.project.use.baseURL).toString();
  let authenticated = false;
  let createdBrandId = null;
  let submissionAttempted = false;
  let testError = null;

  try {
    await page.goto('/admin/home');
    await expect(page).toHaveURL(
      new URL('/admin/home', testInfo.project.use.baseURL).toString(),
    );
    authenticated = true;

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
    try {
      await expect(brandRow).toHaveCount(1);
    } catch (error) {
      const visiblePageText = (await page.locator('body').innerText()).trim();
      throw new Error(
        `Brand was not found in the list after saving. Visible page text: ${visiblePageText}\n${error.message}`,
      );
    }
    createdBrandId = await brandRow.getAttribute('id');
    expect(createdBrandId).toMatch(/^\d+$/);
    await expect(brandRow.locator('.brand-profile-data .title')).toHaveText(brandName);

    await page.reload();
    await expect(page).toHaveURL(brandsURL);
    await expect(brandRows.first()).toBeVisible();
    await expect(brandRow).toHaveCount(1);
    await expect(brandRow).toHaveAttribute('id', createdBrandId);
    await expect(brandRow.locator('.brand-profile-data .title')).toHaveText(brandName);
  } catch (error) {
    testError = error;
    throw error;
  } finally {
    try {
      if (authenticated) {
        if (!submissionAttempted) {
          console.warn('Brand cleanup skipped because submission was not attempted.');
        } else {
          await page.goto(brandsURL);
          const brandRows = page.locator('#frmBrandListing tbody tr');
          await expect(brandRows.first()).toBeVisible();

          const brandRow = brandRows.filter({
            has: page.getByText(brandName, { exact: true }),
          });
          const matchingRows = await brandRow.count();

          if (matchingRows === 1) {
            const brandId = await brandRow.getAttribute('id');
            if (!/^\d+$/.test(brandId)) {
              throw new Error('Brand cleanup could not confirm a numeric record ID; left the record untouched.');
            }

            if (createdBrandId === null) {
              const editControl = brandRow.locator('a[title="Edit"][onclick^="addBrandForm("]');
              await expect(editControl).toHaveCount(1);
              await expect(editControl).toHaveAttribute('onclick', `addBrandForm(${brandId})`);
              await editControl.click();

              const recoveryForm = page.locator('.modal.show form#prodBrand');
              await expect(recoveryForm).toBeVisible();
              await expect(recoveryForm.locator('input[name="brand_identifier"]')).toHaveValue(brandName);
              await expect(recoveryForm.locator('input[name="urlrewrite_custom"]')).toHaveValue(brandSlug);
              await expect(recoveryForm.locator('input[name="brand_id"]')).toHaveValue(brandId);
              createdBrandId = brandId;

              // Leave the edit form without saving, then revalidate the exact listing row.
              await page.goto(brandsURL);
              await expect(brandRows.first()).toBeVisible();
              await expect(brandRow).toHaveCount(1);
              await expect(brandRow).toHaveAttribute('id', createdBrandId);
            }

            const deleteControl = brandRow.locator(
              'a[title="Delete"][onclick^="deleteRecord("]',
            );
            if (
              brandId === createdBrandId &&
              /^\d+$/.test(brandId) &&
              (await deleteControl.count()) === 1
            ) {
              await expect(deleteControl).toHaveAttribute(
                'onclick',
                `deleteRecord(${brandId})`,
              );
              const dialogPromise = page.waitForEvent('dialog');
              const deletePromise = deleteControl.click();
              const dialog = await dialogPromise;
              await dialog.accept();
              await deletePromise;
              await expect(brandRow).toHaveCount(0);
            } else {
              throw new Error('Could not uniquely identify the created brand delete action; left the record untouched.');
            }
          } else if (matchingRows > 1) {
            throw new Error('Multiple brands matched the unique test name; left them untouched.');
          } else {
            console.warn('Brand cleanup skipped because no matching row was found.');
          }
        }
      }
    } catch (cleanupError) {
      if (testError) {
        console.error(`Brand cleanup failed after the test error: ${cleanupError.message}`);
      } else {
        throw cleanupError;
      }
    }
  }
});
