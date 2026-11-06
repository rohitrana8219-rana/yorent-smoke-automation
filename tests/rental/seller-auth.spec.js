const { test, expect } = require('./fixture');
const { read, requireOrder, authenticate } = require('../../helpers/rental-data');
test('authenticate the Seller who owns the paid rental order', async ({ page }) => {
  const data = requireOrder();
  const seller = read('seller-account');
  expect(String(seller.id)).toBe(data.sellerId);
  await authenticate(page, seller, 'seller', 'seller');
});
