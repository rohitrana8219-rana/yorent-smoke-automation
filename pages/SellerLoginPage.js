const { fillPrivate } = require('../helpers/workflow-data');

class SellerLoginPage {
  constructor(page) {
    this.page = page;
    this.form = page.locator('form[name="frmLogin"]');
  }

  async goto() {
    await this.page.goto('/guest-user/login-form', { waitUntil: 'domcontentloaded' });
    await this.form.waitFor({ state: 'visible' });
    const decline = this.page.getByRole('button', { name: 'Decline', exact: true });
    if (await decline.isVisible()) await decline.click();
  }

  async login(username, password) {
    await fillPrivate(this.form.locator('input[name="username"]'), username);
    await fillPrivate(this.form.locator('input[name="password"]'), password);
    await this.form.locator('input[name="btn_submit"]').click();
  }
}

module.exports = SellerLoginPage;
