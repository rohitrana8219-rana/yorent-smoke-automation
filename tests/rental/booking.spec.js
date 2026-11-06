const { test } = require('./fixture');
const { journey } = require('../../helpers/rental-data');
const { booking } = require('../../helpers/rental-booking-ui');
test('book both retained rental inventories and pay exactly once by wallet', async ({ page }) => {
  test.setTimeout(180000);
  await booking(page, journey());
});
