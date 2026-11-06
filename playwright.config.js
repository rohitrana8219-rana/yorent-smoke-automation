require('dotenv').config();

const { defineConfig } = require('@playwright/test');
const path = require('path');

const baseURL = process.env.YORENT_BASE_URL;
if (!baseURL) {
  throw new Error('YORENT_BASE_URL must be set to the client origin before running tests.');
}

let parsedBaseURL;
try {
  parsedBaseURL = new URL(baseURL);
} catch {
  throw new Error('YORENT_BASE_URL must be a valid http(s) origin, for example https://client.example.com.');
}

if (
  !['http:', 'https:'].includes(parsedBaseURL.protocol) ||
  parsedBaseURL.username ||
  parsedBaseURL.password ||
  parsedBaseURL.pathname !== '/' ||
  parsedBaseURL.search ||
  parsedBaseURL.hash
) {
  throw new Error('YORENT_BASE_URL must contain only an http(s) scheme and client host.');
}

module.exports = defineConfig({
  testDir: './tests',
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
  use: {
    baseURL: parsedBaseURL.origin,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    ...(process.env.YORENT_BROWSER_WS ? {
      connectOptions: { wsEndpoint: process.env.YORENT_BROWSER_WS },
    } : {}),
  },
  projects: [
    {
      name: 'setup',
      testMatch: '**/auth.setup.js',
      use: {
        browserName: 'chromium',
      },
    },
    {
      name: 'chromium-unauthenticated',
      testMatch: '**/admin/login.spec.js',
      testIgnore: '**/auth.setup.js',
      use: {
        browserName: 'chromium',
      },
    },
    {
      name: 'chromium-authenticated',
      dependencies: ['setup'],
      testMatch: '**/admin/**/*.spec.js',
      testIgnore: ['**/auth.setup.js', '**/admin/login.spec.js', '**/admin/seller-approval.spec.js', '**/admin/seller-product-approval.spec.js'],
      use: {
        browserName: 'chromium',
        storageState: path.join(__dirname, '.auth', 'admin.json'),
      },
    },
    {
      name: 'seller-registration',
      dependencies: ['chromium-authenticated'],
      testMatch: '**/seller/registration.spec.js',
      use: { browserName: 'chromium', trace: 'off', screenshot: 'off' },
    },
    {
      name: 'chromium-seller-approval',
      dependencies: ['seller-registration'],
      testMatch: '**/admin/seller-approval.spec.js',
      use: {
        browserName: 'chromium', storageState: path.join(__dirname, '.auth', 'admin.json'),
        trace: 'off', screenshot: 'off',
      },
    },
    {
      name: 'seller-setup',
      dependencies: ['chromium-seller-approval'],
      testMatch: '**/seller.auth.setup.js',
      use: { browserName: 'chromium', trace: 'off', screenshot: 'off' },
    },
    {
      name: 'chromium-seller-shop',
      dependencies: ['seller-setup'],
      testMatch: '**/seller/shop.spec.js',
      use: {
        browserName: 'chromium', storageState: path.join(__dirname, '.auth', 'seller.json'),
        trace: 'off', screenshot: 'off',
      },
    },
    {
      name: 'chromium-seller-product',
      dependencies: ['chromium-seller-shop'],
      testMatch: '**/seller/product.spec.js',
      use: {
        browserName: 'chromium', storageState: path.join(__dirname, '.auth', 'seller.json'),
        trace: 'off', screenshot: 'off',
      },
    },
    {
      name: 'chromium-product-approval',
      dependencies: ['chromium-seller-product'],
      testMatch: '**/admin/seller-product-approval.spec.js',
      use: {
        browserName: 'chromium', storageState: path.join(__dirname, '.auth', 'admin.json'),
        trace: 'off', screenshot: 'off',
      },
    },
    {
      name: 'chromium-seller',
      dependencies: ['chromium-product-approval'],
      testMatch: '**/seller/inventory.spec.js',
      use: {
        browserName: 'chromium', storageState: path.join(__dirname, '.auth', 'seller.json'),
        trace: 'off', screenshot: 'off',
      },
    },
  ],
});
