const { expect } = require('@playwright/test');
const { fillLocalizedName } = require('./localized-name');
const { expectEnglishURL } = require('./public-routes');

async function submitShippingForm(page, form, admin) {
  if (await form.locator('[name="btn_submit"]').count()) {
    await form.locator('[name="btn_submit"]').click();
  } else {
    const id = await form.getAttribute('id');
    await page.locator(`button[form="${id}"][name="btn_submit"]`).click();
  }
}

async function createShippingProfile(page, profile) {
  const { admin, name, rateName, cost, days } = profile;
  const route = admin ? '/admin/shipping-profile' : '/en/shipping-profile';
  await page.goto(`${route}/form/0`, { waitUntil: 'domcontentloaded' });
  const form = page.locator('form[name="frmShippingProfile"]');
  await fillLocalizedName(form, 'shipprofile_name', name);
  await form.locator('input[name="btn_submit"]').click();
  if (admin) await expect(page).toHaveURL(new RegExp(`${route}/form/[1-9]\\d*$`));
  else await expectEnglishURL(page, /^\/shipping-profile\/form\/[1-9]\d*$/);
  const id = await form.locator('input[name="shipprofile_id"]').inputValue();
  profile.id = id;
  async function reloadProfile() {
    // The profile HTML arrives before its shipping-zone table. Wait for that
    // observed read request, then assert the saved rate in the rendered table.
    const zones = page.waitForResponse(response => response.request().method() === 'POST'
      && new URL(response.url()).pathname.endsWith(`/shipping-zones/search/${id}`));
    await page.reload({ waitUntil: 'domcontentloaded' });
    const response = await zones;
    expect(response.ok()).toBe(true);
    await response.finished();
  }
  await reloadProfile();
  await expect(form.locator('input[name="shipprofile_name[1]"]')).toHaveValue(name);
  const edit = page.locator(admin
    ? 'a[onclick^="addEditShipRates("]'
    : 'button[title="Edit"][onclick^="addEditShipRates("]');
  await expect(edit).toHaveCount(1);
  const action = await edit.getAttribute('onclick');
  const match = action.match(/^addEditShipRates\((\d+),\s*(\d+)\);?$/);
  expect(match).not.toBeNull();
  profile.zoneId = match[1];
  profile.rateId = match[2];
  await edit.click();
  const rate = page.locator('form[name="frmShippingRates"]');
  await rate.locator('input[name="shiprate_identifier"]').fill(rateName);
  await rate.locator('input[name="shiprate_cost"]').fill(cost);
  await rate.locator('input[name="shiprate_min_duration"]').fill(days);
  await submitShippingForm(page, rate, admin);
  const languageForm = page.locator('form:has(input[name="shiprate_name"])');
  await languageForm.locator('input[name="shiprate_name"]').fill(rateName);
  // General saves first, then the UI opens the English rate-name form.
  const saved = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname.endsWith('/lang-setup'));
  await submitShippingForm(page, languageForm, admin);
  await (await saved).finished();
  await expect(page.locator('tr').filter({ has: page.getByText(rateName, { exact: true }) })).toContainText(`$${cost}`);
  await reloadProfile();
  const row = page.locator('tr').filter({ has: page.getByText(rateName, { exact: true }) });
  await expect(row).toContainText(`$${cost}`);
  await expect(row).toContainText(`${days} (Days)`);
  await edit.click();
  await expect(rate.locator('input[name="shiprate_cost"]')).toHaveValue(cost);
  await expect(rate.locator('input[name="shiprate_min_duration"]')).toHaveValue(days);
  return profile;
}

module.exports = { createShippingProfile };
