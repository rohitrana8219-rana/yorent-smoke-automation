const { test } = require('./fixture');
const { read, authenticate } = require('../../helpers/rental-data');
test('authenticate the exact retained Buyer in a fresh context', async ({ page }) => {
  await authenticate(page, read('buyer-account'), 'buyer', 'buyer');
});
