const { test, expect } = require('../rental/fixture');
const { fs, file, read, authenticate } = require('../../helpers/rental-data');
const { registerBuyer } = require('../../helpers/buyer-account-ui');
const { sourceInventory, pinSource } = require('../../helpers/smoke-branch-data');

test('SC-BR-01 prepare an independent Buyer with explicit inventory prerequisites', async ({ page }, info) => {
  test.setTimeout(90000);
  const { branch, sourceRun } = info.project.metadata;
  if (!fs.existsSync(file('journey'))) sourceInventory(sourceRun, info.project.use.baseURL);
  if (!fs.existsSync(file('buyer-account'))) {
    await registerBuyer(page, info.project.use.baseURL);
  } else {
    const buyer = read('buyer-account');
    expect(buyer.phase, 'An uncertain registration must be reconciled, never resubmitted.').toBe('registered');
    await authenticate(page, buyer, 'buyer', 'buyer');
  }
  pinSource(sourceRun, info.project.use.baseURL, branch);
});
