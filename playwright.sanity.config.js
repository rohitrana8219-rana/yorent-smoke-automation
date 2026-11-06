const base = require('./playwright.config');
module.exports = {
  ...base, workers: 1, retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/sanity-audit/results.json' }]],
  projects: [{ name: 'sanity-gaps', testMatch: '**/smoke-checklist/sanity-gaps.spec.js',
    use: { browserName: 'chromium', storageState: '.auth/admin.json', trace: 'off', screenshot: 'off' } }],
};
