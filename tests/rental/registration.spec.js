const { test } = require('./fixture');
const { registerBuyer } = require('../../helpers/buyer-account-ui');

test('register a unique Buyer and verify authenticated identity', async ({ page }, info) => {
  test.setTimeout(90000);
  await registerBuyer(page, info.project.use.baseURL);
});
