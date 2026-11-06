const { test } = require('../rental/fixture');
const { requestCancellation } = require('../../helpers/cancellation-ui');
for (const source of ['admin', 'seller']) {
  test(`SC-CAN-01 Buyer submits and verifies the exact ${source} line's cancellation request`, async ({ page }) => {
    test.setTimeout(90000);
    await requestCancellation(page, source);
  });
}
