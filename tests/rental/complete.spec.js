const { test, expect } = require('./fixture');
const { requireOrder, file, save } = require('../../helpers/rental-data');
const { complete } = require('../../helpers/rental-orders-ui');
for (const source of ['admin', 'seller']) {
  test('complete: exact ' + source + ' inventory suborder', async ({ page, browser }, info) => {
    test.setTimeout(120000);
    const data = requireOrder();
    await complete(page, data, source);
    if (source === 'seller') {
      const context = await browser.newContext({ baseURL: info.project.use.baseURL, storageState: file('buyer') });
      try {
        const buyerPage = await context.newPage();
        await buyerPage.goto('/en/account/credits');
        await expect(buyerPage.locator('.credit-balance-start .text-balance')).toHaveText('$386.50');
        for (const item of Object.values(data.lines)) {
          expect(item.status).toBe('Completed');
          const refund = buyerPage.locator('tr').filter({ has: buyerPage.getByText(`Refunded Rental Security For Order #${item.invoice}`, { exact: true }) });
          await expect(refund).toHaveCount(1);
          await expect(refund).toContainText('$25.00');
          await expect(refund).toContainText('$0.00');
          await expect(refund).toContainText('Transaction Completed');
        }
        data.wallet.balanceAfterCompletion = '386.50';
        save('journey', data);
      } finally { await context.close(); }
    }
  });
}
