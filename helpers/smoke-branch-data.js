const { expect } = require('@playwright/test');
const { fs, file, read, save, journey } = require('./rental-data');

function sourceInventory(sourceRun, origin) {
  const sourceFile = file('journey', sourceRun);
  if (!fs.existsSync(sourceFile)) throw new Error('A completed original rental run is required. Run npm run test:rental:headed or supply --source-run <completed run ID>.');
  const source = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
  expect(source.origin).toBe(origin);
  expect(source.order?.phase).toBe('paid');
  for (const kind of ['admin', 'seller']) {
    expect(source.inventory?.[kind]?.phase).toBe('complete');
    expect(source.lines?.[kind]?.status).toBe('Completed');
  }
  const seller = JSON.parse(fs.readFileSync(file('seller-account', sourceRun), 'utf8'));
  expect(String(seller.id)).toBe(source.sellerId);
  expect(seller.origin).toBe(origin);
  return { source, seller };
}

function pinSource(sourceRun, origin, branch) {
  const data = journey();
  if (data.lifecycle) {
    expect(data.lifecycle.branch).toBe(branch);
    expect(data.lifecycle.sourceRun).toBe(sourceRun);
    if (!data.lifecycle.sourceOrderId) {
      data.lifecycle.sourceOrderId = sourceInventory(sourceRun, origin).source.order.id;
      save('journey', data);
    }
    return;
  }
  const { source, seller } = sourceInventory(sourceRun, origin);
  for (const key of ['sellerId', 'sellerName', 'shop', 'shipping', 'inventory']) data[key] = source[key];
  data.lifecycle = { branch, sourceRun, sourceOrderId: source.order.id, buyerId: data.buyerId, sellerId: data.sellerId, requests: {} };
  save('seller-account', seller);
  save('journey', data);
}

function branchData(branch) {
  const data = journey();
  expect(data.lifecycle?.branch).toBe(branch);
  expect(data.order?.phase).toBe('paid');
  expect(data.order.buyerId).toBe(data.buyerId);
  expect(data.order.sellerId).toBe(data.sellerId);
  expect(data.lifecycle.buyerId).toBe(data.buyerId);
  expect(data.lifecycle.sellerId).toBe(data.sellerId);
  if (data.lifecycle.sourceOrderId) expect(data.order.id).not.toBe(data.lifecycle.sourceOrderId);
  const manifest = JSON.parse(process.env.YORENT_SMOKE_SELECTION || '{}');
  const otherRun = manifest[branch === 'cancel' ? 'refundRun' : 'cancelRun'];
  if (otherRun && fs.existsSync(file('journey', otherRun))) {
    const other = JSON.parse(fs.readFileSync(file('journey', otherRun), 'utf8'));
    expect(other.buyerId).not.toBe(data.buyerId);
    if (other.order) expect(other.order.id).not.toBe(data.order.id);
  }
  return data;
}
module.exports = { sourceInventory, pinSource, branchData };
