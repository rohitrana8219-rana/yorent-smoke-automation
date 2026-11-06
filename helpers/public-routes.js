const { expect } = require('@playwright/test');

// UAT supports explicit /en paths and canonical unprefixed English links.
// Compare the same origin, role/controller, and IDs; keep English mandatory.
function publicPath(value) {
  const base = new URL(process.env.YORENT_BASE_URL);
  const url = new URL(value.trim(), base);
  if (url.origin !== base.origin) throw new Error('Unexpected public navigation origin.');
  return url.pathname.replace(/^\/en(?=\/|$)/, '') || '/';
}
async function expectEnglishURL(page, expectedPath) {
  const origin = new URL(process.env.YORENT_BASE_URL).origin;
  await page.waitForURL(url => {
    if (url.origin !== origin) return false;
    const path = publicPath(url.toString());
    return expectedPath instanceof RegExp ? expectedPath.test(path) : path === publicPath(expectedPath);
  }, { waitUntil: 'load' });
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
}
function publicLink(scope, expectedPath) {
  const path = publicPath(expectedPath);
  return scope.locator(`a[href="${path}"],a[href="/en${path}"]`);
}
async function expectPublicHref(locator, expectedPath) {
  await expect(locator).toBeAttached();
  expect(publicPath(await locator.getAttribute('href'))).toBe(publicPath(expectedPath));
}
module.exports = { publicPath, expectEnglishURL, publicLink, expectPublicHref };
