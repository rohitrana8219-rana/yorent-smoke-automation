const { test, expect } = require('@playwright/test');
const { randomBytes } = require('crypto');
const { createShippingProfile } = require('../../helpers/shipping-ui');
const { attachRecords } = require('../../helpers/workflow-data');

test('admin can create and retain a shipping profile with its rate', async ({ page }, testInfo) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(15000);
  const suffix = randomBytes(4).toString('hex');
  const profile = { admin: true, name: `QA Ship ${suffix}`, rateName: `QA Rate ${suffix}`, cost: '12.50', days: '2' };
  try {
    await createShippingProfile(page, profile);
    expect(profile.id).toMatch(/^[1-9]\d*$/);
    expect(profile.rateId).toMatch(/^[1-9]\d*$/);
  } finally {
    await attachRecords(testInfo, { shipping: profile });
  }
});
