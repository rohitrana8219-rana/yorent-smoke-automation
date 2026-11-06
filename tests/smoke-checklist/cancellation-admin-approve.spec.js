const { test } = require('../rental/fixture');
const { approveCancellation } = require('../../helpers/cancellation-ui');
for (const source of ['admin', 'seller']) {
  test(`SC-CAN-03 Admin approves ${source} cancellation and verifies calculated wallet credit`, async ({ page, browser }, info) => {
    test.setTimeout(90000);
    await approveCancellation(page, browser, info.project.use.baseURL, source);
  });
}
