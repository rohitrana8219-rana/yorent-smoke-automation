// Compose the validated 36-test journey; its specs remain in their module folders.
process.env.YORENT_RENTAL_FULL = '1';
const rental = require('./playwright.rental.config');
const { file } = require('./helpers/rental-data');
const manifest = JSON.parse(process.env.YORENT_SMOKE_SELECTION || '{}');
if (!manifest.run) throw new Error('Use an npm smoke command to select a smoke run.');
const full = process.env.YORENT_SMOKE_MODE === 'full';
const roleUse = (role, run) => ({
  browserName: 'chromium', trace: 'off', screenshot: 'off',
  ...(role === 'admin' ? { storageState: '.auth/admin.json' } : role ? { storageState: file(role, run) } : {}),
});
const projects = full ? [...rental.projects] : rental.projects.filter(project => project.name === 'setup');
for (const branch of ['cancel', 'refund']) {
  const run = manifest[`${branch}Run`];
  const stages = [
    ['buyer', 'smoke-checklist/prepare-buyer.spec.js', null],
    ['buyer-auth', 'rental/buyer-auth.spec.js', null],
    ['credit', 'rental/credit.spec.js', 'admin'],
    ['booking', 'rental/booking.spec.js', 'buyer'],
    ...(branch === 'cancel' ? [
      ['request', 'smoke-checklist/cancellation-request.spec.js', 'buyer'],
      ['seller-auth', 'rental/seller-auth.spec.js', null],
      ['seller-view', 'smoke-checklist/cancellation-seller-view.spec.js', 'seller'],
      ['approve', 'smoke-checklist/cancellation-admin-approve.spec.js', 'admin'],
      ['reconcile', 'smoke-checklist/cancellation-wallet.spec.js', 'buyer'],
    ] : [
      ['seller-auth', 'rental/seller-auth.spec.js', null],
      ['fulfillment', 'smoke-checklist/refund-fulfillment.spec.js', 'seller'],
      ['request', 'smoke-checklist/refund-request.spec.js', 'buyer'],
      ['process', 'smoke-checklist/refund-seller-process.spec.js', 'seller'],
      ['reconcile', 'smoke-checklist/refund-wallet.spec.js', 'buyer'],
    ]),
  ];
  for (let index = 0; index < stages.length; index++) {
    const [stage, spec, role] = stages[index];
    const dependencies = index ? [`smoke-${branch}-${stages[index - 1][0]}`]
      : [full ? branch === 'cancel' ? 'rental-complete' : 'smoke-cancel-reconcile' : 'setup'];
    projects.push({
      name: `smoke-${branch}-${stage}`, testMatch: `**/${spec}`, dependencies,
      metadata: { rentalRun: run, branch, sourceRun: manifest.sourceRun },
      use: roleUse(role, run),
    });
  }
}
module.exports = {
  ...rental,
  reporter: [['list'], ['html', { outputFolder: 'smoke-report', open: 'never' }]],
  projects: projects.map(project => ({ ...project, use: { ...project.use, trace: 'off', screenshot: 'off' } })),
};
