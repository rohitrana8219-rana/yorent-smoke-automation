const fs = require('fs');
const path = require('path');
const { randomBytes } = require('crypto');
const { spawn } = require('child_process');
const { chromium } = require('@playwright/test');

async function main() {
  const [stage, ...flags] = process.argv.slice(2);
  const stages = ['registration', 'buyer-auth', 'credit', 'booking', 'fulfillment', 'buyer-return', 'seller-return', 'complete', 'full'];
  if (!stages.includes(stage) || flags.includes('--help')) {
    console.log('run-rental <' + stages.join('|') + '> [--run <8-character run ID>] [--headed] [--list]');
    if (!stages.includes(stage)) process.exitCode = 1;
    return;
  }
  const args = [...flags];
  const runIndex = args.indexOf('--run');
  let run = runIndex >= 0 ? args.splice(runIndex, 2)[1] : null;
  if (args.some(arg => /^--(config|project|no-deps|workers|fully-parallel|shard|repeat-each|retries|debug|ui)/.test(arg))) {
    throw new Error('Rental commands manage dependencies, one worker, and zero retries. Repetition/debug overrides are unsafe for transaction tests.');
  }
  const root = path.join(__dirname, '..');
  const dataDir = path.join(root, '.auth', 'rental');
  const current = path.join(dataDir, 'current.json');
  const listing = args.includes('--list');
  if (!run && ['registration', 'full'].includes(stage)) run = randomBytes(4).toString('hex');
  if (!run && listing) run = '00000000';
  if (!run && fs.existsSync(current)) run = JSON.parse(fs.readFileSync(current, 'utf8')).run;
  if (!/^[a-f0-9]{8}$/.test(run || '')) throw new Error('Run npm run test:buyer:registration first, or supply --run <retained run ID>.');
  if (!listing && ['registration', 'full'].includes(stage) && fs.existsSync(path.join(dataDir, 'runs', run, 'buyer-account.json'))) {
    throw new Error('This run already has a Buyer registration attempt. Select its standalone stages with --run, or start a fresh registration/full run.');
  }
  fs.mkdirSync(dataDir, { recursive: true });
  const lockFile = path.join(dataDir, 'execution.lock');
  let lock;
  let server;
  let child;
  const stop = () => { if (child && !child.killed) child.kill('SIGTERM'); };
  try {
    if (!listing) {
      try { lock = fs.openSync(lockFile, 'wx'); } catch { throw new Error('Another rental command may be running. Do not run transactions concurrently; reconcile a leftover .auth/rental/execution.lock manually.'); }
      fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, run }));
      fs.writeFileSync(current, JSON.stringify({ run }));
      server = await chromium.launchServer({ host: '127.0.0.1', headless: !args.includes('--headed') });
    }
    const env = { ...process.env, YORENT_RENTAL_RUN: run, YORENT_RENTAL_FULL: stage === 'full' ? '1' : '0', PLAYWRIGHT_NO_COPY_PROMPT: '1' };
    delete env.YORENT_EXECUTION_MODE;
    delete env.YORENT_BROWSER_WS;
    if (server) env.YORENT_BROWSER_WS = server.wsEndpoint();
    const target = stage === 'full' ? 'complete' : stage;
    console.log(`Rental run ${run}: ${stage}; one browser process, isolated role contexts, no retries.`);
    const cli = path.join(path.dirname(require.resolve('@playwright/test/package.json')), 'cli.js');
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    child = spawn(process.execPath, [cli, 'test', '--config=playwright.rental.config.js', `--project=rental-${target}`, ...args], { cwd: root, env, stdio: 'inherit', windowsHide: true });
    process.exitCode = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', code => resolve(code ?? 130)); });
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    if (server) await server.close();
    if (lock !== undefined) { fs.closeSync(lock); fs.rmSync(lockFile); }
  }
}
main().catch(error => { console.error(error.message.replace(/wss?:\/\/\S+/g, '[private browser endpoint]')); process.exitCode = 1; });
