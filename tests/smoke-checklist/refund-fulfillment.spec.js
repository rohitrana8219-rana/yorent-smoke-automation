const { test, expect } = require('../rental/fixture');
const { branchData } = require('../../helpers/smoke-branch-data');
const { fulfill, lineIdentity } = require('../../helpers/rental-orders-ui');
const { refundView } = require('../../helpers/refund-ui');
for (const source of ['admin', 'seller']) {
  test(`SC-REF-01 Seller delivers the distinct ${source} refund line`, async ({ page }) => {
    test.setTimeout(120000);
    const data = branchData('refund');
    if (data.lifecycle.requests[source]) {
      expect(data.lifecycle.requests[source].fulfillmentAtRequest).toBe('Delivered');
      await refundView(page, data, source, 'seller');
    } else await fulfill(page, data, source);
  });
}
