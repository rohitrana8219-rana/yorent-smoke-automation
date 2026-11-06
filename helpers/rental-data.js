const fs = require('fs');
const path = require('path');
const { expect } = require('@playwright/test');
const { authDir, fillPrivate, attachRecords } = require('./workflow-data');
const SellerLoginPage = require('../pages/SellerLoginPage');
const { expectEnglishURL } = require('./public-routes');

const rentalDir = path.join(authDir, 'rental');
const run = process.env.YORENT_RENTAL_RUN;
if (!/^[a-f0-9]{8}$/.test(run || '')) throw new Error('Use an npm rental command to select a rental run.');
const runDir = path.join(rentalDir, 'runs', run);
let activeRun = run;
function currentRun() { return activeRun; }
function selectRentalRun(value) {
  if (!/^[a-f0-9]{8}$/.test(value || '')) throw new Error('Invalid rental run ID.');
  activeRun = value;
}
function file(name, selectedRun = activeRun) {
  if (!/^[a-f0-9]{8}$/.test(selectedRun || '')) throw new Error('Invalid rental run ID.');
  return path.join(rentalDir, 'runs', selectedRun, `${name}.json`);
}
function save(name, value) {
  const target = file(name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(`${target}.tmp`, JSON.stringify(value, null, 2));
  fs.renameSync(`${target}.tmp`, target);
}
function read(name) {
  if (!fs.existsSync(file(name))) throw new Error(`Rental run ${activeRun} needs ${name}. See docs/PROJECT_GUIDE.md for the prerequisite command.`);
  const data = JSON.parse(fs.readFileSync(file(name), 'utf8'));
  if (data.origin) expect(data.origin).toBe(new URL(process.env.YORENT_BASE_URL).origin);
  return data;
}
function journey() {
  const data = read('journey');
  expect(data.run).toBe(activeRun);
  return data;
}
function requireOrder() {
  const data = journey();
  if (data.order?.phase !== 'paid' || !/^O\d+$/.test(data.order.id || '')) {
    throw new Error('A verified paid order is required. Run npm run test:buyer:booking first; reconcile any pending payment manually.');
  }
  return data;
}
function snapshotSources(data) {
  if (data.inventory) return data;
  const seller = JSON.parse(fs.readFileSync(path.join(authDir, 'seller-account.json'), 'utf8'));
  const admin = JSON.parse(fs.readFileSync(path.join(authDir, 'admin-workflow.json'), 'utf8'));
  expect(seller.origin).toBe(data.origin);
  expect(admin.origin).toBe(data.origin);
  if (!admin.complete || seller.product?.approvalStatus !== 'Approved') throw new Error('Run npm run test:workflow:sequential to create approved rental inventory first.');
  data.sellerId = String(seller.id);
  data.shop = seller.shop;
  data.sellerName = seller.name;
  data.shipping = seller.shipping;
  data.inventory = {};
  for (const source of ['admin', 'seller']) {
    const stock = seller.inventories?.[source];
    if (stock?.phase !== 'complete' || !/^\d+$/.test(String(stock.id))) throw new Error(`Missing completed ${source} inventory; run the existing workflow.`);
    const catalogId = String(source === 'admin' ? admin.product.id : seller.product.id);
    expect(String(stock.productId), 'Inventory must belong to the exact retained catalog product; rerun a consistent original workflow if handoff files differ.').toBe(catalogId);
    data.inventory[source] = { ...stock, catalogId };
  }
  save('seller-account', seller);
  save('journey', data);
  return data;
}
function intent(data, key, value) {
  data.pending = { key, ...value };
  save('journey', data);
}
function clearIntent(data) { delete data.pending; save('journey', data); }
function noPending(data) {
  if (data.pending) throw new Error(`Run ${activeRun} has an uncertain ${data.pending.key} submission. Reconcile the exact retained record in UI before continuing; do not retry the mutation.`);
}
async function dismissCookies(page) {
  const decline = page.locator('.cc-cookie-decline-js');
  if (await decline.isVisible()) await decline.click();
}
async function verifyIdentity(page, account, role) {
  await page.goto('/en/account/profile-info');
  const profile = page.locator('form[name=frmProfileInfo]');
  await expect(profile.locator('input[name=user_name]')).toHaveValue(account.name);
  // Compare privately: Playwright error output must never contain account credentials.
  expect((await profile.locator('input[name=credential_username]').inputValue()) === account.username).toBe(true);
  expect((await profile.locator('input[name=credential_email]').inputValue()) === account.email).toBe(true);
  const ids = await page.locator('img[src*="/user-profile-image/"]').evaluateAll(images => [...new Set(images.map(image => image.getAttribute('src').match(/\/user-profile-image\/(\d+)\//)?.[1]).filter(Boolean))]);
  expect(ids).toHaveLength(1);
  if (account.id) expect(ids[0]).toBe(String(account.id));
  else account.id = ids[0];
  await page.goto(`/en/${role}`);
  await expectEnglishURL(page, `/${role}`);
}
async function authenticate(page, account, role, stateName) {
  fs.rmSync(file(stateName), { force: true });
  if (!account.username || !account.password || !account.id) throw new Error(`Missing retained ${role} account; run its registration first.`);
  const login = new SellerLoginPage(page); // The observed public login form is shared by both roles.
  await login.goto();
  await dismissCookies(page);
  await login.login(account.username, account.password);
  await expectEnglishURL(page, `/${role}`);
  await verifyIdentity(page, account, role);
  await page.context().storageState({ path: file(stateName) });
}
module.exports = { fs, path, authDir, rentalDir, run, runDir, currentRun, selectRentalRun, file, save, read, journey, requireOrder, snapshotSources, intent, clearIntent, noPending, dismissCookies, verifyIdentity, authenticate, fillPrivate, attachRecords };
