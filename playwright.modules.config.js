// A separate entry point keeps module selection out of the existing workflow graph.
process.env.YORENT_EXECUTION_MODE = 'modules';
const { defineConfig } = require('@playwright/test');
const path = require('path');
const base = require('./playwright.config');

module.exports = defineConfig({
  ...base,
  projects: [
    base.projects.find(project => project.name === 'setup'),
    {
      name: 'module-admin',
      dependencies: ['setup'],
      testMatch: [
        '**/admin/brands.spec.js', '**/admin/categories.spec.js',
        '**/admin/tax-structure.spec.js', '**/modules/shipping.spec.js',
        '**/modules/commission.spec.js',
      ],
      use: { browserName: 'chromium', storageState: path.join(__dirname, '.auth', 'admin.json') },
    },
    {
      name: 'suite-tax',
      dependencies: ['setup'],
      testMatch: '**/modules/tax-suite.spec.js',
      use: { browserName: 'chromium', storageState: path.join(__dirname, '.auth', 'admin.json') },
    },
    {
      name: 'module-registration',
      testMatch: '**/seller/registration.spec.js',
      use: { browserName: 'chromium', trace: 'off', screenshot: 'off' },
    },
  ],
});
