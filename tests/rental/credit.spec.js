const { test } = require('./fixture');
const { creditBuyer } = require('../../helpers/buyer-account-ui');

test('credit only the exact registered Buyer and verify the saved ledger', async ({ page }) => {
  test.setTimeout(90000);
  await creditBuyer(page);
});
