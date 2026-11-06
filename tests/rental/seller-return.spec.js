const { test } = require('./fixture');
const { requireOrder } = require('../../helpers/rental-data');
const { receive } = require('../../helpers/rental-orders-ui');
for (const source of ['admin', 'seller']) {
  test('seller-return: exact ' + source + ' inventory suborder', async ({ page }) => {
    test.setTimeout(120000);
    await receive(page, requireOrder(), source);
  });
}
