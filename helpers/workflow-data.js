const fs = require('fs');
const path = require('path');

const authDir = path.join(__dirname, '..', '.auth');
// Independent modules must not replace the complete workflow's handoff data.
const dataDir = process.env.YORENT_EXECUTION_MODE === 'modules'
  ? path.join(authDir, 'modules') : authDir;

function writeData(name, data) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, `${name}.json`), JSON.stringify(data, null, 2));
}

function readData(name) {
  const file = path.join(dataDir, `${name}.json`);
  if (!fs.existsSync(file)) throw new Error(`Missing ${name} data; run its workflow dependency first.`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveSeller(account) {
  writeData('seller-account', account);
  // Keep each generated account available privately for later manual verification.
  writeData(`seller-account-${account.suffix}`, account);
}

async function fillPrivate(locator, value) {
  try {
    await locator.fill(value);
  } catch {
    throw new Error('Could not enter private seller account data.');
  }
}

async function attachRecords(testInfo, records) {
  console.log('Retained demo records: ' + JSON.stringify(records));
  await testInfo.attach('retained-records', {
    body: JSON.stringify(records, null, 2),
    contentType: 'application/json',
  });
}

module.exports = { authDir, writeData, readData, saveSeller, fillPrivate, attachRecords };
