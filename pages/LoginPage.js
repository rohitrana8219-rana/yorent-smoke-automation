const { fillPrivate } = require('../helpers/workflow-data');

class LoginPage {
  constructor(page) {
    this.page = page;
    this.usernameInput = page.locator('input[name="username"]');
    this.passwordInput = page.locator('input[name="password"]');
    this.rememberMeCheckbox = page.locator('input[name="rememberme"]');
    this.signInButton = page.locator('input[name="btn_submit"]');
  }

  async goto() {
    await this.page.goto('/admin/admin-guest/login-form');
    if ((await this.page.locator('body').innerText()).includes('mysqli_sql_exception')) {
      throw new Error('UAT database unavailable (mysqli_sql_exception). No login or money action submitted.');
    }
    await this.usernameInput.waitFor({ state: 'visible' });
  }

  async login(username, password) {
    await fillPrivate(this.usernameInput, username);
    await fillPrivate(this.passwordInput, password);
    await this.signInButton.click();
  }
}

module.exports = LoginPage;
