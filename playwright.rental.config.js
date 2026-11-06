const base = require('./playwright.config');
const { file } = require('./helpers/rental-data');
const full = process.env.YORENT_RENTAL_FULL === '1';
const stages = [
  ['rental-registration', 'registration', null],
  ['rental-buyer-auth', 'buyer-auth', null],
  ['rental-credit', 'credit', '.auth/admin.json'],
  ['rental-booking', 'booking', file('buyer')],
  ['rental-seller-auth', 'seller-auth', null],
  ['rental-fulfillment', 'fulfillment', file('seller')],
  ['rental-buyer-return', 'buyer-return', file('buyer')],
  ['rental-seller-return', 'seller-return', file('seller')],
  ['rental-complete', 'complete', '.auth/admin.json'],
];
const standaloneDependencies = {
  'rental-credit': ['setup'], 'rental-booking': ['rental-buyer-auth'],
  'rental-fulfillment': ['rental-seller-auth'],
  'rental-buyer-return': ['rental-buyer-auth'],
  'rental-seller-return': ['rental-seller-auth'], 'rental-complete': ['setup'],
};
module.exports = {
  ...base,
  workers: 1,
  retries: 0,
  fullyParallel: false,
  projects: [
    ...(full ? base.projects : base.projects.filter(project => project.name === 'setup')),
    ...stages.map(([name, spec, storageState], index) => ({
      name, testMatch: `**/rental/${spec}.spec.js`,
      dependencies: full ? [index ? stages[index - 1][0] : 'chromium-seller'] : standaloneDependencies[name] || [],
      // Account and payment pages contain private fields. Record only whitelisted
      // business diagnostics; raw Playwright traces/screenshots would expose them.
      use: { browserName: 'chromium', trace: 'off', screenshot: 'off', ...(storageState ? { storageState } : {}) },
    })),
  ],
};
