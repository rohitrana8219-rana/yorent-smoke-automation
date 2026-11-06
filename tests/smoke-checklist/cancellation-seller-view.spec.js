const { test } = require('../rental/fixture');
const { sellerView } = require('../../helpers/cancellation-ui');
for (const source of ['admin', 'seller']) {
  test(`SC-CAN-02 Seller verifies ${source} cancellation, view only`, async ({ page }) => {
    await sellerView(page, source);
  });
}
