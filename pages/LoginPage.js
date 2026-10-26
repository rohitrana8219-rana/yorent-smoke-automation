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
  }

  async login(username, password) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.signInButton.click();
  }
}

module.exports = LoginPage;
